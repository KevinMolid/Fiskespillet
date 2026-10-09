// Real GamePage/controls, offline services only. B navigates a level; Menu toggles all.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181'
await mkdir('output/back-menu-review',{recursive:true})
try {
  for(const [mode,width,height] of [['desktop',1280,900],['mobile',390,844],['narrow',320,740],['landscape',844,390]]) {
    const mobile=mode!=='desktop'
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      const body=(await response.text()).replace('return { game, scene };','window.__backWorld=scene; return { game, scene };')
      assert(body.includes('__backWorld'));await route.fulfill({response,body})
    })
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      const body=(await response.text()).replace('setEquippedBait: async (_uid, bait) => {','setEquippedBait: async (_uid, bait) => { if(window.__inventoryGate) await window.__inventoryGate;')
        .replace('saveAppearance: async (_uid, a) => {','saveAppearance: async (_uid, a) => { window.__lookWrites=(window.__lookWrites||0)+1;')
      assert(body.includes('__inventoryGate'));await route.fulfill({response,body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(()=>window.__backWorld?.playerImage)
    const position=await page.evaluate(()=>window.__backWorld.getPosition())
    const menu=async()=>mobile?page.getByRole('button',{name:'Meny',exact:true}).click():page.keyboard.press('Enter')
    const back=async()=>mobile?page.getByRole('button',{name:'B: tilbake',exact:true}).click():page.keyboard.press('b')
    const root=page.getByRole('dialog',{name:'Spillmeny'}),book=page.getByRole('dialog',{name:'Fiskeboken'}),bag=page.getByRole('dialog',{name:'Sekken'})
    const noBackButtons=async()=>{
      const labels=await page.locator('.game-frame [role="dialog"] button').allTextContents()
      assert(!labels.some(s=>/tilbake|lukk|avbryt|←\s*Fiskeboken/i.test(s)),'No inline return/close buttons remain')
    }
    await page.locator('.game-frame').focus();await menu();await root.waitFor();await noBackButtons()
    if(mobile) assert(await page.getByRole('button',{name:'B: tilbake'}).isEnabled(),'B is available without sneakers inside menus')
    await root.getByRole('button',{name:/Sekk/}).click();await bag.waitFor();await noBackButtons()
    await back();await root.waitFor();assert.equal(await bag.count(),0,'B returns bag to root, not world')
    await root.getByRole('button',{name:/Sekk/}).click();await bag.waitFor()
    await menu();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
    assert.equal(await page.locator('.game-frame [role="dialog"]').count(),0,'Menu closes every level')
    await menu();await root.waitFor()
    await root.getByRole('button',{name:/Fiskebok/}).click();await book.waitFor();await noBackButtons()
    await book.getByRole('option',{name:/^Mort,/}).click()
    if(mobile) {
      await page.locator('.fish-book-dialog.is-mobile-detail').waitFor()
      assert.equal(await page.evaluate(()=>document.activeElement.className),'fish-details','Detail scrolling receives focus')
      await page.getByRole('button',{name:'Velg',exact:true}).click()
      assert(await page.locator('.fish-book-dialog').evaluate(el=>el.classList.contains('is-mobile-detail')),'A no longer acts as Back')
      // Holding B performs exactly one step; release must not activate running.
      const b=await page.getByRole('button',{name:'B: tilbake'}).boundingBox()
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down()
      await page.locator('.fish-book-dialog.is-mobile-list').waitFor();await page.waitForTimeout(200)
      assert.equal(await root.count(),0);await page.mouse.up()
      assert.equal(await page.getByRole('dialog',{name:'Fiskeboken'}).count(),1)
    }
    await back();await root.waitFor()
    await root.getByRole('button',{name:/Fiskebok/}).click();await book.waitFor()
    await book.getByRole('option',{name:/^Mort,/}).click()
    await menu();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
    await menu();await root.waitFor();assert.equal(await book.count(),0,'Menu does not reopen a closed fish detail')
    await page.screenshot({path:`output/back-menu-review/menu-${mode}.png`,fullPage:true})
    await back();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
    assert.deepEqual(await page.evaluate(()=>window.__backWorld.getPosition()),position,'Menu inputs do not move the player')

    // Pending inventory writes block Back and Menu without abandoning the update.
    await menu();await root.waitFor();await root.getByRole('button',{name:/Sekk/}).click()
    await bag.getByRole('tab',{name:'Forbruk'}).click()
    await page.evaluate(()=>{window.__inventoryGate=new Promise(resolve=>window.__completeInventory=resolve)})
    await bag.getByRole('button',{name:'Velg agn',exact:true}).first().click()
    if(mobile) {
      assert(await page.getByRole('button',{name:'B: tilbake'}).isDisabled())
      assert(await page.getByRole('button',{name:'Meny',exact:true}).isDisabled())
    }
    await page.keyboard.press('b');await page.keyboard.press('Enter');assert.equal(await bag.count(),1)
    await page.evaluate(()=>{window.__completeInventory();window.__inventoryGate=null})
    await bag.getByRole('button',{name:'Ta av agn',exact:true}).waitFor()
    await back();await root.waitFor();await menu();await page.locator('[role="dialog"]').waitFor({state:'hidden'})

    const at=async(label,dialog)=>{
      await page.locator('details.preview-tools').evaluate(el=>el.open=true)
      await page.getByRole('button',{name:label,exact:true}).click()
      await page.locator('details.preview-tools').evaluate(el=>el.open=false)
      await page.waitForFunction(()=>window.__backWorld?.playerImage)
      await page.locator('.game-frame').focus()
      await page.keyboard.press('e');await page.getByRole('dialog',{name:dialog}).waitFor();await noBackButtons()
    }
    for(const [label,dialog] of [['Ved butikkdisken','Agnbutikken'],['Ved kisten','Oppbevaringskiste'],['Ved garderoben','Garderoben']]) {
      await at(label,dialog)
      if(dialog==='Garderoben') await page.locator('.color-options button').nth(1).click()
      await back();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
      if(dialog==='Garderoben') assert.equal(await page.evaluate(()=>window.__lookWrites||0),0,'B cancels draft without saving')
      await at(label,dialog);await menu();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
    }
    // Utility only runs in the world, never while B is used for menu back.
    await page.evaluate(()=>localStorage.setItem('fiskespillet-preview-sneakers','1'));await page.reload()
    await page.waitForFunction(()=>window.__backWorld?.playerImage&&window.__backWorld.canRun)
    await page.locator('.game-frame').focus();await page.keyboard.down('ShiftLeft')
    await page.waitForFunction(()=>window.__backWorld.utilityHeld)
    await menu();await root.waitFor();assert.equal(await page.evaluate(()=>window.__backWorld.utilityHeld),false)
    await page.keyboard.up('ShiftLeft');await back();await page.locator('[role="dialog"]').waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>window.__backWorld.utilityHeld),false,'Back cannot re-arm a previous run hold')
    assert.deepEqual(errors,[])
    await context.close()
    console.log(`${mode}: B one-level back, fish-detail focus/list return, no inline return buttons, Menu whole-close, pending save lock, shop/chest/wardrobe cancellation, world running and no ghost holds passed.`)
  }
} finally {await browser.close()}
