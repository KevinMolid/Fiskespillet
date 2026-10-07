import { collection, doc, getDoc, getDocs, writeBatch, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FISH_REWARDS, hasRunningShoes, ITEM_BY_ID, SHOP_PRICES, type BaitId, type ItemId } from './items'
import { DIG_SPOTS, DEFAULT_APPEARANCE, FISH_BY_ID, isAppearance, isPosition, START, type Appearance, type Position } from './world'

import { normalizeFishBookEntry, updateFishBookEntry, type FishBookEntry, type LegacyFishBookEntry } from './fishBook'
import { fishingOptions } from './fish'
export type { FishBookEntry } from './fishBook'

/** Read-only check used by the opening screen; unlike loadPosition/loadInventory it creates nothing. */
export async function hasExistingGame(uid: string): Promise<boolean> {
  const databaseRef = database()
  const [save, inventory, look, fishBook, digSites] = await Promise.all([
    getDoc(doc(databaseRef, 'gameSaves', uid)),
    getDoc(doc(databaseRef, 'playerInventories', uid)),
    getDoc(doc(databaseRef, 'characterLooks', uid)),
    getDocs(collection(databaseRef, 'fishBooks', uid, 'entries')),
    Promise.all(Object.keys(DIG_SPOTS).map(spotId => getDoc(doc(databaseRef, 'digSpots', uid, 'entries', spotId)))),
  ])
  return save.exists() || inventory.exists() || look.exists() || !fishBook.empty || digSites.some(site => site.exists())
}

/** Delete all game progress in one Firestore batch while leaving the account and profile intact. */
export async function resetGameData(uid: string): Promise<void> {
  const databaseRef = database()
  const [fishBook, digSites] = await Promise.all([
    getDocs(collection(databaseRef, 'fishBooks', uid, 'entries')),
    Promise.all(Object.keys(DIG_SPOTS).map(spotId => getDoc(doc(databaseRef, 'digSpots', uid, 'entries', spotId)))),
  ])
  const batch = writeBatch(databaseRef)
  batch.delete(doc(databaseRef, 'gameSaves', uid))
  batch.delete(doc(databaseRef, 'playerInventories', uid))
  batch.delete(doc(databaseRef, 'characterLooks', uid))
  fishBook.docs.forEach(entry => batch.delete(entry.ref))
  digSites.forEach(site => { if (site.exists()) batch.delete(site.ref) })
  await batch.commit()
}

function database() {
  if (!db) throw new Error('Firestore er ikke konfigurert.')
  return db
}

export async function loadPosition(uid: string): Promise<Position> {
  const ref = doc(database(), 'gameSaves', uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists() && isPosition(snapshot.data())) return snapshot.data() as Position
  if (!snapshot.exists()) await setDoc(ref, { ...START, updatedAt: serverTimestamp() })
  return START
}

export async function savePosition(uid: string, position: Position) {
  if (!isPosition(position)) throw new Error('Ugyldig kartposisjon.')
  await setDoc(doc(database(), 'gameSaves', uid), { ...position, updatedAt: serverTimestamp() })
}

export async function loadFishBook(uid: string): Promise<FishBookEntry[]> {
  const snapshot = await getDocs(collection(database(), 'fishBooks', uid, 'entries'))
  return snapshot.docs.filter(entry => Object.hasOwn(FISH_BY_ID, entry.id)).map(entry => normalizeFishBookEntry(entry.data() as LegacyFishBookEntry))
}

export type ItemCounts = Partial<Record<ItemId, number>>
export type Inventory = { bag: ItemCounts; storage: ItemCounts; equippedBait: BaitId | null; coins: number }
const STARTER_INVENTORY: Inventory = { bag: { rod: 1, shovel: 1, bread: 3 }, storage: {}, equippedBait: null, coins: 60 }
const DIG_COOLDOWN_MS = 2 * 60 * 1000

function inventoryRef(uid: string) {
  return doc(database(), 'playerInventories', uid)
}

function inventoryData(snapshot: { data: () => unknown; exists: () => boolean }): Inventory {
  if (!snapshot.exists()) return { bag: { ...STARTER_INVENTORY.bag }, storage: {}, equippedBait: null, coins: 60 }
  const data = snapshot.data() as Inventory
  return { bag: { ...data.bag }, storage: { ...data.storage }, equippedBait: data.equippedBait ?? null, coins: Number.isInteger(data.coins) ? data.coins : 60 }
}

export async function loadInventory(uid: string): Promise<Inventory> {
  const ref = inventoryRef(uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) return inventoryData(snapshot)
  return runTransaction(database(), async transaction => {
    const latest = await transaction.get(ref)
    if (latest.exists()) return inventoryData(latest)
    transaction.set(ref, { ...STARTER_INVENTORY, updatedAt: serverTimestamp() })
    return inventoryData(latest)
  })
}

/** A permanent key item: concurrent conversations/reloads cannot award another pair. */
export async function grantMaritaSneakers(uid: string): Promise<{ inventory: Inventory; received: boolean }> {
  const ref = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(snapshot)
    if (hasRunningShoes(inventory)) return { inventory, received: false }
    inventory.bag.sneakers = 1
    transaction.set(ref, { ...inventory, updatedAt: serverTimestamp() })
    return { inventory, received: true }
  })
}

export async function setEquippedBait(uid: string, bait: BaitId | null): Promise<Inventory> {
  if (bait && !ITEM_BY_ID[bait]?.bait) throw new Error('Ukjent agn.')
  const ref = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(snapshot)
    if (bait && !(inventory.bag[bait] ?? 0)) throw new Error('Du har ikke dette agnet i sekken.')
    const next = { ...inventory, equippedBait: bait }
    transaction.set(ref, { ...next, updatedAt: serverTimestamp() })
    return next
  })
}

/** Consume the used bait after an unlanded cast without revealing the species in the fish book. */
export async function consumeBait(uid: string, bait: BaitId): Promise<Inventory> {
  const ref = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(snapshot)
    if (inventory.equippedBait !== bait || !(inventory.bag[bait] ?? 0)) throw new Error('Du har ikke lenger valgt agn i sekken.')
    inventory.bag[bait] = (inventory.bag[bait] ?? 0) - 1
    if (!inventory.bag[bait]) {
      delete inventory.bag[bait]
      inventory.equippedBait = null
    }
    transaction.set(ref, { ...inventory, updatedAt: serverTimestamp() })
    return inventory
  })
}

export async function transferItem(uid: string, itemId: ItemId, toStorage: boolean): Promise<Inventory> {
  if (!ITEM_BY_ID[itemId]) throw new Error('Ukjent gjenstand.')
  if (ITEM_BY_ID[itemId].category === 'key') throw new Error('Nøkkelgjenstander beholdes i sekken.')
  const ref = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(snapshot)
    const from = toStorage ? inventory.bag : inventory.storage
    const to = toStorage ? inventory.storage : inventory.bag
    if (!(from[itemId] ?? 0)) throw new Error('Gjenstanden finnes ikke her.')
    if ((to[itemId] ?? 0) >= 999) throw new Error('Det er ikke plass til flere.')
    from[itemId] = (from[itemId] ?? 0) - 1
    if (!from[itemId]) delete from[itemId]
    to[itemId] = (to[itemId] ?? 0) + 1
    if (toStorage && inventory.equippedBait === itemId && !inventory.bag[itemId]) inventory.equippedBait = null
    transaction.set(ref, { ...inventory, updatedAt: serverTimestamp() })
    return inventory
  })
}

export async function digForWorms(uid: string, spotId: string): Promise<{ inventory: Inventory; amount: number }> {
  if (!DIG_SPOTS[spotId]) throw new Error('Ukjent jordflekk.')
  const ref = inventoryRef(uid)
  const spotRef = doc(database(), 'digSpots', uid, 'entries', spotId)
  return runTransaction(database(), async transaction => {
    const inventorySnap = await transaction.get(ref)
    const spotSnap = await transaction.get(spotRef)
    if (!inventorySnap.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(inventorySnap)
    if (!(inventory.bag.shovel ?? 0)) throw new Error('Du trenger en spade i sekken for å grave.')
    const lastDugAt = spotSnap.data()?.lastDugAt as Timestamp | undefined
    if (lastDugAt && Date.now() - lastDugAt.toMillis() < DIG_COOLDOWN_MS) {
      throw new Error('Jorden er nylig gravd opp. Kom tilbake om litt.')
    }
    const amount = 1 + Math.floor(Math.random() * 3)
    if ((inventory.bag.worm ?? 0) + amount > 999) throw new Error('Sekken er full av mark.')
    inventory.bag.worm = (inventory.bag.worm ?? 0) + amount
    transaction.set(ref, { ...inventory, updatedAt: serverTimestamp() })
    transaction.set(spotRef, { lastDugAt: serverTimestamp() })
    return { inventory, amount }
  })
}

export async function recordEncounter(uid: string, speciesId: string, grams: number, caught: boolean, bait: BaitId, locationId: string) {
  if (!fishingOptions(locationId, bait).some(option => option.species.id === speciesId)) throw new Error('Fisken passer ikke til fangststedet og agnet.')
  const ref = doc(database(), 'fishBooks', uid, 'entries', speciesId)
  const bagRef = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    const bagSnapshot = await transaction.get(bagRef)
    if (!bagSnapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(bagSnapshot)
    if (!(inventory.bag.rod ?? 0)) throw new Error('Du trenger en fiskestang i sekken.')
    if (inventory.equippedBait !== bait) throw new Error('Du må velge agn i sekken før du fisker.')
    if (!(inventory.bag[bait] ?? 0)) throw new Error('Du er tom for valgt agn.')
    inventory.bag[bait] = (inventory.bag[bait] ?? 0) - 1
    if (!inventory.bag[bait]) {
      delete inventory.bag[bait]
      inventory.equippedBait = null
    }
    if (caught) inventory.coins += FISH_REWARDS[speciesId] ?? 0
    transaction.set(bagRef, { ...inventory, updatedAt: serverTimestamp() })
    const previous = snapshot.exists() ? snapshot.data() as FishBookEntry : null
    const entry = updateFishBookEntry(previous, speciesId, grams, caught, locationId, Timestamp.now())
    transaction.set(ref, {
      ...entry,
      firstSeenAt: previous?.firstSeenAt ?? serverTimestamp(),
      firstCaughtAt: previous?.firstCaughtAt ?? (caught ? serverTimestamp() : null),
      updatedAt: serverTimestamp(),
    })
    return { inventory, entry }
  })
}

export async function buyBait(uid: string, bait: BaitId, quantity: number): Promise<Inventory> {
  if (!SHOP_PRICES[bait] || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('Ugyldig vare eller antall.')
  const ref = inventoryRef(uid)
  return runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('Inventaret mangler.')
    const inventory = inventoryData(snapshot)
    const price = SHOP_PRICES[bait] * quantity
    if (inventory.coins < price) throw new Error('Du har ikke nok mynter.')
    if ((inventory.bag[bait] ?? 0) + quantity > 999) throw new Error('Sekken er full.')
    inventory.coins -= price
    inventory.bag[bait] = (inventory.bag[bait] ?? 0) + quantity
    transaction.set(ref, { ...inventory, updatedAt: serverTimestamp() })
    return inventory
  })
}

export async function loadAppearance(uid: string): Promise<Appearance> {
  const snapshot = await getDoc(doc(database(), 'characterLooks', uid))
  return snapshot.exists() && isAppearance(snapshot.data()) ? snapshot.data() as Appearance : DEFAULT_APPEARANCE
}

export async function saveAppearance(uid: string, appearance: Appearance) {
  if (!isAppearance(appearance)) throw new Error('Ugyldig figurutseende.')
  await setDoc(doc(database(), 'characterLooks', uid), { ...appearance, updatedAt: serverTimestamp() })
}
