// Exercise actual GamePage keyboard/two-finger controls with offline services.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175'
await mkdir('output/utility-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'narrow', 'landscape', 'canvas']) {
    const mobile = ['mobile', 'narrow', 'landscape'].includes(mode)
    const viewport = mode === 'mobile' ? {width:390,height:844} : mode === 'narrow' ? {width:320,height:740}
      : mode === 'landscape' ? {width:844,height:390} : {width:1280,height:900}
    const context = await browser.newContext({viewport,deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page = await context.newPage(), errors=[]
    await page.clock.install()
    await page.addInitScript(()=>{
      localStorage.setItem('fiskespillet-preview-sneakers', '1')
      window.__pointerEvents=[]
      for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture']) document.addEventListener(type,e=>window.__pointerEvents.push({type,id:e.pointerId,label:e.target.closest?.('button')?.getAttribute('aria-label')}),true)
    })
    page.on('pageerror', error=>errors.push(error.message))
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/, async route => {
      const response=await route.fetch()
      await route.fulfill({response,body:(await response.text()).replace('equippedBait: "bread"','equippedBait: "spinner"')})
    })
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };','window.__utilityTest={game,scene}; return { game, scene };')
      if(mode==='canvas') body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('__utilityTest'))
      await route.fulfill({response,body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(()=>window.__utilityTest?.scene.playerImage).catch(error=>{ console.error('Startup errors:',errors);throw error })
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)))
    const advance=ms=>page.clock.runFor(ms)
    const state = ()=>page.evaluate(()=>{
      const s=window.__utilityTest.scene
      return {position:{...s.position},held:s.utilityHeld,moving:s.moving,follow:s.cameras.main._follow===s.player,texture:s.playerImage.texture.key}
    })
    const reset = async(facing='right')=>{
      await page.evaluate(facing=>{
        const s=window.__utilityTest.scene
        s.setUtilityHeld(false);s.setUiBlocked(false);s.nextMove=0
        s.enterMap({mapId:'havn',x:14,y:16,facing})
      },facing)
      await advance(100)
      await page.locator('.game-frame').focus()
    }
    const cdp=mobile?await context.newCDPSession(page):null
    let touches=[]
    const touchStart = async(name,id)=>{
      const b=await page.getByRole('button',{name,exact:true}).boundingBox()
      touches.push({id,x:b.x+b.width/2,y:b.y+b.height/2})
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches})
    }
    const touchEnd = async id=>{
      const ended=touches.find(t=>t.id===id)
      touches=touches.filter(t=>t.id!==id)
      // CDP touchEnd points identify the contacts ending, not contacts remaining.
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ended?[ended]:[]})
    }
    const utility='Utility: hold for å løpe'
    const startUtility=()=>mobile?touchStart(utility,2):page.keyboard.down('ShiftLeft')
    const endUtility=()=>mobile?touchEnd(2):page.keyboard.up('ShiftLeft')
    const startDirection=()=>mobile?touchStart('Høyre',1):page.keyboard.down('ArrowRight')
    const endDirection=()=>mobile?touchEnd(1):page.keyboard.up('ArrowRight')
    await reset()
    await startUtility();await advance(180)
    assert((await state()).held)
    assert.equal((await state()).position.x,14,'Utility alone never walks')
    await endUtility();assert(!(await state()).held)
    await reset('left');await startUtility();await startDirection()
    await advance(25)
    assert((await state()).moving,'Running starts a step immediately when facing changes')
    await endDirection();await advance(160)
    assert.deepEqual((await state()).position,{mapId:'havn',x:15,y:16,facing:'right'},'A short run tap turns and takes one step without a turn delay')
    assert((await state()).held,'Releasing the direction must not release utility: '+JSON.stringify(await page.evaluate(()=>window.__pointerEvents)))
    await endUtility()
    await reset('left');await startDirection();await advance(35)
    assert(!(await state()).moving,'Walking is still in its 50 ms turn window')
    await startUtility();await advance(20)
    assert((await state()).moving,'Pressing utility during the turn window removes the remaining delay')
    await endDirection();await endUtility();await advance(180)
    const travel=async run=>{
      await reset()
      if(run) await startUtility()
      await startDirection();await advance(620)
      await endDirection();await advance(180)
      const result=await state()
      if(run) {assert(result.held);await endUtility()}
      const stopped=await state();await advance(180)
      assert.deepEqual((await state()).position,stopped.position,'Released direction cannot keep moving')
      assert(stopped.follow)
      return result.position.x-14
    }
    const walked=await travel(false),ran=await travel(true)
    assert(walked>=3&&ran>=walked*1.5,`Running must be faster on ${mode}: walked ${walked}, ran ${ran}`)
    // Changing run cadence with the direction still down does not cancel it.
    await reset();await startDirection();await advance(320)
    await startUtility();assert((await state()).held);await advance(320)
    await endUtility();assert(!(await state()).held)
    const slowStart=(await state()).position.x
    await advance(350);assert((await state()).position.x>slowStart,'Utility release restores walking, rather than stopping direction input')
    await endDirection();await advance(180)
    await reset();await startUtility()
    if(mobile) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});touches=[]
      assert(!(await state()).held,'Touch cancellation cannot leave run held')
      await startUtility()
    } else {
      await page.keyboard.down('ShiftRight');await page.keyboard.up('ShiftLeft')
      assert((await state()).held,'The other Shift remains held')
      await page.keyboard.up('ShiftRight');assert(!(await state()).held)
      await startUtility()
    }
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
    assert(!(await state()).held,'Focus loss stops utility')
    await endUtility()
    await startUtility()
    if(mobile) await page.getByRole('button',{name:'Meny',exact:true}).tap()
    else await page.keyboard.press('Enter')
    await page.getByRole('dialog').waitFor();assert(!(await state()).held,'Menu entry clears utility')
    await page.keyboard.press('ShiftLeft');assert(!(await state()).held,'Shift cannot run inside menus')
    if(mobile) assert(await page.getByRole('button',{name:'B: tilbake',exact:true}).isEnabled())
    await endUtility();await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({state:'hidden'});assert(!(await state()).held,'Closing a menu does not re-arm an old hold')
    await reset()
    await page.evaluate(()=>window.__utilityTest.scene.enterMap({mapId:'havn',x:1,y:16,facing:'left'}))
    await startUtility()
    await page.evaluate(()=>window.__utilityTest.scene.move('left'))
    assert.equal((await state()).position.x,1,'Running cannot bypass map collision')
    await endUtility()
    await page.evaluate(()=>window.__utilityTest.scene.enterMap({mapId:'havn',x:15,y:12,facing:'left'}))
    await startUtility();await page.evaluate(()=>window.__utilityTest.scene.move('left'))
    assert.equal((await state()).position.x,15,'Running cannot bypass NPC occupancy')
    await endUtility()
    await page.evaluate(()=>window.__utilityTest.scene.enterMap({mapId:'havn',x:46,y:16,facing:'right'}))
    await startUtility();await page.evaluate(()=>window.__utilityTest.scene.move('right'))
    await advance(160)
    assert.equal((await state()).position.mapId,'skogstjern','Running keeps normal map transitions')
    await endUtility()
    await page.evaluate(()=>window.__utilityTest.scene.enterMap({mapId:'havn',x:24,y:25,facing:'down'}))
    await startUtility()
    if(mobile) await page.getByRole('button',{name:'Fisk',exact:true}).last().tap()
    else await page.keyboard.press('e')
    await page.getByRole('dialog',{name:'Kastelengde'}).waitFor();assert(!(await state()).held,'Fishing clears utility')
    await endUtility();await page.keyboard.press('Escape')
    if(mobile) {
      const layout=await page.locator('.handheld-controls').evaluate(el=>{
        const buttons=[...el.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),x:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))
        const d=el.querySelector('.dpad').getBoundingClientRect(),u=el.querySelector('.pocket-utility').getBoundingClientRect()
        return {buttons,width:innerWidth,overlap:d.right>u.left}
      })
      assert(layout.buttons.every(b=>b.x>=0&&b.right<=layout.width),JSON.stringify(layout))
      assert(!layout.overlap,'Utility must not overlap the dpad')
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      await page.locator('.game-shell').screenshot({path:`output/utility-review/${mode}.png`})
    }
    assert.deepEqual(errors,[])
    console.log(`${mode}: walk ${walked}/run ${ran} tiles, 50ms walk turns/immediate run turns, independent holds, release/cancel/blur/menu/fishing reset, collision, transitions and layout passed`)
    await context.close()
  }
} finally {await browser.close()}
