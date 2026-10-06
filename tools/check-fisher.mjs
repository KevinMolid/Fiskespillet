import { build } from 'esbuild'
import assert from 'node:assert/strict'

const bundle = await build({ entryPoints: ['src/game/fisherSprite.ts'], bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' } })
const { fisherPixels } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(typeof fisherPixels, 'function', 'Menu/wardrobe portraits require the fisherPixels export')
const directions = ['down', 'up', 'left', 'right']
for (const direction of directions) {
  for (let shirt = 0; shirt < 5; shirt++) for (let hair = 0; hair < 5; hair++) for (let skin = 0; skin < 4; skin++) {
    const appearance = { shirt, hair, skin }
    for (let stride = 0; stride < 3; stride++) {
      const pixels = fisherPixels(appearance, direction, stride)
      assert(pixels.length > 100)
      for (const p of pixels) {
        assert(Number.isInteger(p.color) && p.color >= 0 && p.color <= 0xffffff, `Invalid palette: ${JSON.stringify(appearance)}`)
        assert(p.x >= 0 && p.x < 18 && p.y >= -1 && p.y < 22, `Pixel outside silhouette: ${JSON.stringify(p)}`)
      }
    }
  }
  const base = { shirt: 0, hair: 0, skin: 0 }
  for (const key of ['shirt', 'hair', 'skin']) assert.notDeepEqual(fisherPixels(base, direction), fisherPixels({ ...base, [key]: 1 }, direction), `${key} must be visible facing ${direction}`)
  assert.notDeepEqual(fisherPixels(base, direction, 1), fisherPixels(base, direction, 2), `Walking feet must alternate: ${direction}`)
}
console.log('Fisher: all 100 wardrobe combinations × 4 directions × 3 frames valid; every color channel visible in every direction.')
