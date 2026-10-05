import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ stdin: { contents: "export * from './src/game/world'; export * from './src/game/npcs'; export * from './src/game/indoorTiles'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const { MAPS, NPCS, HOME_STAIRS, isWalkable, isIndoorObject } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const map = MAPS.hjem, adjacent = [[0, 1], [0, -1], [1, 0], [-1, 0]]
const occupied = new Set(NPCS.filter(n => n.mapId === 'hjem').flatMap(n => n.route.map(([x, y]) => `${x},${y}`)))
const seen = new Set(['12,14']), queue = [[12, 14]]
for (let i = 0; i < queue.length; i++) for (const [dx, dy] of adjacent) {
  const [x, y] = queue[i], nx = x + dx, ny = y + dy, key = `${nx},${ny}`
  if (!seen.has(key) && !occupied.has(key) && isWalkable(map.tiles[ny]?.[nx])) { seen.add(key); queue.push([nx, ny]) }
}
const reachableBeside = (x, y) => adjacent.some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`))
for (const [x, y, tile] of [[4, 1, 'sink'], [8, 1, 'stove'], [10, 1, 'fridge'], [1, 6, 'bin']]) {
  assert.equal(map.tiles[y][x], tile)
  assert(isIndoorObject(tile) && !isWalkable(tile), `${tile} uses ordinary furniture collision`)
  assert(reachableBeside(x, y), `${tile} must be accessible from the open kitchen`)
}
for (let x = 1; x <= 10; x++) assert(['wall', 'window'].includes(map.tiles[0][x]), 'North worktop/appliances directly adjoin the wall')
for (let y = 1; y <= 5; y++) {
  assert.equal(map.tiles[y][0], 'wall')
  assert.equal(map.tiles[y][1], 'counter')
}
assert.equal(map.tiles.flat().filter(t => t === 'diningTable').length, 6)
assert.equal(map.tiles.flat().filter(t => t.startsWith('chair')).length, 4)
for (const x of [5, 7]) for (const [y, tile, tableY] of [[7, 'chairDown', 8], [10, 'chairUp', 9]]) {
  assert.equal(map.tiles[y][x], tile)
  assert.equal(map.tiles[tableY][x], 'diningTable', 'Chair faces the table')
  assert(!isWalkable(tile) && reachableBeside(x, y), 'Chair is blocking, but accessible')
}
for (const key of ['3,7', '3,8', '3,9', '3,10', '9,7', '9,8', '9,9', '9,10', '11,8', '11,9', '12,15', `${HOME_STAIRS.x},${HOME_STAIRS.upperY}`]) assert(seen.has(key), `Open aisle/exit ${key} must remain reachable despite NPC collision`)
const mother = NPCS.find(n => n.id === 'mor')
assert.deepEqual(mother.route, [[6, 3]])
assert(reachableBeside(...mother.route[0]), 'Mother remains available for conversation')
console.log('Kitchen: wall-aligned L worktop, accessible sink/fridge/stove/bin, six-tile dining table, four facing chairs, both aisles, Mother and original door/stair access passed.')
