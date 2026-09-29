import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_APPEARANCE, FISH_BY_ID, isAppearance, isPosition, START, type Appearance, type Position } from './world'

export type FishBookEntry = {
  speciesId: string
  seenCount: number
  caughtCount: number
  smallestGrams: number | null
  largestGrams: number | null
  lastGrams: number | null
  firstSeenAt: Timestamp
  firstCaughtAt: Timestamp | null
  updatedAt: Timestamp
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
  return snapshot.docs.map(entry => entry.data() as FishBookEntry)
}

export async function recordEncounter(uid: string, speciesId: string, grams: number, caught: boolean) {
  if (!FISH_BY_ID[speciesId]) throw new Error('Ukjent fisk.')
  const ref = doc(database(), 'fishBooks', uid, 'entries', speciesId)
  await runTransaction(database(), async transaction => {
    const snapshot = await transaction.get(ref)
    const previous = snapshot.exists() ? snapshot.data() as FishBookEntry : null
    const caughtCount = (previous?.caughtCount ?? 0) + (caught ? 1 : 0)
    transaction.set(ref, {
      speciesId,
      seenCount: (previous?.seenCount ?? 0) + 1,
      caughtCount,
      smallestGrams: caught ? Math.min(previous?.smallestGrams ?? grams, grams) : previous?.smallestGrams ?? null,
      largestGrams: caught ? Math.max(previous?.largestGrams ?? grams, grams) : previous?.largestGrams ?? null,
      lastGrams: caught ? grams : previous?.lastGrams ?? null,
      firstSeenAt: previous?.firstSeenAt ?? serverTimestamp(),
      firstCaughtAt: previous?.firstCaughtAt ?? (caught ? serverTimestamp() : null),
      updatedAt: serverTimestamp(),
    })
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
