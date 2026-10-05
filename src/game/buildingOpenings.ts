import type Phaser from 'phaser'
import { TILE_SIZE, type WorldMap } from './world'
import { ENVIRONMENT_PALETTE as p, pixelPainter, type PixelPainter } from './environmentPixels'

export const DOOR_STANDARD = { width: 30, height: 64, groundY: 30 } as const
export const INDOOR_DOOR_STANDARD = { width: 30, height: 30, groundY: 30 } as const

export function windowRegion(map: WorldMap, col: number, row: number) {
  const cells: [number, number][] = [[col, row]], seen = new Set([`${col},${row}`])
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = cells[i]
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`
      if (map.tiles[ny]?.[nx] === 'window' && !seen.has(key)) { seen.add(key); cells.push([nx, ny]) }
    }
  }
  const left = Math.min(...cells.map(c => c[0])), top = Math.min(...cells.map(c => c[1]))
  const width = Math.max(...cells.map(c => c[0])) - left + 1, height = Math.max(...cells.map(c => c[1])) - top + 1
  if (width * height !== cells.length) throw new Error(`Window at ${map.id}:${col},${row} must be a rectangular tile block`)
  return { left, top, width, height }
}

// Slice one complete window into its map cells. Shared edges contain glass and
// mullions, never duplicate outer frames. Supports 1x1, 2x2, 3x2 and other rectangles.
export function drawWindow(r: PixelPainter, map: WorldMap, col: number, row: number) {
  const region = windowRegion(map, col, row)
  const width = region.width * TILE_SIZE, height = region.height * TILE_SIZE
  const ox = (col - region.left) * TILE_SIZE, oy = (row - region.top) * TILE_SIZE
  const paint: PixelPainter = (x, y, w, h, color, alpha = 1) => {
    const left = Math.max(x, ox), top = Math.max(y, oy)
    const right = Math.min(x + w, ox + TILE_SIZE), bottom = Math.min(y + h, oy + TILE_SIZE)
    if (right > left && bottom > top) r(left - ox, top - oy, right - left, bottom - top, color, alpha)
  }
  paint(3, 3, width - 6, height - 5, p.creamDark)
  paint(3, 2, width - 6, height - 8, p.timberDark)
  paint(4, 3, width - 8, height - 10, p.creamLight)
  paint(6, 5, width - 12, height - 14, p.timber)
  paint(7, 6, width - 14, height - 16, p.glass)
  paint(8, 6, width - 16, 3, p.glassLight)
  paint(7, height - 13, width - 14, 3, 0x365f72)
  for (let x = 11, y = 11; y < Math.min(height - 14, 30); x += 3, y += 3) {
    paint(x, y, 4, 3, 0x7faeb5)
    paint(x, y, 1, 2, p.glassLight)
  }
  const barsX = region.width === 1 ? [16] : Array.from({ length: region.width - 1 }, (_, i) => (i + 1) * TILE_SIZE)
  const barsY = region.height === 1 ? [16] : Array.from({ length: region.height - 1 }, (_, i) => (i + 1) * TILE_SIZE)
  for (const x of barsX) { paint(x - 1, 5, 3, height - 14, p.timber); paint(x - 1, 5, 2, height - 14, p.creamLight) }
  for (const y of barsY) { paint(5, y - 1, width - 10, 3, p.timber); paint(5, y - 1, width - 10, 2, p.creamLight) }
  paint(2, height - 8, width - 4, 3, p.timberDark)
  paint(2, height - 9, width - 4, 1, p.creamLight)
  paint(4, 3, width - 8, 1, p.creamLight)
}

export function drawDoor(r: PixelPainter, glazed = true) {
  const { width, height, groundY } = DOOR_STANDARD
  const left = (TILE_SIZE - width) / 2, top = groundY - height
  r(left, top, width, height, p.timberDark)
  r(left + 1, top + 1, width - 2, height - 1, p.timberLight)
  r(left + 3, top + 3, width - 6, height - 3, p.timber)
  r(left + 3, top + 3, 1, height - 4, 0xd7ae76)
  r(left + width - 4, top + 3, 1, height - 3, 0x795539)
  r(left + 5, top + 7, width - 10, 23, p.timberDark)
  r(left + 6, top + 8, width - 12, 21, glazed ? p.glass : p.timber)
  r(left + 6, top + 8, width - 12, 2, glazed ? p.glassLight : p.timberLight)
  if (glazed) {
    r(left + 8, top + 12, 3, 3, 0x7faeb5)
    r(15, top + 8, 2, 21, p.cream)
    r(left + 6, top + 18, width - 12, 2, p.cream)
  }
  r(left + 5, top + 36, width - 10, 22, p.timberDark)
  r(left + 6, top + 37, width - 12, 20, p.timber)
  r(left + 6, top + 37, width - 12, 1, p.timberLight)
  r(left + 8, top + 40, 1, 14, 0xa8794e)
  r(left + width - 9, top + 32, 3, 5, p.timberDark)
  r(left + width - 9, top + 32, 2, 3, 0xe6c57d)
  r(0, groundY, TILE_SIZE, 1, p.stoneLight)
  r(0, groundY + 1, TILE_SIZE, 1, p.stoneDark)
}

// Interior exits belong to the foreground boundary wall and fit inside one tile.
export function drawIndoorDoor(r: PixelPainter) {
  const { width, height, groundY } = INDOOR_DOOR_STANDARD
  const left = (TILE_SIZE - width) / 2, top = groundY - height
  r(left, top, width, height, p.timberDark)
  r(left + 1, top + 1, width - 2, height - 1, p.timberLight)
  r(left + 3, top + 3, width - 6, height - 3, p.timber)
  for (const y of [top + 5, top + 18]) {
    r(left + 5, y, width - 10, 9, p.timberDark)
    r(left + 6, y + 1, width - 12, 7, p.timber)
    r(left + 6, y + 1, width - 12, 1, p.timberLight)
  }
  r(left + width - 8, top + 14, 3, 4, p.timberDark)
  r(left + width - 8, top + 14, 2, 2, 0xe6c57d)
  r(0, groundY, TILE_SIZE, 1, p.stoneLight)
  r(0, groundY + 1, TILE_SIZE, 1, p.stoneDark)
}

// Only exterior doors extend above a tile. Paint these after the ground so the
// upper part cannot be covered by a neighbouring cell. Interior doors are objects.
export function drawBuildingDoors(g: Phaser.GameObjects.Graphics, map: WorldMap) {
  const outdoor = map.id === 'havn' || map.id === 'skogstjern'
  if (!outdoor) return
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    if (map.tiles[y][x] === 'door') drawDoor(pixelPainter(g, x * TILE_SIZE, y * TILE_SIZE))
  }
}
