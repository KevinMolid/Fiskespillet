// Reproduce continued saves with owned shoes, then exit and resume through the UI.
// All fixtures are offline; no real account data is written.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181'
await mkdir('output/continue-review', { recursive: true })
try {
  for(const [mode,width,height] of [['desktop',1280,900],['mobile',390,844],['landscape',844,390],['canvas',1280,900]]) {
    if(process.env.TEST_MODES && !process.env.TEST_MODES.split(',').includes(mode)) continue
    const mobile = mode === 'mobile' || mode === 'landscape'
    const context = await browser.newContext({ viewport:{width,height},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile })
    const page = await context.newPage(), errors = []
    page.on('pageerror',e=>errors.push(e.message))
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    await page.addInitScript(()=>localStorage.setItem('fiskespillet-preview-sneakers','1'))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route=>{
      const response=await route.fetch()
      let body=(await response.text()).replace('return { game, scene };','window.__resumeWorld={game,scene}; return { game, scene };')
      if(mode==='canvas') body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('__resumeWorld'))
      await route.fulfill({response,body})
    })
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      const body=(await response.text()).replace('savePosition: async (_uid, p) => {',
        'savePosition: async (_uid, p) => { window.__positionWrites=(window.__positionWrites||0)+1; if(window.__exitGate) await window.__exitGate; if(window.__failExit) throw new Error("offline");')
      assert(body.includes('__exitGate'))
      await route.fulfill({response,body})
    })
    const choice=page.getByRole('dialog',{name:'Velg spillkarakter'})
    const menu=page.getByRole('dialog',{name:'Spillmeny'})
    const openMenu=async()=>{
      if(mobile) await page.getByRole('button',{name:'Meny eller tilbake'}).click()
      else { await page.locator('.game-frame').focus(); await page.keyboard.press('Enter') }
      await menu.waitFor()
    }
    for(const variant of ['female','male','legacy']) {
      await page.goto(`${base}/tools/game-preview.html?character=${variant}`)
      await page.waitForFunction(()=>window.__resumeWorld?.scene.playerImage)
      assert.equal(await choice.count(),0,`${variant}: continue does not ask for character`)
      const expected=variant==='female'?'player-female':'player'
      assert.equal(await page.evaluate(()=>window.__resumeWorld.scene.playerImage.texture.key),`${expected}-down`)
      assert.equal(await page.evaluate(()=>window.__resumeWorld.scene.canRun),true,'Owned shoes initialize every mounted scene')
      await page.locator('.game-frame').focus()
      if(mobile) {
        const b=await page.getByRole('button',{name:'Utility: hold for å løpe'}).boundingBox()
        const cdp=await context.newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]})
        await page.waitForFunction(()=>window.__resumeWorld.scene.utilityHeld)
        await page.evaluate(()=>window.__resumeWorld.scene.move('right',true))
        assert.equal(await page.evaluate(()=>window.__resumeWorld.scene.playerStep.duration),75,'B uses running movement cadence')
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await cdp.detach()
      } else {
        await page.keyboard.down('ShiftLeft')
        await page.waitForFunction(()=>window.__resumeWorld.scene.utilityHeld)
        await page.keyboard.down('ArrowRight')
        await page.waitForFunction(()=>window.__resumeWorld.scene.playerStep?.duration===72.5)
        await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft')
      }
      await page.waitForFunction(()=>!window.__resumeWorld.scene.moving)
      const before=await page.evaluate(()=>window.__resumeWorld.scene.getPosition())
      await openMenu()
      const exit=menu.getByRole('button',{name:/Gå ut av spillet/})
      const fits=await exit.evaluate(button=>{const r=button.getBoundingClientRect(),f=button.closest('.game-frame').getBoundingClientRect();return r.top>=f.top&&r.bottom<=f.bottom+1&&r.right<=f.right+1})
      assert(fits,`${mode}: exit button is visible in the game frame`)
      if(variant==='female') {
        await page.screenshot({path:`output/continue-review/menu-${mode}.png`,fullPage:true})
        // A failed or pending save cannot unmount the game or change character.
        await page.evaluate(()=>{window.__failExit=true})
        await exit.click(); await menu.getByRole('alert').waitFor()
        assert.equal(await page.getByRole('button',{name:/Fortsett spill/}).count(),0)
        assert.deepEqual(await page.evaluate(()=>window.__resumeWorld.scene.getPosition()),before)
        await page.evaluate(()=>{window.__failExit=false;window.__exitGate=new Promise(resolve=>window.__releaseExit=resolve)})
        await exit.click()
        await menu.getByRole('status').waitFor()
        assert(await exit.isDisabled()); assert(await menu.getByRole('button',{name:/Tilbake til spillet/}).isDisabled())
        await page.evaluate(()=>{window.__releaseExit();window.__exitGate=null})
      } else await exit.click()
      await page.getByRole('button',{name:/Fortsett spill/}).waitFor()
      assert.equal(await page.locator('.game-frame canvas').count(),0,'Exit destroys Phaser scene')
      assert.equal(await choice.count(),0)
      assert(await page.getByRole('button',{name:'Nytt spill',exact:true}).isVisible())
      await page.evaluate(()=>{window.__priorScene=window.__resumeWorld.scene})
      await page.getByRole('button',{name:/Fortsett spill/}).click()
      await page.waitForFunction(()=>window.__resumeWorld?.scene !== window.__priorScene && window.__resumeWorld?.scene.playerImage && !document.querySelector('.start-screen'))
      const resumed=await page.evaluate(()=>({p:window.__resumeWorld.scene.getPosition(),texture:window.__resumeWorld.scene.playerImage.texture.key,canRun:window.__resumeWorld.scene.canRun}))
      assert.deepEqual(resumed.p,before); assert.equal(resumed.texture,`${expected}-${before.facing}`); assert(resumed.canRun)
      assert.equal(await choice.count(),0,'Repeated continue still skips character selection')
      assert(await page.getByText('Hold Shift: løp',{exact:false}).count() || mobile)
    }
    // Running remains locked without the key item, even after exiting/resuming.
    // Remove ownership from the fixture before services return the inventory.
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      const body=(await response.text()).replace('inventory.bag.sneakers = 1;', 'delete inventory.bag.sneakers;')
      await route.fulfill({response,body})
    })
    await page.goto(`${base}/tools/game-preview.html?character=female&no-shoes=1`)
    await page.waitForFunction(()=>window.__resumeWorld?.scene.playerImage)
    assert.equal(await page.evaluate(()=>window.__resumeWorld.scene.canRun),false)
    if(mobile) assert(await page.getByRole('button',{name:'Utility: hold for å løpe'}).isDisabled())
    await page.locator('.game-frame').focus(); await page.keyboard.down('ShiftLeft')
    assert.equal(await page.evaluate(()=>window.__resumeWorld.scene.utilityHeld),false)
    await page.keyboard.up('ShiftLeft')
    assert.deepEqual(errors,[])
    console.log(`${mode}: female/male/legacy continue without selection, owned-shoes running, B/Shift cadence, exit/save failure/retry/pending gate, canvas cleanup, position/character resume and no-shoes lock passed.`)
    await context.close()
  }
} finally { await browser.close() }
