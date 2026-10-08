// Advance exactly once per successful tile. Hold that image throughout travel;
// briefly settle at the endpoint when movement stops.
export const CHARACTER_WALK_SETTLE_MS = 70
export const PLAYER_WALK_SETTLE_MS = CHARACTER_WALK_SETTLE_MS
export function nextCharacterWalkPhase(previous: number, passingFrame?: number): number {
  return (previous + 1) % (passingFrame === undefined ? 2 : 4)
}

// Directions with a passing pose use A -> C -> B -> C over four tiles.
export function characterWalkTextureStep(phase: number, passingFrame?: number): number {
  const cycle = passingFrame === undefined ? [1, 2] : [1, passingFrame, 2, passingFrame]
  return cycle[phase % cycle.length]
}
// Retain the public player helper names for existing review tools.
export const nextPlayerWalkPhase = nextCharacterWalkPhase
export const playerWalkTextureStep = characterWalkTextureStep
