/** Two opposite step poses during each existing tile tween; idle at rest. */
export function characterWalkStep(moving: boolean, progress: number): 0 | 1 | 2 {
  if (!moving) return 0
  return progress >= .5 ? 2 : 1
}

// A player tile is one footfall, rather than a complete A/B cycle in 115 ms.
// Keep its pose through the existing 30 ms keyboard gap; stop promptly on release.
export const PLAYER_WALK_SETTLE_MS = 70
export function nextPlayerWalkStep(previous: 1 | 2): 1 | 2 {
  return previous === 1 ? 2 : 1
}
