import { build } from 'esbuild'
import assert from 'node:assert/strict'

const bundle = await build({
  stdin: { contents: "export * from './src/game/fishing'; export { MAPS } from './src/game/world'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' },
})
const { MAPS, castTargets, advanceFight, fishingConditions, FISHING_ZONE_NAMES } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

assert.equal(FISHING_ZONE_NAMES.havn, 'Bryggehavn')
assert.equal(FISHING_ZONE_NAMES.skogstjern, 'Skogstjernet')
let totalTargets = 0
let fullLengthSpots = 0
for (const map of Object.values(MAPS)) {
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    for (const facing of ['up', 'down', 'left', 'right']) {
      const targets = castTargets({ mapId: map.id, x, y, facing })
      const steps = targets.map(target => target.steps)
      assert.equal(new Set(steps).size, steps.length)
      assert(targets.every(target => target.id === target.steps))
      if (steps.length === 5) { assert.deepEqual(steps, [1, 2, 3, 4, 5]); fullLengthSpots++ }
      assert(targets.every(target => target.feature && target.description))
      for (const target of targets) {
        const dx = facing === 'left' ? -1 : facing === 'right' ? 1 : 0
        const dy = facing === 'up' ? -1 : facing === 'down' ? 1 : 0
        assert.equal(map.tiles[y + dy * target.steps]?.[x + dx * target.steps], 'water', 'cast stays on water')
        totalTargets++
      }
    }
  }
}
assert(totalTargets > 10, 'both fishing maps should offer castable water tiles')
assert(fullLengthSpots > 0, 'some shore positions should support all five cast lengths')
const sample = { id: 1, castLength: 'short', label: 'Kort', steps: 1, feature: 'reeds', featureName: 'sivkant', description: 'Ved sivet' }
assert.deepEqual(fishingConditions('worm', sample, 'bottom', 'slow'), {
  bait: 'worm', castLength: 'short', feature: 'reeds', depth: 'bottom', retrieve: 'slow',
})

let fight = { tension: 36, progress: 0, elapsedMs: 0, pulling: false }
let outcome = null
for (let tick = 0; tick < 220 && !outcome; tick++) {
  const next = advanceFight(fight, !fight.pulling, 1.2)
  fight = next.state
  outcome = next.outcome
}
assert.equal(outcome, 'landed', 'reeling on calm beats should land a strong fish')
assert(fight.progress >= 100)

fight = { tension: 36, progress: 0, elapsedMs: 0, pulling: false }
outcome = null
for (let tick = 0; tick < 220 && !outcome; tick++) {
  const next = advanceFight(fight, true, 1.6)
  fight = next.state
  outcome = next.outcome
}
assert.equal(outcome, 'escaped', 'holding the reel against a very strong fish should break the line')
assert(fight.tension >= 100)
console.log(`Fishing: ${totalTargets} valid cast targets, condition mapping, and fight outcomes passed.`)
