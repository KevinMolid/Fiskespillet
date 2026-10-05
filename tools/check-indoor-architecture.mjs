import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/game/indoorTiles.ts', 'src/game/indoorArchitecture.ts', 'src/game/world.ts', 'src/game/environmentPixels.ts'], outdir: 'unused', bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const [tiles, art, world, pixels] = await Promise.all(bundle.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { MAPS, HOME_STAIRS, TILE_SIZE, isWalkable, stepTransition } = world
const p = pixels.ENVIRONMENT_PALETTE
function rasterCell(map, x, y, draw = tiles.drawIndoorGround) {
  const raster = new Uint32Array(32 * 32)
  let color
  const g = {
    fillStyle(c) { color = c; return this },
    fillRect(px, py, w, h) {
      const lx = px - x * 32, ly = py - y * 32
      assert([px, py, w, h].every(Number.isInteger) && w > 0 && h > 0)
      assert(lx >= 0 && ly >= 0 && lx + w <= 32 && ly + h <= 32)
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) raster[yy * 32 + xx] = color
      return this
    },
  }
  draw(g, map, x, y)
  return (px, py) => raster[py * 32 + px]
}

const wallMap = { id: 'hjem', tiles: Array.from({ length: 5 }, (_, y) => ['floor', y > 0 && y < 4 ? 'wall' : 'floor', 'floor']) }
for (const row of [1, 2, 3]) {
  const at = rasterCell(wallMap, 1, row)
  for (let y = 0; y < 32; y++) {
    const phase = (row * 32 + y) % 6
    const surface = phase === 0 ? p.creamDark : phase === 1 ? p.creamLight : p.cream
    const expected = row === 3 && y >= 27 ? (y === 27 ? p.timberLight : p.timberDark) : surface
    for (const x of [0, 4, 16, 27, 31]) assert.equal(at(x, y), expected, 'Only the lowest wall block has bottom trim; no top/side trim or repeated seam boards')
  }
}
const boundaryWall = rasterCell({ id: 'hjem', tiles: [['wall']] }, 0, 0)
assert.equal(boundaryWall(16, 27), p.timberLight, 'A run ending at the map edge still has a bottom board')
assert.equal(boundaryWall(16, 31), p.timberDark)

// The installed three-tile kitchen worktop has no drawers or shadows at seams.
for (const row of [5, 6, 7]) {
  const at = rasterCell(MAPS.hjem, 2, row, tiles.drawIndoorObject)
  if (row < 7) {
    assert.equal(at(14, 16), p.cream, 'Upper worktop cells must not show cabinet handles')
    assert.equal(at(14, 31), p.cream, 'Worktop reaches the next cell without a front lip')
    assert.equal(at(31, 28), 0, 'No per-cell floor shadow along the vertical run')
  } else {
    assert.equal(at(14, 16), p.metalLight, 'The bottom cabinet keeps its handle')
    assert.equal(at(7, 14), p.timberLight, 'Only the bottom cell exposes the cabinet front')
  }
  if (row > 5) assert.equal(at(14, 0), p.cream, 'Adjoining worktop starts immediately at the tile seam')
}

assert(tiles.isIndoorObject('door'), 'Interior doors need independent foreground objects')
for (const id of ['hjem', 'butikk']) {
  const map = MAPS[id], row = map.tiles.length - 1
  rasterCell(map, 12, row, tiles.drawIndoorObject) // all door artwork fits inside 32x32
  assert(art.indoorObjectDepth('door', row) > row * TILE_SIZE + 16, 'Door stays ahead of the player until the exit tween ends')
}

const { x, upperY, lowerY } = HOME_STAIRS
assert.equal(lowerY - upperY + 1, 5)
for (const id of ['hjem', 'hjem2']) {
  const map = MAPS[id]
  assert.equal(x, map.tiles[0].length - 2, 'Staircase touches the right corner wall')
  assert.equal(upperY, 1, 'The upper landing touches the top wall')
  assert.equal(map.tiles[upperY][x], 'floor')
  assert.equal(map.tiles[lowerY][x], 'floor')
  assert.equal(map.tiles.flat().filter(t => t === 'stairs').length, 3)
  for (let row = upperY + 1; row < lowerY; row++) {
    assert.equal(map.tiles[row][x], 'stairs')
    assert(isWalkable(map.tiles[row][x - 1]), 'Access beside the stairs remains open')
    const at = rasterCell(map, x, row)
    assert.equal(at(2, 16), p.timberLight)
    if (row > upperY + 1) assert.equal(at(2, 0), p.timberLight, 'Rail joins the previous tile')
    if (row < lowerY - 1) assert.equal(at(2, 31), p.timberLight, 'Rail joins the next tile')
  }
}
const up = stepTransition({ mapId: 'hjem', x, y: upperY, facing: 'up' })
const down = stepTransition({ mapId: 'hjem2', x, y: lowerY, facing: 'down' })
assert.deepEqual(up, { mapId: 'hjem2', x, y: upperY, facing: 'down' })
assert.deepEqual(down, { mapId: 'hjem', x, y: lowerY, facing: 'down' })
assert.equal(stepTransition(up), null, 'Arrival landing must not immediately return to the previous floor')
assert.equal(stepTransition(down), null)
assert.equal(MAPS.hjem.tiles[4][19], 'floor')
assert.equal(MAPS.hjem2.tiles[11][19], 'floor')
console.log('Indoor architecture: bottom-only trim on the lowest wall block, continuous wall seams, one-tile foreground doors, joined three-tile corner stairs, free landings and safe two-way destinations passed.')
