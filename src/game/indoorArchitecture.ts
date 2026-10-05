import { TILE_SIZE, type WorldMap, type Tile } from './world'
import { ENVIRONMENT_PALETTE as p, type PixelPainter } from './environmentPixels'

const wallPlane = (tile?: Tile) => tile === 'wall' || tile === 'window' || tile === 'door'

export function drawIndoorWall(r: PixelPainter, map: WorldMap, col: number, row: number) {
  // The board rhythm is measured in world pixels, so it never restarts at a seam.
  r(0, 0, TILE_SIZE, TILE_SIZE, p.cream)
  for (let y = 0; y < TILE_SIZE; y++) {
    const phase = (row * TILE_SIZE + y) % 6
    if (phase === 1) r(0, y, TILE_SIZE, 1, p.creamLight)
    if (phase === 0) r(0, y, TILE_SIZE, 1, p.creamDark)
  }
  // Only the last block of a vertical wall run has a bottom skirting board,
  // including runs that end at the map boundary. No side or top trim.
  if (!wallPlane(map.tiles[row + 1]?.[col])) { r(0, 27, 32, 5, p.timberDark); r(0, 27, 32, 1, p.timberLight) }
}

export function drawIndoorStairs(r: PixelPainter, map: WorldMap, col: number, row: number) {
  const joinsAbove = map.tiles[row - 1]?.[col] === 'stairs'
  const joinsBelow = map.tiles[row + 1]?.[col] === 'stairs'
  r(2, 0, 28, 32, p.timberDark)
  for (let y = 0; y < 32; y += 8) {
    r(4, y, 24, 6, p.timber)
    r(4, y, 24, 1, p.timberLight)
    r(4, y + 6, 24, 2, 0x463b30)
  }
  r(2, 0, 2, 32, p.timberLight)
  r(28, 0, 2, 32, p.timber)
  if (!joinsAbove) r(2, 0, 28, 1, p.timberLight)
  if (!joinsBelow) r(2, 31, 28, 1, p.timberDark)
  if (!joinsAbove) {
    const down = map.id === 'hjem2'
    r(15, down ? 12 : 10, 2, 1, p.creamLight)
    r(13, 11, 6, 1, p.creamLight)
    r(11, down ? 10 : 12, 10, 1, p.creamLight)
  }
}

export function indoorObjectDepth(tile: Tile, row: number) {
  // Exit panels are on the front edge of the boundary wall. This also keeps the
  // panel in front during the last movement tween before the map transition.
  return tile === 'door' ? (row + 1) * TILE_SIZE : row * TILE_SIZE + TILE_SIZE / 2
}
