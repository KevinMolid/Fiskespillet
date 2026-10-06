import { build } from 'esbuild'
import assert from 'node:assert/strict'

const bundle = await build({
  stdin: { contents: "export * from './src/game/fishing'; export { MAPS } from './src/game/world'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' },
})
const { MAPS, castTargets, advanceFight, fishingConditions, FISHING_ZONE_NAMES, sinkingState, SINK_DURATION_MS, castFlightDuration, CAST_SPLASH_DURATION_MS, tapReel, advanceReel, retrieveSpeed, retrieveBiteOpportunity, retrieveTarget, RETRIEVE_SHORE_DISTANCE } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function retrieveAtCadence(interval, frameMs=20) {
  let state={speed:0,remainingTiles:100}
  for(let time=0;time<6000;time+=frameMs) {
    if(time%interval===0) state=tapReel(state)
    state=advanceReel(state,frameMs).state
  }
  return state
}
const slow=retrieveAtCadence(1000),fast=retrieveAtCadence(200)
assert(fast.speed>slow.speed&&fast.remainingTiles<slow.remainingTiles,'Rapid taps reel faster and farther')
const coarse=advanceReel({speed:.8,remainingTiles:10},1000).state
let fine={speed:.8,remainingTiles:10}
for(let i=0;i<100;i++) fine=advanceReel(fine,10).state
assert(Math.abs(coarse.remainingTiles-fine.remainingTiles)<1e-9,'Distance is independent of frame size')
assert.equal(advanceReel({speed:0,remainingTiles:4},10000).state.remainingTiles,4,'No taps means no automatic reeling')
const coast=advanceReel({speed:.8,remainingTiles:4},10000).state
assert.equal(coast.speed,0);assert(coast.remainingTiles>0&&coast.remainingTiles<4,'Pausing decays speed without silently finishing a cast')
assert.equal(advanceReel({speed:1,remainingTiles:.05},1000).state.remainingTiles,0,'Hook stops at the shoreline')
assert.equal(tapReel({speed:.95,remainingTiles:4}).speed,1)
assert.deepEqual([retrieveSpeed(.1),retrieveSpeed(.5),retrieveSpeed(.9)],['slow','steady','fast'])
assert.equal(retrieveBiteOpportunity(500,0),0)
const whole=retrieveBiteOpportunity(1000,.5),half=retrieveBiteOpportunity(500,.5)
assert(Math.abs(whole-(1-(1-half)**2))<1e-12,'Bite opportunities depend on elapsed reeling time, not frame count')
assert(retrieveBiteOpportunity(250,.5)>0,'Bites remain possible throughout retrieval')
// Resolve the actual starting-area map id without assuming its display name.
const shorePosition=Object.values(MAPS).flatMap(map=>map.tiles.flatMap((row,y)=>row.map((_,x)=>({mapId:map.id,x,y,facing:'down'})))).find(position=>castTargets(position).length===5)
assert(shorePosition)
const original=castTargets(shorePosition)[4]
assert.equal(retrieveTarget(shorePosition,original,original.steps-RETRIEVE_SHORE_DISTANCE).steps,5)
assert.equal(retrieveTarget(shorePosition,original,0).steps,1,'Bite conditions follow the hook towards shore')

assert.equal(CAST_SPLASH_DURATION_MS,900)
assert.equal(castFlightDuration(1),840)
assert.equal(castFlightDuration(4),1260)
assert.equal(castFlightDuration(5),1400)
assert(castFlightDuration(5)>castFlightDuration(1))

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
        assert.equal(target.x, x + dx * target.steps)
        assert.equal(target.y, y + dy * target.steps)
        assert.equal(map.tiles[y + dy * target.steps]?.[x + dx * target.steps], 'water', 'cast stays on water')
        totalTargets++
      }
    }
  }
}
assert(totalTargets > 10, 'both fishing maps should offer castable water tiles')
assert(fullLengthSpots > 0, 'some shore positions should support all five cast lengths')
const sample = { id: 1, castLength: 'short', label: 'Kort', steps: 1, x: 1, y: 1, feature: 'reeds', featureName: 'sivkant', description: 'Ved sivet' }
assert.deepEqual(fishingConditions('worm', sample, 'bottom', 'slow'), {
  bait: 'worm', castLength: 'short', feature: 'reeds', depth: 'bottom', retrieve: 'slow',
})

assert.equal(sinkingState(0).progress, 0, 'Bait starts at the top')
assert.equal(sinkingState(800).depth, 'surface')
assert.equal(sinkingState(2400).depth, 'midwater')
assert.equal(sinkingState(SINK_DURATION_MS - 1).depth, 'bottom')
assert(!sinkingState(SINK_DURATION_MS - 1).snagged, 'Bottom-feeding fish remain reachable before the deadline')
assert(sinkingState(SINK_DURATION_MS).snagged, 'Reaching the bottom fails the cast')
assert(sinkingState(SINK_DURATION_MS * 2).snagged, 'Delayed/background input cannot rescue a snagged cast')
assert.equal(sinkingState(SINK_DURATION_MS * 2).progress, 1)
for(let ms=0, previous=-1;ms<=SINK_DURATION_MS;ms+=100) {
  const state=sinkingState(ms)
  assert(state.progress>=previous,'Depth cannot bounce upward like the length meter')
  previous=state.progress
}

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
console.log(`Fishing: ${totalTargets} actual landing coordinates, timed depth/bottom failure, condition mapping, and fight outcomes passed.`)
