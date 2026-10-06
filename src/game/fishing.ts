import { FISHING_ZONES, type CastLength, type FishingConditions, type FishingFeature, type FishingDepth, type RetrieveSpeed } from './fish'
import { MAPS, type Position } from './world'

export type CastTarget = {
  id: number
  castLength: CastLength
  label: string
  steps: number
  x: number
  y: number
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
      x,
      y,
      feature,
      featureName: feature === 'reeds' ? 'sivkant' : feature === 'rocky' ? 'stein' : feature === 'dock' ? 'bryggekant' : 'åpent vann',
      description: `Ute ved ${feature === 'reeds' ? 'sivet' : feature === 'rocky' ? 'steinene' : feature === 'dock' ? 'brygga' : 'åpent vann'}`,
    }
  })
}

export function fishingConditions(bait: FishingConditions['bait'], target: CastTarget, depth: FishingDepth, retrieve: RetrieveSpeed): FishingConditions {
  return { bait, castLength: target.castLength, feature: target.feature, depth, retrieve }
}

// One continuous descent: choose a fishing layer before the hook hits bottom.
export const SINK_DURATION_MS = 6000
export const CAST_SPLASH_DURATION_MS = 900
// Longer casts travel farther before landing; the depth timer starts afterwards.
export function castFlightDuration(steps: number) { return 700 + Math.max(1, Math.min(5, steps)) * 140 }
export function sinkingState(elapsedMs: number): { progress: number; depth: FishingDepth; snagged: boolean } {
  const progress = Math.max(0, Math.min(1, elapsedMs / SINK_DURATION_MS))
  return { progress, depth: progress < .28 ? 'surface' : progress < .7 ? 'midwater' : 'bottom', snagged: progress >= 1 }
}

// Keep the whole 10 px hook shadow inside water beyond the half-tile bank edge.
export const RETRIEVE_SHORE_DISTANCE = .7
const REEL_DECAY_MS = 650
const REEL_TAP_BOOST = .28
const REEL_TILES_PER_SECOND = 1.35
export type ReelState = { speed: number; remainingTiles: number }
export function tapReel(state: ReelState): ReelState {
  return { ...state, speed: Math.min(1, state.speed + REEL_TAP_BOOST) }
}
/** Integrate decaying reel momentum, independent of rendering frame rate. */
export function advanceReel(state: ReelState, elapsedMs: number): { state: ReelState; averageSpeed: number } {
  const ms = Math.max(0, elapsedMs)
  const decay = Math.exp(-ms / REEL_DECAY_MS)
  const integralMs = state.speed * REEL_DECAY_MS * (1 - decay)
  const speed = state.speed * decay
  return { state: { speed: speed < .005 ? 0 : speed,
    remainingTiles: Math.max(0, state.remainingTiles - integralMs / 1000 * REEL_TILES_PER_SECOND) },
    averageSpeed: ms ? integralMs / ms : state.speed }
}
export function retrieveSpeed(speed: number): RetrieveSpeed { return speed < .33 ? 'slow' : speed < .67 ? 'steady' : 'fast' }
// Per-time opportunity, not a one-off roll when the depth is chosen.
export function retrieveBiteOpportunity(elapsedMs: number, speed: number) {
  return speed > .03 ? 1 - Math.exp(-.32 * Math.max(0, elapsedMs) / 1000) : 0
}
export function retrieveTarget(position: Position, original: CastTarget, remainingTiles: number) {
  const steps = Math.max(1, Math.min(original.steps, Math.ceil(remainingTiles + RETRIEVE_SHORE_DISTANCE)))
  return castTargets(position).find(target => target.steps === steps) ?? original
}

export type FightState = { tension: number; progress: number; elapsedMs: number; pulling: boolean }
export type FightOutcome = 'landed' | 'escaped' | null

/** A small, deterministic line-tension step so the minigame is straightforward to test. */
export function advanceFight(state: FightState, reeling: boolean | number, fightStrength: number, stepMs = 100): { state: FightState; outcome: FightOutcome } {
  const elapsedMs = state.elapsedMs + stepMs
  const pulling = elapsedMs % 2100 < 700
  const seconds = stepMs / 1000
  const intensity = typeof reeling === 'boolean' ? Number(reeling) : Math.max(0, Math.min(1, reeling))
  const tensionChange = intensity * (pulling ? 21 * fightStrength : 1.2) + (1 - intensity) * (pulling ? -10 : -2.2)
  const tension = Math.max(0, Math.min(100, state.tension + tensionChange * seconds))
  const progress = Math.min(100, state.progress + intensity * (pulling ? 2.5 : 12.5) * seconds)
  const next = { tension, progress, elapsedMs, pulling }
  if (tension >= 100 || elapsedMs >= 22_000) return { state: next, outcome: 'escaped' }
  if (progress >= 100) return { state: next, outcome: 'landed' }
  return { state: next, outcome: null }
}

export const FISHING_ZONE_NAMES = Object.fromEntries(Object.entries(FISHING_ZONES).map(([id, zone]) => [id, zone.name])) as Record<string, string>
