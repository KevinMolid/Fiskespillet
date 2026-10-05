import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/game/buildingOpenings.ts', 'src/game/world.ts', 'src/game/environmentPixels.ts'], outdir: 'unused', bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const [art, world, pixels] = await Promise.all(bundle.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { drawWindow, drawBuildingDoors, windowRegion, DOOR_STANDARD } = art
const { MAPS, TILE_SIZE, isWalkable, stepTransition } = world
const { ENVIRONMENT_PALETTE: p } = pixels

// Rasterize tile fragments to check real seam pixels and draw-order independence.
for (const [cols, rows] of [[1, 1], [2, 1], [3, 1], [2, 2], [3, 2]]) {
  const map = { id: 'havn', tiles: Array.from({ length: rows }, () => Array(cols).fill('window')) }
  const width = cols * TILE_SIZE, height = rows * TILE_SIZE
  const cells = map.tiles.flatMap((row, y) => row.map((_, x) => [x, y]))
  function rasterize(order) {
    const raster = new Uint32Array(width * height)
    for (const [cx, cy] of order) {
      assert.deepEqual(windowRegion(map, cx, cy), { left: 0, top: 0, width: cols, height: rows })
      drawWindow((x, y, w, h, color, alpha = 1) => {
        assert([x, y, w, h].every(Number.isInteger) && w > 0 && h > 0)
        assert(x >= 0 && y >= 0 && x + w <= TILE_SIZE && y + h <= TILE_SIZE)
        assert.equal(alpha, 1)
        for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) raster[(cy * TILE_SIZE + py) * width + cx * TILE_SIZE + px] = color
      }, map, cx, cy)
    }
    return raster
  }
  const raster = rasterize(cells)
  assert.deepEqual(rasterize(cells.toReversed()), raster, 'Tile order must not overwrite adjoining window fragments')
  const at = (x, y) => raster[y * width + x]
  for (let x = TILE_SIZE; x < width; x += TILE_SIZE) {
    assert.equal(at(x, 10), p.creamLight, 'Vertical seam joins the mullion')
    assert.equal(at(x - 3, 10), p.glass)
    assert.equal(at(x + 3, 10), p.glass)
    assert.equal(at(x, height - 8), p.timberDark, 'One continuous sill')
  }
  for (let y = TILE_SIZE; y < height; y += TILE_SIZE) {
    assert.equal(at(8, y), p.creamLight, 'Horizontal seam joins the mullion')
    assert.equal(at(8, y - 3), p.glass)
    assert.equal(at(8, y + 3), p.glass)
  }
}

const before = JSON.stringify(MAPS)
const expectedBlocks = { havn: ['2x2', '2x2', '3x2', '3x2'], hjem: ['2x1', '2x1'], hjem2: ['2x1', '2x1'], butikk: ['3x1', '3x1'], skogstjern: [] }
let doors = 0
for (const map of Object.values(MAPS)) {
  const blocks = new Map()
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    if (map.tiles[y][x] === 'window') {
      assert(!isWalkable(map.tiles[y][x]), 'Facade windows remain blocking')
      const region = windowRegion(map, x, y)
      blocks.set(`${region.left},${region.top}`, `${region.width}x${region.height}`)
    }
    if (map.tiles[y][x] === 'door') {
      assert(isWalkable(map.tiles[y][x]), 'The original door tile remains walkable')
      assert(stepTransition({ mapId: map.id, x, y, facing: 'up' }), 'The entrance still has a destination')
      doors++
    }
  }
  assert.deepEqual([...blocks.values()].sort(), expectedBlocks[map.id].toSorted())
  const shapes = []
  let color
  drawBuildingDoors({ fillStyle(c) { color = c; return this }, fillRect(x, y, w, h) { shapes.push({ x, y, w, h, color }); return this } }, map)
  for (const [key] of Object.entries(map.transitions ?? {})) {
    const [x, y] = key.split(',').map(Number)
    if (map.tiles[y][x] !== 'door') continue
    const thresholdY = y * TILE_SIZE + DOOR_STANDARD.groundY
    assert(shapes.some(s => s.x === x * TILE_SIZE + 1 && s.y === thresholdY - DOOR_STANDARD.height && s.h === DOOR_STANDARD.height && s.w === DOOR_STANDARD.width), 'Full-height door rises from the original threshold')
    assert(shapes.some(s => s.y === thresholdY && s.x === x * TILE_SIZE && s.h === 1 && s.w === TILE_SIZE), 'Threshold stays at tile-local Y=30')
  }
}
assert.equal(doors, 4)
assert.equal(JSON.stringify(MAPS), before, 'Rendering must not mutate the map')
console.log('Joined windows: 1x1, 2x1, 3x1, 2x2 and 3x2 seam pixels and tile order passed; installed blocks and all four 64px doors retain their entrance/ground anchor.')
