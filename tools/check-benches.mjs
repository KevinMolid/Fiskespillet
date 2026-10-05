import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ stdin: { contents: "export * from './src/game/world'; export * from './src/game/outdoorTiles'; export * from './src/game/benchArt'; export * from './src/game/environmentPixels'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const { MAPS, TILE_SIZE, BENCH_WIDTH_TILES, drawDecoration, drawOutdoorGround, isWalkable, ENVIRONMENT_PALETTE: p } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(BENCH_WIDTH_TILES, 2)
const width = TILE_SIZE * BENCH_WIDTH_TILES, raster = new Uint32Array(width * TILE_SIZE)
let color, alpha
const g = {
  fillStyle(c, a = 1) { color = c; alpha = a; return this },
  fillRect(x, y, w, h) {
    assert([x, y, w, h].every(Number.isInteger) && w > 0 && h > 0)
    assert(x >= 0 && y >= 0 && x + w <= width && y + h <= TILE_SIZE)
    if (alpha === 1) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) raster[yy * width + xx] = color
    return this
  },
}
drawDecoration(g, { kind: 'bench', x: 0, y: 0 })
// Every opaque pixel belongs to one connected frame; back and seat cannot float.
const opaque = raster.map(c => c ? 1 : 0), start = opaque.findIndex(Boolean), seen = new Set([start]), queue = [start]
for (let i = 0; i < queue.length; i++) {
  const index = queue[i], x = index % width, y = Math.floor(index / width)
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nx = x + dx, ny = y + dy, next = ny * width + nx
    if (nx >= 0 && nx < width && ny >= 0 && ny < TILE_SIZE && opaque[next] && !seen.has(next)) { seen.add(next); queue.push(next) }
  }
}
assert.equal(seen.size, opaque.reduce((sum, pixel) => sum + pixel, 0), 'Backrest, seat, arms and legs form one connected bench')
for (const y of [2, 3, 4, 5, 7, 8, 9, 10, 18, 19, 20, 21, 23, 24, 25]) {
  assert(raster[y * width + 31], 'Wooden plank reaches the tile join')
  assert.equal(raster[y * width + 31], raster[y * width + 32], 'No seam or duplicate end cap between bench halves')
}
for (const id of ['havn', 'skogstjern']) {
  const map = MAPS[id], benches = map.decorations.filter(d => d.kind === 'bench')
  assert.equal(benches.length, 1, 'Each installed bench is one complete decoration')
  const bench = benches[0]
  for (let dx = 0; dx < BENCH_WIDTH_TILES; dx++) {
    const x = bench.x + dx, y = bench.y
    assert.equal(map.tiles[y][x], 'furniture')
    assert(!isWalkable(map.tiles[y][x]), 'Both horizontal halves block normal movement')
    assert(isWalkable(map.tiles[y - 1][x]) && isWalkable(map.tiles[y + 1][x]), 'The paths in front and behind remain open')
    let groundColor
    drawOutdoorGround({ fillStyle(c) { groundColor = c; return this }, fillRect(px, py, w, h) {
      if (px <= x * 32 + 16 && px + w > x * 32 + 16 && py <= y * 32 + 16 && py + h > y * 32 + 16) color = groundColor
      return this
    } }, map, x, y)
    assert.equal(color, bench.ground === 'path' ? p.sand : p.grass, 'Both cells preserve their original ground material')
  }
}
console.log('Benches: continuous two-tile planks, connected back/seat/arms/legs, both cells blocking, preserved ground and open front/back paths passed.')
