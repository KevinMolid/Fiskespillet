// Exercise GamePage's real fishing completion callback with offline preview
// services. Test-only callbacks/scene access are injected in served responses.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5180'
await mkdir('output/fishing-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'landscape']) {
    const mobile = mode !== 'desktop'
    const context = await browser.newContext({ viewport: mode === 'desktop' ? { width: 1280, height: 900 }
      : mode === 'mobile' ? { width: 390, height: 844 } : { width: 844, height: 390 },
      deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/, () => {})
    await page.route(/\/src\/game\/GamePage\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('const canFishNow =', 'window.__finishCatch = finishFishingSession; const canFishNow =')
      assert(body.includes('__finishCatch'))
      await route.fulfill({ response, body })
    })
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('return { game, scene };', 'window.__catchWorld = scene; return { game, scene };')
      assert(body.includes('__catchWorld'))
      await route.fulfill({ response, body })
    })
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace(/worm:\s*5/, 'worm: 99').replace('equippedBait: "bread"', 'equippedBait: "worm"')
      body = body.replace('recordEncounter: async (_uid, speciesId, grams, caught, bait, locationId) => {',
        'recordEncounter: async (_uid, speciesId, grams, caught, bait, locationId) => { if(window.__failCatchSave) throw new Error("Test: fangsten kunne ikke lagres"); if(window.__catchSaveGate) await window.__catchSaveGate;')
      assert(body.includes('__failCatchSave') && body.includes('worm: 99'))
      await route.fulfill({ response, body })
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__catchWorld?.playerImage)
    // A new species that has previously been seen, but never caught.
    await page.evaluate(() => {
      localStorage.setItem('fiskespillet-preview-fishbook-v1', JSON.stringify([{
        speciesId: 'laks', seenCount: 1, caughtCount: 0, smallestGrams: null,
        largestGrams: null, lastGrams: null, firstSeenAt: {}, firstCaughtAt: null, updatedAt: {},
      }]))
    })
    await page.reload()
    await page.waitForFunction(() => window.__catchWorld?.playerImage)
    await page.getByText('Teststeder og posisjon', { exact: true }).click()
    await page.getByRole('button', { name: 'Fiske ved bryggen', exact: true }).click()
    await page.waitForFunction(() => window.__catchWorld?.position.x === 24 && window.__catchWorld.playerImage)
    await page.getByText('Teststeder og posisjon', { exact: true }).click()
    const start = async () => {
      await page.locator('.game-frame').focus()
      await page.keyboard.press('e')
      try { await page.getByRole('dialog', { name: 'Kastelengde' }).waitFor({ timeout: 5000 }) }
      catch (error) {
        console.log(await page.evaluate(() => ({ text: document.body.innerText, position: window.__catchWorld.position,
          blocked: window.__catchWorld.uiBlocked, fishing: window.__catchWorld.fishing })))
        throw error
      }
    }
    const land = grams => page.evaluate(async grams => {
      const { FISH_BY_ID } = await import('/src/game/fish.ts')
      await window.__finishCatch({ type: 'landed', species: FISH_BY_ID.laks, grams, bait: 'worm' })
    }, grams)
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('fiskespillet-preview-fishbook-v1')).find(e => e.speciesId === 'laks'))
    const dismiss = async (method = 'action') => {
      if (method === 'escape') await page.keyboard.press('Escape')
      else if (mobile) await page.getByRole('button', { name: 'Videre', exact: true }).last().tap()
      else await page.keyboard.press('Space')
      await page.waitForFunction(() => !document.querySelector('.catch-dialog'))
      assert.equal(await page.evaluate(() => window.__catchWorld.fishing), false)
    }
    for (const [grams, title, previous] of [
      [2500, 'Ny fisketype!', null], [6000, 'Ny rekord: største fisk!', '2,50 kg'], [1200, 'Ny rekord: minste fisk!', '2,50 kg'],
    ]) {
      await start()
      if (previous === null) {
        // No popup, record or reward until persistence succeeds.
        await page.evaluate(() => { window.__catchSaveGate = new Promise(resolve => { window.__releaseCatchSave = resolve }) })
        await page.evaluate(async grams => {
          const { FISH_BY_ID } = await import('/src/game/fish.ts')
          window.__pendingCatch = window.__finishCatch({ type: 'landed', species: FISH_BY_ID.laks, grams, bait: 'worm' })
        }, grams)
        await page.getByText('Du landet fisken …', { exact: true }).waitFor()
        assert.equal(await page.locator('.catch-dialog').count(), 0)
        await page.keyboard.press('Space')
        assert.equal((await saved()).caughtCount, 0)
        await page.evaluate(async () => { window.__releaseCatchSave(); await window.__pendingCatch; window.__catchSaveGate = null })
      } else await land(grams)
      const dialog = page.getByRole('dialog', { name: title })
      await dialog.waitFor()
      assert((await dialog.innerText()).includes('Laks er lagt i sekken'))
      assert(!(await dialog.innerText()).includes('mynter'),'Record notices award fish, not coins')
      assert.equal(await page.locator('.world-message').count(), 0, 'No duplicate result banner')
      const image = dialog.getByRole('img', { name: 'Laks' })
      await image.waitFor()
      await page.waitForFunction(() => { const im = document.querySelector('.catch-dialog img'); return im?.complete && im.naturalWidth > 0 })
      const imageBounds=await image.boundingBox(),artBounds=await dialog.locator('.catch-art').boundingBox()
      assert(imageBounds.x>=artBounds.x && imageBounds.y>=artBounds.y && imageBounds.x+imageBounds.width<=artBounds.x+artBounds.width
        && imageBounds.y+imageBounds.height<=artBounds.y+artBounds.height,'The whole image must fit inside its stage, with no clipping')
      if (previous) {
        assert((await dialog.innerText()).includes('Forrige rekord'))
        assert((await dialog.innerText()).includes(previous))
      } else assert((await dialog.innerText()).includes('for første gang'))
      const before = await page.evaluate(() => ({ ...window.__catchWorld.position }))
      await page.keyboard.press('ArrowRight')
      assert.deepEqual(await page.evaluate(() => ({ ...window.__catchWorld.position })), before, 'Dialog blocks world movement')
      const bounds = await dialog.boundingBox(), frame = await page.locator('.game-frame').boundingBox()
      assert(bounds.x >= frame.x && bounds.y >= frame.y && bounds.x + bounds.width <= frame.x + frame.width && bounds.y + bounds.height <= frame.y + frame.height)
      const buttonBounds=await dialog.getByRole('button',{name:'Videre',exact:true}).boundingBox()
      assert(buttonBounds.y>=bounds.y && buttonBounds.y+buttonBounds.height<=bounds.y+bounds.height,'Continue stays visible without scrolling')
      await page.locator('.game-frame').screenshot({ path: `output/fishing-review/catch-${grams}-${mode}.png` })
      await dismiss(grams === 1200 ? 'escape' : 'action')
    }
    assert.equal((await saved()).smallestGrams, 1200)
    assert.equal((await saved()).largestGrams, 6000)
    for (const grams of [3000, 1200, 6000]) {
      const count=(await saved()).caughtCount
      await start(); await land(grams)
      await page.locator('.world-message').waitFor()
      assert.equal(await page.locator('.catch-dialog').count(), 0, 'Ordinary catches and ties keep the standard message')
      assert.equal(await page.getByRole('alert').count(),0)
      assert.equal((await saved()).caughtCount,count+1)
      await dismiss()
    }
    // Failure cannot award or announce a record. An escaped fish also cannot.
    const beforeFailure = await saved()
    await start(); await page.evaluate(() => { window.__failCatchSave = true }); await land(7000)
    await page.getByRole('alert').waitFor()
    assert.equal(await page.locator('.catch-dialog').count(), 0)
    assert.deepEqual(await saved(), beforeFailure)
    await dismiss(); await page.evaluate(() => { window.__failCatchSave = false })
    await start()
    await page.evaluate(() => window.__finishCatch({ type: 'escaped', reason: 'no-bite', bait: 'worm' }))
    await page.locator('.world-message').waitFor()
    assert((await page.locator('.world-message').innerText()).includes('Ingen napp denne gangen.'))
    assert(!(await page.locator('.world-message').innerText()).includes('Agnet er brukt'))
    assert.equal(await page.locator('.catch-dialog').count(), 0)
    assert.deepEqual(await saved(), beforeFailure)
    assert.deepEqual(errors, [])
    console.log(`${mode}: images, first species, min/max, old weights, ties, save gating/failure, escaped fish, action/Escape and movement blocking passed.`)
    await context.close()
  }
} finally { await browser.close() }
