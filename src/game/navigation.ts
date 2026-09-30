import type { Direction } from './world'

export type NavPoint = { x: number; y: number }
// Prefer the same row/column, then the closest control in the requested direction.
export function nextControl(points: NavPoint[], current: number, direction: Direction): number {
  if (!points.length) return -1
  if (current < 0 || current >= points.length) return 0
  const origin = points[current]
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'left' || direction === 'up' ? -1 : 1
  let best = current, score = Infinity
  points.forEach((point, i) => {
    const primary = ((horizontal ? point.x - origin.x : point.y - origin.y)) * sign
    const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x)
    if (primary < 2) return
    const candidate = primary + cross * 3
    if (candidate < score) { score = candidate; best = i }
  })
  return best
}

export class HoldRepeater {
  private timer: ReturnType<typeof setInterval> | undefined
  start(action: () => void) {
    this.stop()
    action()
    this.timer = setInterval(action, 150)
  }
  stop() {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
  }
}
