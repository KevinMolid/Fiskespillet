import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ entryPoints: ['src/game/characterAnimation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { characterWalkStep, nextPlayerWalkPhase, playerWalkTextureStep, PLAYER_WALK_SETTLE_MS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
for (const duration of [115, 300]) {
  const sequence = [characterWalkStep(true, 0), characterWalkStep(true, 49 / 100), characterWalkStep(true, .5), characterWalkStep(true, 1), characterWalkStep(false, 1)]
  assert.deepEqual(sequence, [1, 1, 2, 2, 0])
  assert.deepEqual([0, duration / 2, duration].map(elapsed => characterWalkStep(elapsed < duration, elapsed / duration)), [1, 2, 0])
  // Consecutive tile tweens keep A→B→A→B, never repeat B→B or A→A.
  assert.deepEqual([0, .5, 0, .5].map(progress => characterWalkStep(true, progress)), [1, 2, 1, 2])
}
let phase = -1
const playerSequence = Array.from({ length: 6 }, () => playerWalkTextureStep(phase = nextPlayerWalkPhase(phase)))
assert.deepEqual(playerSequence, [1, 2, 1, 2, 1, 2])
assert(PLAYER_WALK_SETTLE_MS > 30 && PLAYER_WALK_SETTLE_MS < 115, 'Bridge existing inter-tile gap without changing tween speed')
for (const duration of [115, 57.5]) {
  phase = -1
  const steps = Array.from({length:8},()=>playerWalkTextureStep(phase = nextPlayerWalkPhase(phase,3),3))
  assert.deepEqual(steps,[1,3,2,3,1,3,2,3],'Exactly one image per tile in A-C-B-C order')
  for (let tile=0;tile<4;tile++) {
    assert.deepEqual([0,duration*.49,duration*.5,duration].map(()=>playerWalkTextureStep(tile,3)),Array(4).fill(steps[tile]),'No mid-tile change while walking/running')
  }
}
console.log('NPC gait phases and player alternating footfalls passed.')
console.log('Player one-image-per-tile A-C-B-C gait passed for walking/running; NPC cadence unchanged.')
