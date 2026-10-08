import { catchMilestone, normalizeFishBookEntry, updateFishBookEntry } from '../src/game/fishBook'
import { NPCS } from '../src/game/npcs'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import GamePage, { type GameServices } from '../src/game/GamePage'
import { DEFAULT_APPEARANCE, START, type Position } from '../src/game/world'
import type { FishBookEntry, Inventory } from '../src/game/persistence'
import { Timestamp } from 'firebase/firestore'
import { FISH_REWARDS, hasRunningShoes, ITEM_BY_ID, SHOP_PRICES } from '../src/game/items'
import '../src/style.css'

// Dev-only services. Fish book fixtures persist locally, never to a real account.
// The actual GamePage, dialogs and Phaser scene are exercised without account writes.
let savedPosition = { ...START }
let savedAppearance = { ...DEFAULT_APPEARANCE }
let inventory: Inventory = { bag: { rod: 1, shovel: 1, bread: 3, worm: 5, corn: 2, spinner: 1 }, storage: { rod: 1, bread: 5, worm: 5 }, equippedBait: 'bread', coins: 60 }
const snapshot = () => structuredClone(inventory)
if (localStorage.getItem('fiskespillet-preview-sneakers') === '1') inventory.bag.sneakers = 1
let fishBook: FishBookEntry[] = [normalizeFishBookEntry({ speciesId: 'mort', seenCount: 12, caughtCount: 4, smallestGrams: 120, largestGrams: 630, lastGrams: 240, firstSeenAt: Timestamp.fromMillis(0), firstCaughtAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(0) })]
const storedBook = localStorage.getItem('fiskespillet-preview-fishbook-v1')
if (storedBook) fishBook = JSON.parse(storedBook).map(normalizeFishBookEntry)
const services: GameServices = {
  loadPosition: async () => ({ ...savedPosition }),
  loadAppearance: async () => ({ ...savedAppearance }),
  loadFishBook: async () => fishBook.map(entry => ({ ...entry })), loadInventory: async () => snapshot(),
  grantMaritaSneakers: async () => {
    if (hasRunningShoes(inventory)) return { inventory: snapshot(), received: false }
    inventory.bag.sneakers = 1
    localStorage.setItem('fiskespillet-preview-sneakers', '1')
    return { inventory: snapshot(), received: true }
  },
  savePosition: async (_uid, p) => {
    const output = document.querySelector('#preview-position')
    if (output) output.textContent = `${p.mapId}: ${p.x}, ${p.y} (${p.facing})`
  },
  saveAppearance: async (_uid, a) => { savedAppearance = { ...a } },
  setEquippedBait: async (_uid, bait) => { inventory = { ...inventory, equippedBait: bait }; return snapshot() },
  transferItem: async (_uid, id, toStorage) => {
    if (ITEM_BY_ID[id].category === 'key') throw new Error('Nøkkelgjenstander beholdes i sekken.')
    const from = toStorage ? inventory.bag : inventory.storage, to = toStorage ? inventory.storage : inventory.bag
    if (!(from[id] ?? 0)) throw new Error('Gjenstanden finnes ikke her.')
    from[id] = (from[id] ?? 0) - 1; to[id] = (to[id] ?? 0) + 1
    if (!inventory.bag[id] && inventory.equippedBait === id) inventory.equippedBait = null
    return snapshot()
  },
  buyBait: async (_uid, bait, amount) => {
    const cost = SHOP_PRICES[bait] * amount
    if (cost > inventory.coins) throw new Error('Ikke nok mynter.')
    inventory.coins -= cost; inventory.bag[bait] = (inventory.bag[bait] ?? 0) + amount
    return snapshot()
  },
  digForWorms: async () => ({ inventory: snapshot(), amount: 2 }),
  consumeBait: async (_uid, bait) => {
    if (inventory.equippedBait !== bait || !(inventory.bag[bait] ?? 0)) throw new Error('Du har ikke lenger valgt agn i sekken.')
    inventory.bag[bait] = (inventory.bag[bait] ?? 0) - 1
    if (!inventory.bag[bait]) { delete inventory.bag[bait]; inventory.equippedBait = null }
    return snapshot()
  },
  recordEncounter: async (_uid, speciesId, grams, caught, bait, locationId) => {
    if (!(inventory.bag[bait] ?? 0)) throw new Error('Tomt for agn.')
    inventory.bag[bait] = (inventory.bag[bait] ?? 0) - 1
    if (!inventory.bag[bait]) inventory.equippedBait = null
    if (caught) inventory.coins += FISH_REWARDS[speciesId]
    const previous = fishBook.find(entry => entry.speciesId === speciesId)
    const now = Timestamp.now()
    const entry = updateFishBookEntry(previous ?? null, speciesId, grams, caught, locationId, now)
    fishBook = [...fishBook.filter(entry=>entry.speciesId!==speciesId),entry]
    localStorage.setItem('fiskespillet-preview-fishbook-v1', JSON.stringify(fishBook))
    return { inventory: snapshot(), entry, milestone: caught ? catchMilestone(previous ?? null, grams) : null }
  },
}

function Preview() {
  const [revision, setRevision] = useState(0)
  function go(position: Position) {
    savedPosition = { ...position }
    setRevision(current => current + 1)
  }
  return <main className="game-preview-page mx-auto max-w-4xl text-white">
    <header className="preview-heading"><strong>Fiskespillet</strong><span>Lokal prøve · ingen kontolagring</span></header>
    <GamePage key={revision} user={{ uid: 'local-preview' }} services={services} />
    <details className="preview-tools p-3"><summary>Teststeder og posisjon</summary><div className="mt-3 flex flex-wrap gap-2">
      <button className="game-hud-button" onClick={() => go(START)}>Bryggehavn</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'havn', x: 24, y: 25, facing: 'down' })}>Fiske ved bryggen</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'skogstjern', x: 19, y: 16, facing: 'right' })}>Fiske ved tjernet</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'havn', x: 46, y: 16, facing: 'right' })}>Ved kartgrensen</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'hjem2', x: 4, y: 9, facing: 'left' })}>Ved garderoben</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'butikk', x: 12, y: 6, facing: 'up' })}>Ved butikkdisken</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'hjem2', x: 20, y: 5, facing: 'up' })}>Ved kisten</button>
      {NPCS.map(npc => <button key={npc.id} className="game-hud-button" onClick={() => go({ mapId: npc.mapId, x: npc.route[0][0], y: npc.route[0][1]+(npc.mapId === 'butikk' ? -1 : 1), facing: npc.mapId === 'butikk' ? 'down' : 'up' })}>Ved {npc.name}</button>)}
    </div>
    <p className="text-xs text-slate-400">Testposisjon: <output id="preview-position">{savedPosition.mapId}: {savedPosition.x}, {savedPosition.y}</output></p>
    </details>
  </main>
}
document.body.style.background = '#172e30'
const root = createRoot(document.querySelector('#root')!)
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
