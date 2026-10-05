import type { WorldMap } from './world'
import { ENVIRONMENT_PALETTE as p, type PixelPainter } from './environmentPixels'

export const FENCE_PICKET_SPACING = 16
export const FENCE_LINK = { north: 1, east: 2, south: 4, west: 8 } as const

export function fenceConnections(map: WorldMap, col: number, row: number) {
  return (map.tiles[row - 1]?.[col] === 'fence' ? FENCE_LINK.north : 0)
    | (map.tiles[row]?.[col + 1] === 'fence' ? FENCE_LINK.east : 0)
    | (map.tiles[row + 1]?.[col] === 'fence' ? FENCE_LINK.south : 0)
    | (map.tiles[row]?.[col - 1] === 'fence' ? FENCE_LINK.west : 0)
}

export function drawFence(r: PixelPainter, links: number) {
  const north = !!(links & FENCE_LINK.north), south = !!(links & FENCE_LINK.south)
  const east = !!(links & FENCE_LINK.east), west = !!(links & FENCE_LINK.west)
  const horizontal = east || west || !links
  // Clip boundary pickets to their own tile. Adjacent halves form one full
  // picket, keeping the 16px rhythm across seams without doubled shadows.
  const paint: PixelPainter = (x, y, width, height, color, alpha = 1) => {
    const left = Math.max(0, x), right = Math.min(32, x + width)
    if (right > left && height > 0) r(left, y, right - left, height, color, alpha)
  }
  if (north || south) {
    const top = north ? 0 : 27, bottom = south ? 32 : 27
    paint(17, top, 4, bottom - top, p.grassDeep, 0.25)
    paint(15, top, 4, bottom - top, p.timberDark)
    paint(15, top, 1, bottom - top, p.creamDark)
    // Edge-on boards: one 5px-wide row, with discrete pointed top ends.
    // This phase repeats seamlessly every 16px along the world Y axis.
    for (const base of [11, 27]) {
      if (base < top || base > bottom) continue
      paint(14, base - 7, 5, 8, p.timberDark)
      paint(15, base - 9, 2, 2, p.cream)
      paint(14, base - 7, 4, 8, p.cream)
      paint(14, base - 6, 1, 6, p.creamLight)
      paint(17, base - 6, 1, 6, p.creamDark)
      paint(15, base - 7, 2, 1, p.creamLight)
    }
  }
  if (horizontal) {
    const left = west || !links ? 0 : 16, right = east || !links ? 32 : 16
    paint(left, 27, right - left, 3, p.grassDeep, 0.25)
    paint(left, 13, right - left, 4, p.timberDark)
    paint(left, 12, right - left, 3, p.cream)
    paint(left, 12, right - left, 1, p.creamLight)
    paint(left, 23, right - left, 3, p.timberDark)
    paint(left, 22, right - left, 2, p.cream)
  }
  const post = (center: number, corner = false) => {
    const x = center - (corner ? 3 : 2), width = corner ? 6 : 4
    paint(x, 7, width + 1, 24, p.timberDark)
    paint(x, 5, width, 25, p.cream)
    paint(center - 1, 3, 2, 2, p.cream)
    paint(x, 6, 1, 22, p.creamLight)
    paint(x + width - 1, 8, 1, 21, p.creamDark)
    paint(center - 1, 14, 1, 1, p.metalDark)
    paint(center - 1, 23, 1, 1, p.metalDark)
  }
  if (horizontal) {
    if (west || !links) post(0)
    post(16, (north || south) && (east || west))
    if (east || !links) post(32)
  } else if (!north || !south) post(16)
}
