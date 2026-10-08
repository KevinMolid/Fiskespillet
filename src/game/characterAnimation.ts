/** Two opposite step poses during each existing tile tween; idle at rest. */
export function characterWalkStep(moving: boolean, progress: number): 0 | 1 | 2 {
  if (!moving) return 0
  return progress >= .5 ? 2 : 1
}

// Advance exactly once per successful tile. Hold that image through the tween
// and existing inter-tile gap; stop promptly on release.
export const PLAYER_WALK_SETTLE_MS = 70
export function nextPlayerWalkPhase(previous: number, passingFrame?: number): number {
  return (previous + 1) % (passingFrame === undefined ? 2 : 4)
}

// Right: A -> C -> B -> C over four tiles. Other directions keep A -> B.
export function playerWalkTextureStep(phase: number, passingFrame?: number): number {
  const cycle = passingFrame === undefined ? [1, 2] : [1, passingFrame, 2, passingFrame]
  return cycle[phase % cycle.length]
}
