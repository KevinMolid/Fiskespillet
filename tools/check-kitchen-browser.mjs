import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173', errors = []
await mkdir('output/kitchen-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(`${mode}: ${e.message}`))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__kitchenTest={game,scene}; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('window.__kitchenTest'))
      await route.fulfill({ response, body })
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__kitchenTest?.scene.playerImage?.texture.key === 'player-down')
    await page.addStyleTag({ content: '.place-notice { visibility: hidden }' }) // Hide only the arrival banner in review screenshots.
    const fixtures = await page.evaluate(() => {
      const { scene: s, game } = window.__kitchenTest
      s.enterMap({ mapId: 'hjem', x: 8, y: 5, facing: 'left' })
      const names = s.environmentObjects.getChildren().map(o => o.name)
      return { names, nearest: s.playerImage.texture.source[0].scaleMode === 1, pixelated: game.canvas.style.imageRendering === 'pixelated' }
    })
    for (const name of ['environment-fridge:10,1', 'environment-sink:4,1', 'environment-bin:1,6', 'environment-chairDown:5,7', 'environment-chairUp:7,10']) assert(fixtures.names.includes(name))
    assert(fixtures.nearest && fixtures.pixelated)
    await page.waitForTimeout(600)
    await page.locator('[aria-label="Spillkart"] canvas').screenshot({ path: `output/kitchen-review/kitchen-${mode}.png` })
    for (const [x, y, direction] of [[3, 2, 'up'], [4, 8, 'right'], [5, 11, 'up']]) {
      await page.evaluate(({ x, y, direction }) => {
        const s = window.__kitchenTest.scene
        s.enterMap({ mapId: 'hjem', x, y, facing: direction }); s.move(direction)
      }, { x, y, direction })
      await page.waitForTimeout(150)
      const pos = await page.evaluate(() => window.__kitchenTest.scene.position)
      assert.equal(pos.x, x); assert.equal(pos.y, y) // Counter, table and chair all block the existing movement path.
    }
    const line = await page.evaluate(async () => {
      const { NPCS } = await import('/src/game/npcs.ts')
      const s = window.__kitchenTest.scene
      s.enterMap({ mapId: 'hjem', x: 6, y: 4, facing: 'up' }); s.action()
      return NPCS.find(n => n.id === 'mor').lines[0]
    })
    await page.getByRole('paragraph').filter({ hasText: line }).waitFor()
    assert(await page.evaluate(() => window.__kitchenTest.scene.uiBlocked))
    await page.keyboard.press('Escape')
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await context.close()
    console.log(`${mode}: kitchen fixtures render sharply, counter/table/chair collision and Mother's relocated conversation passed.`)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
