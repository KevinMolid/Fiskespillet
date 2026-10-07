// Exercise the real conversation, inventory and input UI; only offline services are instrumented.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175'
await mkdir('output/utility-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__sneakersTest={game,scene}; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('__sneakersTest'))
      await route.fulfill({ response, body })
    })
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('grantMaritaSneakers: async () => {', `grantMaritaSneakers: async () => {
        window.__giftCalls=(window.__giftCalls||0)+1;
        await new Promise(resolve=>window.__completeGift=resolve);
        if(window.__failGift) throw new Error('Offline test');`)
      assert(body.includes('__completeGift'))
      await route.fulfill({ response, body })
    })
    const load = async () => {
      await page.goto(`${base}/tools/game-preview.html`)
      await page.waitForFunction(() => window.__sneakersTest?.scene.playerImage)
    }
    const state = () => page.evaluate(() => ({ canRun: window.__sneakersTest.scene.canRun, held: window.__sneakersTest.scene.utilityHeld, calls: window.__giftCalls || 0, stored: localStorage.getItem('fiskespillet-preview-sneakers') }))
    const at = async name => {
      await page.locator('details.preview-tools').evaluate(el => { el.open = true })
      await page.getByRole('button', { name: `Ved ${name}`, exact: true }).click()
      await page.locator('details.preview-tools').evaluate(el => { el.open = false })
      await page.waitForFunction(name => window.__sneakersTest?.scene.playerImage && window.__sneakersTest.scene.npcAhead()?.definition.name === name, name)
      await page.locator('.game-frame').focus()
    }
    const talk = async () => {
      if (mobile) await page.getByRole('button', { name: 'Snakk', exact: true }).last().tap()
      else await page.keyboard.press('e')
    }
    const close = async () => {
      await page.getByRole('button', { name: 'Videre ▼', exact: true }).click()
      await page.locator('.world-message').waitFor({ state: 'hidden' })
      await page.locator('.game-frame').focus()
    }
    const utility = page.getByRole('button', { name: 'Utility: hold for å løpe', exact: true })
    await load()
    assert.equal((await state()).canRun, false)
    if (mobile) assert(await utility.isDisabled(), 'B is locked without shoes')
    await page.locator('.game-frame').focus()
    await page.keyboard.down('ShiftLeft')
    assert.equal((await state()).held, false, 'Shift cannot bypass the key item')
    await page.evaluate(() => window.__sneakersTest.scene.setUtilityHeld(true))
    assert.equal((await state()).held, false, 'Scene also gates running')
    await page.keyboard.up('ShiftLeft')
    await at('Kevin'); await talk()
    await page.locator('.world-message').waitFor()
    assert.equal((await state()).calls, 0, 'Only Marita awards the shoes')
    await close()
    await at('Marita')
    // Simulate a failed write: no fake success, no running, and conversation can be retried.
    await page.evaluate(() => { window.__failGift = true })
    await talk(); await page.waitForFunction(() => window.__completeGift)
    assert.equal((await state()).canRun, false)
    await page.keyboard.press('e')
    assert.equal((await state()).calls, 1, 'Repeated action during saving does not grant twice')
    await page.evaluate(() => window.__completeGift())
    await page.getByRole('alert').filter({ hasText: 'Kunne ikke lagre joggeskoene' }).waitFor()
    assert.equal((await state()).stored, null)
    assert.equal((await state()).canRun, false)
    await close()
    await page.evaluate(() => { window.__failGift = false; window.__completeGift = null })
    await talk(); await page.waitForFunction(() => window.__completeGift)
    assert.equal((await state()).canRun, false, 'Run stays locked until the saved reward arrives')
    await page.evaluate(() => window.__completeGift())
    await page.locator('.world-message').filter({ hasText: 'Du mottok joggesko.' }).waitFor()
    const dialogue = await page.locator('.world-message').textContent()
    assert(dialogue.includes('helt rå') && dialogue.includes('60K'))
    assert.equal((await state()).stored, '1')
    await page.locator('.game-frame').screenshot({ path: `output/utility-review/marita-gift-${mode}.png` })
    await close()
    await page.waitForFunction(() => window.__sneakersTest.scene.canRun)
    if (mobile) {
      assert(await utility.isEnabled())
      const cdp = await context.newCDPSession(page), bounds = await utility.boundingBox()
      const touches = [{ id: 42, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }]
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches })
      await page.waitForFunction(() => window.__sneakersTest.scene.utilityHeld)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: touches })
    } else {
      await page.keyboard.down('ShiftLeft')
      await page.waitForFunction(() => window.__sneakersTest.scene.utilityHeld)
      await page.keyboard.up('ShiftLeft')
    }
    await talk()
    await page.locator('.world-message').waitFor()
    assert(!(await page.locator('.world-message').textContent()).includes('Du mottok joggesko.'))
    assert.equal((await state()).calls, 2, 'Owned shoes skip the reward transaction')
    await close()
    await load()
    await page.waitForFunction(() => window.__sneakersTest.scene.canRun)
    assert.equal((await state()).calls, 0, 'Reload restores ownership without another reward')
    await at('Marita'); await talk()
    await page.locator('.world-message').waitFor()
    assert(!(await page.locator('.world-message').textContent()).includes('Du mottok joggesko.'))
    await close()
    // A key item is visible in the bag and has no chest-transfer action.
    await page.locator('details.preview-tools').evaluate(el => { el.open = true })
    await page.getByRole('button', { name: 'Ved kisten', exact: true }).click()
    await page.locator('details.preview-tools').evaluate(el => { el.open = false })
    await page.waitForFunction(() => window.__sneakersTest?.scene.playerImage && window.__sneakersTest.scene.position.mapId === 'hjem2')
    await page.locator('.game-frame').focus()
    if (mobile) await page.getByRole('button', { name: 'Åpne kiste', exact: true }).tap()
    else await page.keyboard.press('e')
    await page.getByRole('tab', { name: 'Nøkkelgjenstander', exact: true }).click()
    const item = page.locator('.inventory-item').filter({ hasText: 'Joggesko' })
    await item.waitFor()
    assert((await item.textContent()).includes('×1'))
    assert.equal(await item.getByRole('button').count(), 0, 'Key items cannot be transferred')
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`${mode}: no starter running, confirmed first gift, failure/retry, spam prevention, repeat talk, reload and B/Shift unlock passed`)
  }
} finally { await browser.close() }
