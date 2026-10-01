import type { Timestamp } from 'firebase/firestore'
import { FISH_BY_ID, FISHING_ZONES, weightCeiling } from './fish'

// Keep the existing gram/count field names so old records remain usable.
export type FishBookEntry = {
  speciesId: string
  hasCaught: boolean
  seenCount: number
  caughtCount: number
  smallestGrams: number | null
  largestGrams: number | null
  lastGrams: number | null
  discoveredLocationIds: string[]
  firstSeenAt: Timestamp
  firstCaughtAt: Timestamp | null
  updatedAt: Timestamp
}
export type LegacyFishBookEntry = Omit<FishBookEntry, 'hasCaught' | 'discoveredLocationIds'> & Partial<Pick<FishBookEntry, 'hasCaught' | 'discoveredLocationIds'>>

export function normalizeFishBookEntry(entry: LegacyFishBookEntry): FishBookEntry {
  const hasCaught = entry.caughtCount > 0
  return { ...entry, hasCaught, discoveredLocationIds: hasCaught
    ? [...new Set((entry.discoveredLocationIds ?? []).filter(id => Object.hasOwn(FISHING_ZONES, id)))] : [] }
}

export function updateFishBookEntry(previous: LegacyFishBookEntry | null, speciesId: string, grams: number, caught: boolean, locationId: string, now: Timestamp): FishBookEntry {
  const fish = FISH_BY_ID[speciesId]
  if (!fish || !Object.hasOwn(FISHING_ZONES, locationId)) throw new Error('Ukjent fisk eller fangststed.')
  if (!Number.isInteger(grams) || grams < fish.minGrams || grams > weightCeiling(fish)) throw new Error('Ugyldig fiskevekt.')
  if (previous && previous.speciesId !== speciesId) throw new Error('Fangsten gjelder en annen art.')
  const old = previous ? normalizeFishBookEntry(previous) : null
  const locations = old?.discoveredLocationIds ?? []
  const caughtCount = (old?.caughtCount ?? 0) + (caught ? 1 : 0)
  return {
    speciesId, hasCaught: caughtCount > 0,
    seenCount: (old?.seenCount ?? 0) + 1, caughtCount,
    smallestGrams: caught ? Math.min(old?.smallestGrams ?? grams, grams) : old?.smallestGrams ?? null,
    largestGrams: caught ? Math.max(old?.largestGrams ?? grams, grams) : old?.largestGrams ?? null,
    lastGrams: caught ? grams : old?.lastGrams ?? null,
    discoveredLocationIds: caught ? [...new Set([...locations, locationId])] : [...locations],
    firstSeenAt: old?.firstSeenAt ?? now,
    firstCaughtAt: old?.firstCaughtAt ?? (caught ? now : null), updatedAt: now,
  }
}
