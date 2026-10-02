// Real scene animation checks; all instrumentation is limited to served test responses.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
await mkdir('output/character-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage(); const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__characterTest = { game, scene }; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('__characterTest'))
      await route.fulfill({ response, body })
    })
    await page.goto('http://127.0.0.1:5173/tools/game-preview.html')
    await page.waitForFunction(() => window.__characterTest?.scene.playerImage)
    const results = await page.evaluate(async () => {
      const { NPCS } = await import('/src/game/npcs.ts')
      const { scene } = window.__characterTest
      scene.setUiBlocked(true)
      const result = []
      for (const mapId of ['havn', 'hjem', 'butikk', 'skogstjern']) {
        scene.enterMap({ mapId, x: 2, y: 16, facing: 'down' })
        for (const definition of NPCS.filter(n => n.mapId === mapId)) {
          const n = scene.residents.find(n => n.definition.id === definition.id)
          const original = n.image
          for (const direction of ['down', 'right', 'up', 'left']) {
            n.facing = direction
            for (const phase of [0, 1, 2]) {
              n.moving = phase > 0; n.walkStarted = scene.time.now - (phase === 2 ? 225 : 25)
              scene.drawResident(n)
              const i = n.image
              result.push({ id: definition.id, direction, phase, texture: i.texture.key, sameObject: i === original,
                x: n.sprite.x, y: n.sprite.y, depth: n.sprite.depth,
                originX: i.originX, originY: i.originY, filter: i.texture.source[0].scaleMode,
                scale: i.scaleX, width: i.width, height: i.height,
                groundY: n.sprite.y + i.y + (60 - i.originY * i.height) * i.scaleY,
              })
            }
          }
          n.moving = false; scene.drawResident(n)
        }
      }
      return result
    })
    assert.equal(results.length, 96)
    for (const r of results) {
      assert.equal(r.texture, `${r.id}-${r.direction}${r.phase ? '-walk-' + r.phase : ''}`)
      assert(r.sameObject, 'Animation must retain the same image object')
      assert.equal(r.filter, 1); assert.equal(r.scale, 1)
      assert.equal(r.originX, .5); assert.equal(r.originY, 60 / 64)
      assert.equal(r.width, 48); assert.equal(r.height, 64)
      assert.equal(r.groundY, r.y + 14)
    }
    await page.evaluate(() => {
      const { scene, game } = window.__characterTest
      scene.enterMap({ mapId: 'havn', x: 15, y: 12, facing: 'down' })
      scene.setUiBlocked(false)
      window.__gaitSamples = []
      game.events.on('postrender', () => window.__gaitSamples.push({ player: scene.playerImage.texture.key,
        oda: scene.residents.find(n => n.definition.id === 'oda')?.image.texture.key }))
      scene.residents.find(n => n.definition.id === 'oda').next = scene.time.now - 1
      scene.move('right')
    })
    await page.waitForTimeout(450)
    const samples = await page.evaluate(() => window.__gaitSamples)
    assert(samples.some(s => s.player === 'player-right-walk-1'))
    assert(samples.some(s => s.player === 'player-right-walk-2'))
    assert.equal(samples.at(-1).player, 'player-right')
    assert(samples.some(s => s.oda === 'oda-right-walk-1'))
    assert(samples.some(s => s.oda === 'oda-right-walk-2'))
    assert.equal(samples.at(-1).oda, 'oda-right')
    await page.locator('.game-frame').screenshot({ path: `output/character-review/world-${mode}.png` })
    await page.goto('http://127.0.0.1:5173/tools/character-preview.html')
    await page.waitForSelector('.card img')
    assert.equal(await page.locator('.card').count(), 9)
    for (const direction of ['down', 'right', 'up', 'left']) {
      await page.locator('#direction').selectOption(direction)
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      if (!mobile && mode !== 'canvas') await page.screenshot({ path: `output/character-review/${direction}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [])
    console.log(`${mode}: 8 NPCs × 4 directions × 3 poses, persistent rendering, ground/filter, actual player/NPC tween gait and review gallery passed.`)
    await context.close()
  }
} finally { await browser.close() }
