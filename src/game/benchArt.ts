import { ENVIRONMENT_PALETTE as p, woodGrain, type PixelPainter } from './environmentPixels'

// One bench spans two horizontal map cells, with one continuous set of planks.
export const BENCH_WIDTH_TILES = 2

export function drawBench(r: PixelPainter, width: number) {
  r(1, 28, width - 2, 3, p.grassDeep, 0.3)
  // Rear uprights run from the backrest down through the seat to the feet.
  // Draw them first so both wooden sections visibly attach to the same frame.
  for (const x of [5, width - 8]) {
    r(x, 3, 3, 27, p.metalDark)
    r(x, 11, 1, 7, p.metalLight)
    r(x, 26, 1, 3, p.metal)
  }
  woodGrain(r, 2, 2, width - 4, 4)
  woodGrain(r, 2, 7, width - 4, 4, 8)
  // Front legs and arm supports connect to the underside of the seat.
  for (const x of [3, width - 6]) {
    r(x, 15, 3, 15, p.metalDark)
    r(x, 16, 1, 5, p.metalLight)
  }
  woodGrain(r, 1, 18, width - 2, 4, 4)
  woodGrain(r, 1, 23, width - 2, 3, 12)
  for (const x of [2, width - 8]) {
    r(x, 14, 6, 3, p.metalDark)
    r(x, 14, 6, 1, p.metalLight)
  }
  for (const x of [6, width - 7]) {
    r(x, 4, 1, 1, p.metalDark)
    r(x, 9, 1, 1, p.metalDark)
  }
}
