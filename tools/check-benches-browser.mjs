import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173', errors = []
await mkdir('output/bench-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(`${mode}: ${e.message}`))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__benchTest={game,scene}; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('window.__benchTest'))
      await route.fulfill({ response, body })
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__benchTest?.scene.playerImage?.texture.key === 'player-down')
    await page.addStyleTag({ content: '.place-notice { visibility: hidden }' })
    for (const [mapId, x, y] of [['havn', 18, 19], ['skogstjern', 11, 21]]) {
      for (const [px, py, direction] of [[x, y + 1, 'up'], [x + 1, y + 1, 'up'], [x, y - 1, 'down'], [x + 1, y - 1, 'down'], [x - 1, y, 'right'], [x + 2, y, 'left']]) {
        await page.evaluate(({ mapId, px, py, direction }) => {
          const s = window.__benchTest.scene
          s.enterMap({ mapId, x: px, y: py, facing: direction }); s.move(direction)
        }, { mapId, px, py, direction })
        await page.waitForTimeout(150)
        const position = await page.evaluate(() => window.__benchTest.scene.position)
        assert.equal(position.x, px); assert.equal(position.y, py)
      }
      for (const py of [y - 1, y + 1]) {
        const order = await page.evaluate(async ({ mapId, x, y, py }) => {
          const { MAPS } = await import('/src/game/world.ts')
          const { isRaisedDecoration } = await import('/src/game/outdoorTiles.ts')
          const { scene: s, game } = window.__benchTest
          s.enterMap({ mapId, x, y: py, facing: 'down' })
          s.player.setDepth(s.player.y); s.sys.displayList.depthSort()
          const raised = MAPS[mapId].decorations.filter(d => isRaisedDecoration(d.kind))
          const bench = s.environmentObjects.getChildren().slice(-raised.length)[raised.findIndex(d => d.kind === 'bench')]
          const children = s.sys.displayList.getChildren()
          return { benchDepth: bench.depth, playerIndex: children.indexOf(s.player), benchIndex: children.indexOf(bench), follows: s.cameras.main._follow === s.player, nearest: s.playerImage.texture.source[0].scaleMode === 1, pixelated: game.canvas.style.imageRendering === 'pixelated' }
        }, { mapId, x, y, py })
        assert.equal(order.benchDepth, y * 32 + 16)
        assert(py < y ? order.playerIndex < order.benchIndex : order.playerIndex > order.benchIndex)
        assert(order.follows && order.nearest && order.pixelated)
      }
      await page.evaluate(({ mapId, x, y }) => window.__benchTest.scene.enterMap({ mapId, x: x - 2, y, facing: 'right' }), { mapId, x, y })
      await page.waitForTimeout(500)
      await page.locator('[aria-label="Spillkart"] canvas').screenshot({ path: `output/bench-review/${mapId}-${mode}.png` })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await context.close()
    console.log(`${mode}: both widened benches, movement blocked on both halves from all sides, front/behind depth, camera, nearest rendering and layout passed.`)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
