import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const bundle = await build({ entryPoints: ['src/game/navigation.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { HoldRepeater, nextControl } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

test('Holding repeats immediately and every 150ms; release cancels all repeats', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let steps = 0
  const hold = new HoldRepeater()
  hold.start(() => steps++)
  assert.equal(steps, 1)
  t.mock.timers.tick(600)
  assert.equal(steps, 5)
  hold.stop()
  t.mock.timers.tick(2000)
  assert.equal(steps, 5)
})
test('Changing direction replaces the previous repeat; repeated cancellation is safe', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let left = 0, right = 0
  const hold = new HoldRepeater()
  hold.start(() => left++)
  t.mock.timers.tick(150)
  hold.start(() => right++)
  t.mock.timers.tick(300)
  assert.equal(left, 2)
  assert.equal(right, 3)
  hold.stop(); hold.stop()
  t.mock.timers.tick(1000)
  assert.equal(right, 3)
})
test('Menu navigation follows rows and columns instead of jumping diagonally', () => {
  const points = [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 20, y: 60 }, { x: 60, y: 60 }]
  assert.equal(nextControl(points, 0, 'right'), 1)
  assert.equal(nextControl(points, 0, 'down'), 2)
  assert.equal(nextControl(points, 3, 'up'), 1)
  assert.equal(nextControl(points, 3, 'left'), 2)
  assert.equal(nextControl(points, 0, 'up'), 0)
  assert.equal(nextControl(points, -1, 'down'), 0)
  assert.equal(nextControl([], -1, 'down'), -1)
})
