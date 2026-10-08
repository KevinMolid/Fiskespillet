// Verify rendered travel across tile boundaries using real held controls.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5180'
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:900},
      deviceScaleFactor:mobile ? 3 : 1, isMobile:mobile, hasTouch:mobile })
    const page = await context.newPage(), errors = []
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    await page.clock.install()
    await page.addInitScript(() => localStorage.setItem('fiskespillet-preview-sneakers', '1'))
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__travelTest={game,scene}; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('__travelTest'))
      await route.fulfill({response, body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__travelTest?.scene.playerImage)
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()+100)))
    const cdp = mobile ? await context.newCDPSession(page) : null
    await page.evaluate(() => {
      const {scene,game} = window.__travelTest
      window.__travelSamples=[]
      game.events.on('postrender', () => window.__travelSamples.push({time:scene.time.now,x:scene.player.x,y:scene.player.y,
        moving:scene.moving,texture:scene.playerImage.texture.key,phase:scene.playerWalkPhase,depth:scene.player.depth,nextMove:scene.nextMove}))
    })
    for (const running of [false,true]) {
      await page.evaluate(running => {
        const s=window.__travelTest.scene
        s.setUiBlocked(false);s.finishFishing();s.setCanRun(true);s.setUtilityHeld(running)
        s.nextMove=0;s.playerWalkPhase=-1;s.enterMap({mapId:'havn',x:14,y:16,facing:'right'})
        window.__travelSamples=[]
      },running)
      await page.locator('.game-frame').focus()
      if (mobile) {
        const b=await page.getByRole('button',{name:'Høyre',exact:true}).boundingBox()
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:b.x+b.width/2,y:b.y+b.height/2}]})
      } else await page.keyboard.down('ArrowRight')
      await page.clock.runFor(running ? 400 : 700)
      const samples=await page.evaluate(() => window.__travelSamples.filter(s=>s.moving))
      assert(samples.length>15,'Enough rendered samples across multiple tile boundaries')
      const duration=(mobile ? 150 : 145)/(running ? 2 : 1)
      for (let i=1;i<samples.length;i++) {
        const a=samples[i-1],b=samples[i],dt=b.time-a.time
        if(dt<=0) continue
        assert(Math.abs((b.x-a.x)-32*dt/duration)<.001,
          `${mode}/${running?'run':'walk'}: no stationary gap or velocity jump at tile boundary (${a.phase}→${b.phase})`)
        assert.equal(b.y,a.y)
        assert.equal(b.depth,b.y,'Depth follows the interpolated feet position')
      }
      const phases=[...new Set(samples.map(s=>s.phase))]
      assert(phases.length>=4,'Cross at least three tile boundaries')
      for(const phase of phases) {
        const textures=[...new Set(samples.filter(s=>s.phase===phase).map(s=>s.texture))]
        assert.deepEqual(textures,[`player-right-walk-${[1,3,2,3][phase%4]}`],'One gait image per tile')
      }
      if(mobile) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
      else await page.keyboard.up('ArrowRight')
      await page.clock.runFor(240)
      const stopped=await page.evaluate(()=>{
        const s=window.__travelTest.scene
        return {position:{...s.position},x:s.player.x,y:s.player.y,moving:s.moving,texture:s.playerImage.texture.key}
      })
      assert(!stopped.moving);assert.equal(stopped.x,stopped.position.x*32+16)
      assert.equal(stopped.texture,'player-right','Release finishes the current tile and returns to idle')
      await page.clock.runFor(300)
      assert.equal(await page.evaluate(()=>window.__travelTest.scene.player.x),stopped.x,'No further travel after release')
    }
    if(!mobile) {
      await page.evaluate(() => {
        const s=window.__travelTest.scene
        s.setUtilityHeld(false);s.nextMove=0;s.enterMap({mapId:'havn',x:14,y:16,facing:'right'})
        window.__travelSamples=[];window.__turnedAt=undefined
        const onPosition=s.callbacks.onPosition
        s.callbacks.onPosition=(p,transitioned)=>{ if(p.facing==='left'&&p.x===15) window.__turnedAt=s.time.now;onPosition(p,transitioned) }
      })
      await page.keyboard.down('ArrowRight')
      await page.clock.runFor(70)
      await page.keyboard.up('ArrowRight');await page.keyboard.down('ArrowLeft')
      // Observe actual rendered frames instead of assuming fake wall-clock time
      // equals Phaser's smoothed game clock, particularly with Canvas rendering.
      let resumed=false
      for(let frame=0;frame<25&&!resumed;frame++) {
        await page.clock.runFor(16)
        resumed=await page.evaluate(()=>{const s=window.__travelTest.scene;return s.position.facing==='left'&&s.moving})
      }
      assert(resumed,'Held reverse direction resumes after its turn delay')
      const turn=await page.evaluate(()=>({at:window.__turnedAt,samples:window.__travelSamples
        .filter(s=>!s.moving&&s.texture==='player-left'&&s.x===15*32+16)}))
      assert(turn.samples.length>=2,'Visible stationary turn at the tile endpoint')
      for(const sample of turn.samples)assert.equal(sample.nextMove-turn.at,50,
        'Changing heading at a tile boundary waits the full 50ms after the visible turn')
      await page.keyboard.up('ArrowLeft');await page.clock.runFor(240)
      assert.equal(await page.evaluate(()=>window.__travelTest.scene.position.x),14)
    }
    assert.deepEqual(errors,[])
    console.log(`${mode}: constant rendered velocity across walk/run tile boundaries, per-tile gait, ground depth and release passed`)
    await context.close()
  }
} finally { await browser.close() }
