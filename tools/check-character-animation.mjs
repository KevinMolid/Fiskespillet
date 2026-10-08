import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ entryPoints: ['src/game/characterAnimation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { characterWalkStep, nextPlayerWalkStep, playerWalkTextureStep, PLAYER_WALK_SETTLE_MS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
for (const duration of [115, 300]) {
  const sequence = [characterWalkStep(true, 0), characterWalkStep(true, 49 / 100), characterWalkStep(true, .5), characterWalkStep(true, 1), characterWalkStep(false, 1)]
  assert.deepEqual(sequence, [1, 1, 2, 2, 0])
  assert.deepEqual([0, duration / 2, duration].map(elapsed => characterWalkStep(elapsed < duration, elapsed / duration)), [1, 2, 0])
  // Consecutive tile tweens keep A→B→A→B, never repeat B→B or A→A.
  assert.deepEqual([0, .5, 0, .5].map(progress => characterWalkStep(true, progress)), [1, 2, 1, 2])
}
let footfall = 2
const playerSequence = Array.from({ length: 6 }, () => footfall = nextPlayerWalkStep(footfall))
assert.deepEqual(playerSequence, [1, 2, 1, 2, 1, 2])
assert(PLAYER_WALK_SETTLE_MS > 30 && PLAYER_WALK_SETTLE_MS < 115, 'Bridge existing inter-tile gap without changing tween speed')
for (const duration of [115, 57.5]) {
  assert.deepEqual([0, duration*.49, duration*.5, duration].map(elapsed=>playerWalkTextureStep(1,elapsed/duration,3)),[1,1,3,3])
  assert.deepEqual([0, duration*.5, 0, duration*.5].map((elapsed,index)=>playerWalkTextureStep(index<2?1:2,elapsed/duration,3)),[1,3,2,3])
  assert.deepEqual([0,.5,1].map(progress=>playerWalkTextureStep(2,progress)),[2,2,2],'Directions without C retain existing contact timing')
}
console.log('NPC gait phases and player alternating footfalls passed.')
console.log('Right-player A-C-B-C passing frame preserves walking/running footfall duration.')
