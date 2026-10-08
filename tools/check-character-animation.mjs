import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ entryPoints: ['src/game/characterAnimation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { nextCharacterWalkPhase, characterWalkTextureStep, nextPlayerWalkPhase, playerWalkTextureStep, PLAYER_WALK_SETTLE_MS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(nextCharacterWalkPhase,nextPlayerWalkPhase)
assert.equal(characterWalkTextureStep,playerWalkTextureStep,'NPC and player use the same per-tile phase selection')
let phase = -1
const playerSequence = Array.from({ length: 6 }, () => playerWalkTextureStep(phase = nextPlayerWalkPhase(phase)))
assert.deepEqual(playerSequence, [1, 2, 1, 2, 1, 2])
assert(PLAYER_WALK_SETTLE_MS > 0 && PLAYER_WALK_SETTLE_MS < 145, 'Brief final-pose settle on release')
for (const duration of [145, 150, 72.5, 75, 300]) {
  phase = -1
  const steps = Array.from({length:8},()=>playerWalkTextureStep(phase = nextPlayerWalkPhase(phase,3),3))
  assert.deepEqual(steps,[1,3,2,3,1,3,2,3],'Exactly one image per tile in A-C-B-C order')
  for (let tile=0;tile<4;tile++) {
    assert.deepEqual([0,duration*.49,duration*.5,duration].map(()=>playerWalkTextureStep(tile,3)),Array(4).fill(steps[tile]),'No mid-tile change while walking/running')
  }
}
console.log('Shared player/NPC one-image-per-tile A-C-B-C gait passed at walk/run/stroll speeds.')
