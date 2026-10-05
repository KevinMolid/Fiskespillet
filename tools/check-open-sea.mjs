import assert from 'node:assert/strict'
import { build } from 'esbuild'
const bundle = await build({ entryPoints: ['src/game/world.ts', 'src/game/outdoorTiles.ts', 'src/game/environmentPixels.ts'], outdir: 'unused', bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const [world, art, pixels] = await Promise.all(bundle.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { MAPS, WIDTH, HEIGHT, isWalkable, canFish } = world
const sea = MAPS.havn
for (let y = 22; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
  const pier = x >= 22 && x <= 26 && y <= 25
  assert.equal(sea.tiles[y][x], pier ? 'dock' : 'water', `Open sea must not have a land/tree frame at ${x},${y}`)
  if (!pier) assert(!isWalkable(sea.tiles[y][x]) && !art.isOutdoorObject(sea.tiles[y][x]), 'Water remains blocked and creates no tree object')
}
assert.equal(sea.tiles[21][0], 'wall', 'Land border trees still end on the grass side of the shoreline')
assert.equal(sea.tiles[21][WIDTH - 1], 'wall')
assert(canFish({ mapId: 'havn', x: 24, y: 25, facing: 'down' }))
assert(canFish({ mapId: 'havn', x: 1, y: 21, facing: 'down' }))

// Final pixels at the open edges must contain sea colours, never artificial shore.
const p = pixels.ENVIRONMENT_PALETTE, seaColors = new Set([p.water, p.waterLight, p.waterDark, p.foam])
for (const [cx, cy] of [[0, 27], [WIDTH - 1, 27], [0, HEIGHT - 1], [WIDTH - 1, HEIGHT - 1], [24, HEIGHT - 1]]) {
  const raster = new Uint32Array(32 * 32)
  let color
  art.drawOutdoorGround({ fillStyle(c) { color = c; return this }, fillRect(x, y, w, h) {
    for (let yy = y - cy * 32; yy < y - cy * 32 + h; yy++) for (let xx = x - cx * 32; xx < x - cx * 32 + w; xx++) raster[yy * 32 + xx] = color
    return this
  } }, sea, cx, cy)
  assert(raster.every(c => seaColors.has(c)), `Sea edge ${cx},${cy} must not render grass or sand`)
}
const lake = MAPS.skogstjern
assert(lake.tiles[0].every(t => t === 'wall') && lake.tiles.at(-1).every(t => t === 'wall'), 'The lake retains its forest boundary')
assert.equal(lake.tiles[4][25], 'grass', 'The lake retains its north bank')
assert.equal(lake.tiles[5][25], 'water')
console.log('Open sea: all 66 former ocean-border tree tiles replaced by blocked water, pier/shore fishing retained, edge pixels contain only water, forest lake remains enclosed.')
