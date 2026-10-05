import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173'
const errors = []
await mkdir('output/indoor-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(`${mode}: ${e.message}`))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__indoorTest={game,scene}; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('window.__indoorTest'))
      await route.fulfill({ response, body })
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__indoorTest?.scene.playerImage?.texture.key === 'player-down')
    await page.waitForTimeout(700)
    for (const mapId of ['hjem', 'butikk']) {
      await page.evaluate(mapId => {
        const s = window.__indoorTest.scene
        s.setUiBlocked(false)
        s.enterMap({ mapId, x: 12, y: 14, facing: 'down' })
      }, mapId)
      await page.waitForTimeout(400)
      await page.evaluate(() => {
        const s = window.__indoorTest.scene
        window.__doorPaused = false
        s.move('down')
        s.time.delayedCall(70, () => { s.tweens.pauseAll(); window.__doorPaused = true })
      })
      await page.waitForFunction(() => window.__doorPaused)
      const depth = await page.evaluate(() => {
        const s = window.__indoorTest.scene
        s.sys.displayList.depthSort()
        const door = s.environmentObjects.getChildren().find(o => o.name === 'environment-door:12,15')
        const list = s.sys.displayList.getChildren()
        return { hasDoor: !!door, doorDepth: door?.depth, playerDepth: s.player.depth, doorOrder: list.indexOf(door), playerOrder: list.indexOf(s.player), moving: s.moving, y: s.player.y, mapId: s.position.mapId }
      })
      assert(depth.hasDoor && depth.moving && depth.y > 14 * 32 + 16)
      assert.equal(depth.mapId, mapId)
      assert(depth.doorDepth > depth.playerDepth && depth.doorOrder > depth.playerOrder, 'Door must actually render ahead of the moving player')
      if (mode === 'desktop') await page.locator('[aria-label="Spillkart"] canvas').screenshot({ path: `output/indoor-review/${mapId}-exit-foreground.png` })
      await page.evaluate(() => window.__indoorTest.scene.tweens.resumeAll())
      await page.waitForFunction(() => window.__indoorTest.scene.position.mapId === 'havn')
    }

    const stairs = await page.evaluate(async () => {
      const { HOME_STAIRS } = await import('/src/game/world.ts')
      window.__indoorTest.scene.enterMap({ mapId: 'hjem', x: HOME_STAIRS.x, y: HOME_STAIRS.lowerY, facing: 'up' })
      return HOME_STAIRS
    })
    await page.waitForTimeout(500)
    await page.locator('[aria-label="Spillkart"] canvas').screenshot({ path: `output/indoor-review/home-stairs-${mode}.png` })
    for (let y = stairs.lowerY - 1; y >= stairs.upperY; y--) {
      await page.evaluate(() => window.__indoorTest.scene.move('up'))
      await page.waitForFunction(({ y, upperY }) => { const s = window.__indoorTest.scene; return !s.moving && s.position.y === y && s.position.mapId === (y === upperY ? 'hjem2' : 'hjem') }, { y, upperY: stairs.upperY })
    }
    if (mode === 'desktop') await page.locator('[aria-label="Spillkart"] canvas').screenshot({ path: 'output/indoor-review/upstairs-landing.png' })
    for (let y = stairs.upperY + 1; y <= stairs.lowerY; y++) {
      await page.evaluate(() => window.__indoorTest.scene.move('down'))
      await page.waitForFunction(({ y, lowerY }) => { const s = window.__indoorTest.scene; return !s.moving && s.position.y === y && s.position.mapId === (y === lowerY ? 'hjem' : 'hjem2') }, { y, lowerY: stairs.lowerY })
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow')
    await context.close()
    console.log(`${mode}: foreground exits during movement, original exterior destinations, full staircase ascent/descent and free arrival landings passed.`)
  }
  assert.deepEqual(errors, [])
} finally { await browser.close() }
