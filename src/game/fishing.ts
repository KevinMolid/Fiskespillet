import { FISHING_ZONES, type CastLength, type FishingConditions, type FishingFeature, type FishingDepth, type RetrieveSpeed } from './fish'
import { MAPS, type Position } from './world'

export type CastTarget = {
  id: number
  castLength: CastLength
  label: string
  steps: number
  feature: FishingFeature
  featureName: string
  description: string
}

const CAST_OPTIONS: { castLength: CastLength; label: string; steps: number }[] = [
  { castLength: 'short', label: 'Kort', steps: 1 },
  { castLength: 'short', label: 'Kort', steps: 2 },
  { castLength: 'medium', label: 'Middels', steps: 3 },
  { castLength: 'long', label: 'Langt', steps: 4 },
  { castLength: 'long', label: 'Langt', steps: 5 },
]

const DELTA = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
} as const

function waterFeature(mapId: Position['mapId'], x: number, y: number): FishingFeature {
  const map = MAPS[mapId]
  const hasNeighbor = (predicate: (x: number, y: number) => boolean) =>
    [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => predicate(x + dx, y + dy))
  if (map.decorations?.some(d => d.kind === 'reeds' && Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1)) return 'reeds'
  if (hasNeighbor((nx, ny) => map.tiles[ny]?.[nx] === 'rock')) return 'rocky'
  if (hasNeighbor((nx, ny) => map.tiles[ny]?.[nx] === 'dock')) return 'dock'
  return 'open'
}

/** Build every one-tile cast distance that stays within the water directly ahead. */
export function castTargets(position: Position): CastTarget[] {
  const map = MAPS[position.mapId]
  if (!map.fishingZone) return []
  const [dx, dy] = DELTA[position.facing]
  const waterSteps = new Set<number>()
  for (let step = 1; step <= 5; step++) {
    const x = position.x + dx * step
    const y = position.y + dy * step
    if (map.tiles[y]?.[x] !== 'water') break
    waterSteps.add(step)
  }
  return CAST_OPTIONS.filter(option => waterSteps.has(option.steps)).map(option => {
    const x = position.x + dx * option.steps
    const y = position.y + dy * option.steps
    const feature = waterFeature(position.mapId, x, y)
    return {
      ...option,
      id: option.steps,
      feature,
      featureName: feature === 'reeds' ? 'sivkant' : feature === 'rocky' ? 'stein' : feature === 'dock' ? 'bryggekant' : 'åpent vann',
      description: `Ute ved ${feature === 'reeds' ? 'sivet' : feature === 'rocky' ? 'steinene' : feature === 'dock' ? 'brygga' : 'åpent vann'}`,
    }
  })
}

export function fishingConditions(bait: FishingConditions['bait'], target: CastTarget, depth: FishingDepth, retrieve: RetrieveSpeed): FishingConditions {
  return { bait, castLength: target.castLength, feature: target.feature, depth, retrieve }
}

export type FightState = { tension: number; progress: number; elapsedMs: number; pulling: boolean }
export type FightOutcome = 'landed' | 'escaped' | null

/** A small, deterministic line-tension step so the minigame is straightforward to test. */
export function advanceFight(state: FightState, reeling: boolean, fightStrength: number, stepMs = 100): { state: FightState; outcome: FightOutcome } {
  const elapsedMs = state.elapsedMs + stepMs
  const pulling = elapsedMs % 2100 < 700
  const seconds = stepMs / 1000
  const tensionChange = reeling
    ? (pulling ? 21 * fightStrength : 1.2)
    : (pulling ? -10 : -2.2)
  const tension = Math.max(0, Math.min(100, state.tension + tensionChange * seconds))
  const progress = Math.min(100, state.progress + (reeling ? (pulling ? 2.5 : 12.5) * seconds : 0))
  const next = { tension, progress, elapsedMs, pulling }
  if (tension >= 100 || elapsedMs >= 22_000) return { state: next, outcome: 'escaped' }
  if (progress >= 100) return { state: next, outcome: 'landed' }
  return { state: next, outcome: null }
}

export const FISHING_ZONE_NAMES = Object.fromEntries(Object.entries(FISHING_ZONES).map(([id, zone]) => [id, zone.name])) as Record<string, string>
