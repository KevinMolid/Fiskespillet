import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ entryPoints: ['src/game/characterAnimation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { characterWalkStep } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
for (const duration of [115, 300]) {
  const sequence = [characterWalkStep(true, 0), characterWalkStep(true, 49 / 100), characterWalkStep(true, .5), characterWalkStep(true, 1), characterWalkStep(false, 1)]
  assert.deepEqual(sequence, [1, 1, 2, 2, 0])
  assert.deepEqual([0, duration / 2, duration].map(elapsed => characterWalkStep(elapsed < duration, elapsed / duration)), [1, 2, 0])
  // Consecutive tile tweens keep A→B→A→B, never repeat B→B or A→A.
  assert.deepEqual([0, .5, 0, .5].map(progress => characterWalkStep(true, progress)), [1, 2, 1, 2])
}
console.log('Player/NPC gait phases, consecutive steps and idle reset passed.')
