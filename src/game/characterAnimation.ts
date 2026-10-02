/** Two opposite step poses during each existing tile tween; idle at rest. */
export function characterWalkStep(moving: boolean, progress: number): 0 | 1 | 2 {
  if (!moving) return 0
  return progress >= .5 ? 2 : 1
}
