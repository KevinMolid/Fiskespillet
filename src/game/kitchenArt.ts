import { ENVIRONMENT_PALETTE as p, type PixelPainter } from './environmentPixels'
import type { Tile } from './world'

export const isKitchenFixture = (tile: Tile) => ['fridge', 'bin', 'chairUp', 'chairDown'].includes(tile)

export function drawSink(r: PixelPainter) {
  r(4, 0, 24, 12, p.metalDark)
  r(5, 1, 22, 10, p.metalLight)
  r(7, 3, 17, 7, p.metal)
  r(8, 4, 15, 5, 0x638b91)
  r(9, 4, 12, 1, p.glassLight)
  r(15, 7, 3, 2, p.metalDark)
  r(16, 7, 1, 1, p.metalLight)
  // Raised tap and spout behind the basin.
  r(22, -6, 3, 9, p.metalDark)
  r(22, -6, 2, 8, p.metalLight)
  r(17, -6, 7, 2, p.metalLight)
  r(17, -5, 2, 3, p.metal)
  r(10, -1, 3, 2, p.metalDark)
  r(10, -1, 2, 1, p.metalLight)
}

export function drawKitchenFixture(r: PixelPainter, tile: Tile) {
  if (tile === 'fridge') {
    // 60px tall; its base remains inside the existing blocking tile.
    r(3, -30, 26, 60, p.metalDark)
    r(4, -29, 24, 57, p.creamLight)
    r(5, -29, 22, 2, p.metalLight)
    r(5, -26, 21, 17, p.cream)
    r(6, -25, 19, 1, p.creamLight)
    r(5, -8, 21, 1, p.metalDark)
    r(5, -6, 21, 32, p.cream)
    r(6, -5, 19, 1, p.creamLight)
    r(27, -28, 2, 56, p.creamDark)
    for (const [y, h] of [[-22, 7], [1, 12]]) {
      r(23, y, 2, h, p.metalDark)
      r(23, y, 1, h - 1, p.metalLight)
    }
    r(6, 28, 20, 2, p.metalDark)
    r(8, 28, 2, 1, p.metalLight)
    r(14, 28, 2, 1, p.metalLight)
    r(20, 28, 2, 1, p.metalLight)
  } else if (tile === 'bin') {
    r(8, 10, 17, 20, p.metalDark)
    r(9, 11, 15, 17, 0x607a6a)
    r(10, 12, 2, 14, 0x8ca18a)
    r(22, 12, 2, 16, 0x455e52)
    for (const x of [14, 18]) r(x, 13, 1, 14, 0x4e6859)
    r(7, 7, 19, 4, p.metalDark)
    r(8, 7, 17, 2, p.metalLight)
    r(14, 4, 6, 3, p.metalDark)
    r(15, 4, 4, 1, p.metalLight)
    r(10, 28, 13, 2, p.metalDark)
  } else if (tile === 'chairUp' || tile === 'chairDown') {
    const up = tile === 'chairUp'
    for (const x of [6, 24]) { r(x, 17, 3, 13, p.timberDark); r(x, 18, 1, 10, p.timberLight) }
    if (!up) {
      r(4, -8, 24, 20, p.timberDark)
      r(5, -7, 22, 3, p.timberLight)
      for (const x of [6, 13, 20]) { r(x, -3, 5, 11, p.timber); r(x, -3, 1, 10, p.timberLight) }
    }
    const seatY = up ? 3 : 10
    r(4, seatY, 24, 15, p.timberDark)
    r(5, seatY + 1, 22, 12, p.timber)
    r(5, seatY + 1, 22, 1, p.timberLight)
    r(7, seatY + 5, 18, 1, 0xa4784b)
    if (up) {
      r(4, 17, 24, 10, p.timberDark)
      r(5, 18, 22, 3, p.timberLight)
      for (const x of [6, 13, 20]) r(x, 22, 5, 4, p.timber)
    }
  }
}

export function drawPlaceSetting(r: PixelPainter) {
  // A stepped ceramic plate, fork and cup, all native integer pixels.
  r(9, 8, 12, 2, p.creamDark)
  r(7, 10, 16, 8, p.creamDark)
  r(9, 18, 12, 2, p.creamDark)
  r(9, 9, 12, 2, p.creamLight)
  r(8, 11, 14, 6, p.creamLight)
  r(10, 17, 10, 2, p.creamLight)
  r(11, 12, 8, 4, p.cream)
  r(4, 9, 1, 11, p.metalLight)
  r(3, 9, 3, 3, p.metalLight)
  r(26, 9, 1, 11, p.metalLight)
  r(24, 3, 5, 5, p.fabric)
  r(25, 3, 3, 1, p.fabricLight)
  r(29, 4, 1, 3, p.fabricLight)
}
