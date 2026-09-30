import { build } from 'esbuild'
import assert from 'node:assert/strict'

const bundle = await build({ entryPoints: ['src/game/world.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { MAPS, START, DIG_SPOTS, isWalkable, isPosition, edgeTransition } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]
assert(isPosition(START), 'Start must remain walkable')
for (const map of Object.values(MAPS)) {
  const seed = map.id === 'havn' ? START : Object.values(MAPS).flatMap(m => Object.values(m.transitions ?? {})).find(p => p.mapId === map.id) ?? { x: 0, y: 16 }
  const seen = new Set([`${seed.x},${seed.y}`])
  const queue = [[seed.x, seed.y]]
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]
    for (const [dx, dy] of directions) {
      const key = `${x + dx},${y + dy}`
      if (!seen.has(key) && isWalkable(map.tiles[y + dy]?.[x + dx])) { seen.add(key); queue.push([x + dx, y + dy]) }
    }
  }
  const reachableBeside = (x, y) => directions.some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`))
  for (const [key, destination] of Object.entries(map.transitions ?? {})) {
    assert(seen.has(key), `${map.id} entrance ${key} blocked`)
    assert(isPosition(destination), `${map.id} invalid destination ${key}`)
  }
  for (const key of [...Object.keys(map.signs), ...Object.keys(map.npcs ?? {})]) assert(reachableBeside(...key.split(',').map(Number)), `${map.id} interaction ${key} blocked`)
  for (const spot of Object.values(DIG_SPOTS).filter(s => s.mapId === map.id)) {
    assert.equal(map.tiles[spot.y][spot.x], 'soil')
    assert(reachableBeside(spot.x, spot.y), `Dig spot ${map.id} ${spot.x},${spot.y} blocked`)
  }
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    const tile = map.tiles[y][x]
    if (tile === 'exit') {
      assert(seen.has(`${x},${y}`), `${map.id} exit inaccessible`)
      assert(edgeTransition({ mapId: map.id, x, y, facing: 'right' }), `${map.id} exit disconnected`)
    }
    if (['stairs', 'chest', 'wardrobe', 'shopCounter'].includes(tile)) assert(reachableBeside(x, y), `${map.id} ${tile} inaccessible`)
  }
  if (map.fishingZone) assert(queue.some(([x, y]) => directions.some(([dx, dy]) => map.tiles[y + dy]?.[x + dx] === 'water')), `${map.id} has no reachable fishing bank`)
  console.log(`${map.id}: ${seen.size} reachable tiles; entrances, interactions and fishing access OK`)
}
