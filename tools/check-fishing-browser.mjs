// Real GamePage/Phaser integration, with offline services and instrumentation
// confined to the served test responses. No test exports in production code.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless:true, channel:'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173'
await mkdir('output/fishing-review',{recursive:true})
try {
  for(const mode of (process.env.FISHING_TEST_MODES?.split(',') ?? ['desktop','mobile','landscape','canvas'])) {
    const mobile=mode==='mobile'||mode==='landscape'
    const context=await browser.newContext({viewport:mode==='mobile'?{width:390,height:844}:mode==='landscape'?{width:844,height:390}:{width:1280,height:900},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    // Review output and source edits must not reload a paused minigame test.
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    await page.addInitScript(()=>{Math.random=()=>.1})
    await page.clock.install()
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      let body=(await response.text()).replace('equippedBait: "bread"','equippedBait: "spinner"')
      body=body.replace('consumeBait: async (_uid, bait) => {','consumeBait: async (_uid, bait) => { window.__baitUses=(window.__baitUses||0)+1;')
      body=body.replace('recordEncounter: async (_uid, speciesId, grams, caught, bait, locationId) => {','recordEncounter: async (_uid, speciesId, grams, caught, bait, locationId) => { window.__encounters=(window.__encounters||0)+1;')
      assert(body.includes('__baitUses')&&body.includes('__encounters'))
      await route.fulfill({response,body})
    })
    await page.route(/\/src\/game\/fish\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      const body=(await response.text()).replace('const options = fishingOptions(zoneId, bait, conditions);','window.__conditions = conditions; const options = fishingOptions(zoneId, bait, conditions);')
      assert(body.includes('__conditions'))
      await route.fulfill({response,body})
    })
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      let body=(await response.text()).replace('return { game, scene };','window.__fishingTest={game,scene}; return { game, scene };')
      if(mode==='canvas') body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('__fishingTest'))
      await route.fulfill({response,body})
    })
    const open = async ()=>{
      await page.clock.resume()
      await page.goto(`${base}/tools/game-preview.html`)
      await page.waitForFunction(()=>window.__fishingTest?.scene.playerImage)
      await page.getByText('Teststeder og posisjon',{exact:true}).click()
      await page.getByRole('button',{name:'Fiske ved bryggen',exact:true}).click()
      await page.waitForFunction(()=>window.__fishingTest?.scene.position.x===24&&window.__fishingTest.scene.position.y===25&&window.__fishingTest.scene.playerImage)
      await page.getByText('Teststeder og posisjon',{exact:true}).click()
      await page.locator('.game-frame').focus()
      if(mobile) await page.getByRole('button',{name:'Fisk',exact:true}).last().tap()
      else await page.keyboard.press('e')
      await page.getByRole('dialog',{name:'Kastelengde'}).waitFor()
      // Freeze between assertions for deterministic boundary/cancellation tests.
      await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+2000)))
      await page.clock.runFor(50) // Settle Phaser's frame delta after pausing.
    }
    const castFour = async (capture=false)=>{
      const track=await page.locator('.cast-meter-track').boundingBox()
      const x=track.x+track.width/2,y=track.y+track.height*.25
      if(mobile) await page.touchscreen.tap(x,y)
      else await page.mouse.click(x,y)
      await page.getByText('Kaster ut snøret …',{exact:true}).waitFor()
      assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).count(),0,'Depth cannot start during flight')
      assert.equal(await page.getByRole('dialog',{name:'Kastelengde'}).count(),0)
      assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-cast-forward')
      assert(!await page.evaluate(()=>window.__fishingTest.scene.castSplash),'Splash waits for the lure to land')
      const position=await page.evaluate(()=>({...window.__fishingTest.scene.position}))
      await page.keyboard.press('e');await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight')
      await page.clock.runFor(600)
      const flight=await page.evaluate(()=>{
        const s=window.__fishingTest.scene,g=s.castFlight,p=s.playerImage
        const tip=p.texture.key==='player-down-cast-forward'
        return {data:Object.fromEntries(['startX','startY','targetX','targetY','steps','progress','lureX','lureY'].map(key=>[key,g.getData(key)])),commands:g.commandBuffer.length,tip,position:{...s.position}}
      })
      assert(flight.tip&&flight.commands>0&&flight.data.progress>0&&flight.data.progress<1)
      assert.equal(flight.data.targetX,24*32+16);assert.equal(flight.data.targetY,29*32+16)
      assert.notEqual(flight.data.lureY,flight.data.targetY,'Lure is still flying')
      assert.deepEqual(flight.position,position,'Input during flight cannot move the player')
      assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).count(),0)
      if(capture) await page.locator('.game-frame').screenshot({path:`output/fishing-review/flight-${mode}.png`})
      await page.clock.runFor(760)
      assert(!await page.evaluate(()=>window.__fishingTest.scene.castFlight))
      assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-fishing-idle','Switch to relaxed fishing at landing, while the splash is still active')
      assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).count(),0,'Depth waits for the splash to finish')
      const landing=await page.evaluate(()=>{
        const s=window.__fishingTest.scene,g=s.castSplash
        if(!g) throw new Error('Missing splash after line flight')
        return {x:g.x,y:g.y,tileX:g.getData('tileX'),tileY:g.getData('tileY'),steps:g.getData('steps'),commands:g.commandBuffer.length,
          playerX:s.player.x,playerY:s.player.y,inView:s.cameras.main.worldView.contains(g.x,g.y),playerInView:s.cameras.main.worldView.contains(s.player.x,s.player.y)}
      })
      assert(landing.inView&&landing.playerInView,'Both player and landing remain visible')
      if(capture) await page.locator('.game-frame').screenshot({path:`output/fishing-review/splash-${mode}.png`})
      await page.clock.runFor(950)
      await page.getByRole('dialog',{name:'Fiskedybde'}).waitFor()
      assert(!await page.evaluate(()=>window.__fishingTest.scene.castFlight||window.__fishingTest.scene.castSplash))
      assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-fishing-idle','Keep relaxed pose during depth selection')
      assert(Number(await page.getByRole('meter',{name:'Synkende agn'}).getAttribute('aria-valuenow'))<10,'The six-second sinking clock starts after animation, not at launch')
      return landing
    }
    const selectDepth = async ()=>{
      if(mobile) await page.getByRole('button',{name:'Velg',exact:true}).last().tap()
      else await page.keyboard.press('e')
      await page.getByRole('dialog',{name:'Innsveiving',exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-fishing-idle','Keep relaxed pose during retrieval')
    }
    const tap = async()=>{
      if(mobile) await page.getByRole('button',{name:'Sveiv',exact:true}).last().tap()
      else await page.keyboard.press('Space')
    }
    const speed = async()=>Number(await page.getByRole('meter',{name:'Sveivefart',exact:true}).getAttribute('aria-valuenow'))
    const shadow = ()=>page.evaluate(()=>{
      const s=window.__fishingTest.scene,g=s.lureShadow
      return g?{x:g.x,y:g.y,progress:g.getData('progress'),distance:g.getData('distanceTiles'),commands:g.commandBuffer.length}:null
    })
    await open()
    const aiming = await page.evaluate(() => {
      const s=window.__fishingTest.scene,i=s.playerImage
      return {texture:i.texture.key,scale:i.scaleX,footY:s.player.y+i.y+(1524-i.originY*i.height)*i.scaleY,
        groundY:s.player.y+14,filter:i.texture.source[0].scaleMode}
    })
    assert.equal(aiming.texture,'player-down-cast-aim')
    assert.equal(aiming.scale,.05);assert.equal(aiming.filter,1)
    assert.equal(aiming.footY,aiming.groundY,'Casting pose retains the idle ground anchor')
    const clean=await page.getByRole('dialog',{name:'Kastelengde'}).evaluate(dialog=>{
      const style=getComputedStyle(dialog)
      return {text:dialog.textContent.replace(/\s/g,''),width:dialog.getBoundingClientRect().width,background:style.backgroundColor,image:style.backgroundImage,border:style.borderTopWidth,shadow:style.boxShadow,
        buttons:dialog.querySelectorAll('button').length,outline:getComputedStyle(dialog.querySelector('button')).outlineStyle}
    })
    assert.equal(clean.text,'LANGT54321KORT')
    assert(clean.width<=90&&clean.buttons===1)
    assert.equal(clean.background,'rgba(0, 0, 0, 0)');assert.equal(clean.image,'none')
    assert.equal(clean.border,'0px');assert.equal(clean.shadow,'none');assert.equal(clean.outline,'none')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/length-${mode}.png`})
    const landing=await castFour(true)
    assert.equal(landing.steps,4);assert.equal(landing.tileX,24);assert.equal(landing.tileY,29)
    assert.equal(landing.x,landing.playerX);assert.equal(landing.y,landing.playerY+4*32)
    assert(landing.commands>0)
    assert.equal(await page.locator('.cast-animation,.cast-scene,.cast-meter-readout,.fishing-choice-list').count(),0)
    assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).textContent().then(s=>s.replace(/\s/g,'')),'GRUNT12345DYPT')
    assert(Number(await page.getByRole('meter',{name:'Synkende agn'}).getAttribute('aria-valuenow'))<10)
    await page.clock.fastForward(2200)
    const sunk=Number(await page.getByRole('meter',{name:'Synkende agn'}).getAttribute('aria-valuenow'))
    assert(sunk>30&&sunk<65,'Depth moves down from the top over time')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/depth-${mode}.png`})
    await selectDepth()
    assert.equal(await page.getByText('Hvordan vil du sveive inn?',{exact:true}).count(),0)
    assert.equal(await page.locator('.fishing-choice-list').count(),0)
    assert.equal(await speed(),0)
    const initialShadow=await shadow()
    assert.equal(initialShadow.x,landing.x);assert.equal(initialShadow.y,landing.y);assert(initialShadow.commands>0)
    await page.clock.fastForward(6500)
    assert.equal(await speed(),0)
    assert.deepEqual(await shadow(),initialShadow,'Without input the hook remains in the water')
    assert.equal(await page.evaluate(()=>window.__baitUses||0),0)
    if(!mobile) {
      await page.keyboard.down('Space')
      assert.equal(await speed(),28,'One key press counts once')
      for(let i=0;i<5;i++) await page.keyboard.down('Space')
      assert.equal(await speed(),28,'Key autorepeat cannot become extra reel taps')
      await page.keyboard.up('Space')
    } else {await tap();assert.equal(await speed(),28,'Touch press/release/click counts only one reel tap')}
    await page.clock.runFor(1000)
    const slowSpeed=await speed(),slowShadow=await shadow()
    assert(slowShadow.y<initialShadow.y)
    for(let i=0;i<4;i++){await tap();await page.clock.runFor(100)}
    assert(await speed()>slowSpeed,'Faster tapping raises the live speed meter')
    assert((await shadow()).y<slowShadow.y,'Hook moves farther towards land')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/retrieve-${mode}.png`})
    await page.clock.runFor(4000)
    assert.equal(await speed(),0,'A pause brings the reel to a stop')
    const pausedShadow=await shadow();await page.clock.runFor(800)
    assert.deepEqual(await shadow(),pausedShadow,'Stopped reeling keeps the hook stationary')
    await page.evaluate(()=>{Math.random=()=>0})
    await tap();await page.clock.runFor(300)
    await page.getByRole('button',{name:/Gi tilslag/}).first().waitFor()
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-fishing-idle','Keep relaxed pose while waiting for the strike')
    assert.equal(await page.evaluate(()=>window.__conditions.depth),'midwater')
    const biteShadow=await shadow()
    await page.keyboard.press('e')
    await page.getByRole('meter',{name:'Fangstfremdrift',exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down-fishing-idle','Keep relaxed pose during the fish fight')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/fight-${mode}.png`})
    for(let i=0;i<150&&!await page.evaluate(()=>window.__encounters);i++) {
      if(await page.locator('.fishing-fight-status').textContent().then(text=>text.includes('roer'))) await tap()
      await page.clock.runFor(150)
    }
    assert.equal(await page.evaluate(()=>window.__encounters),1,'The same tapping system can land a fish')
    assert(!await shadow(),'Successful fishing cleans up the water shadow')
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down','Successful fishing restores normal idle')
    assert(biteShadow.progress>0)

    // Both end layers remain selectable, but hitting the absolute deadline fails.
    for(const [elapsed,depth] of [[0,'surface'],[4800,'bottom']]) {
      await open();await castFour();await page.clock.fastForward(elapsed)
      await selectDepth()
      await page.evaluate(()=>{Math.random=()=>0})
      await tap();await page.clock.runFor(300)
      await page.getByRole('button',{name:/Gi tilslag/}).first().waitFor()
      assert.equal(await page.evaluate(()=>window.__conditions.depth),depth)
    }
    // No fish is chosen at depth selection: it can first bite in the middle or
    // near shore after repeated earlier opportunities failed.
    for(const progress of [.4,.78]) {
      await open();await castFour();await selectDepth()
      await page.evaluate(()=>{Math.random=()=>.99})
      while((await shadow()).progress<progress){await tap();await page.clock.runFor(100)}
      assert.equal(await page.getByRole('button',{name:/Gi tilslag/}).count(),0)
      await page.evaluate(()=>{Math.random=()=>0})
      await tap();await page.clock.runFor(300)
      await page.getByRole('button',{name:/Gi tilslag/}).first().waitFor()
      assert((await shadow()).progress>=progress,'Bites can start later in the actual retrieve')
    }
    await open();await castFour();await selectDepth()
    await page.evaluate(()=>{Math.random=()=>.99})
    for(let i=0;i<60&&await shadow();i++){await tap();await page.clock.runFor(100)}
    await page.getByText(/Ingen napp denne gangen/).waitFor()
    assert.equal(await page.evaluate(()=>window.__baitUses),1,'Returning the hook without fish uses exactly one bait')
    assert.equal(await page.evaluate(()=>window.__encounters||0),0)
    assert(!await shadow())
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down','No-bite fishing restores normal idle')
    await open();await castFour()
    await page.clock.fastForward(6100)
    await page.getByText(/Kroken satte seg fast i bunnen/).waitFor()
    assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).count(),0)
    assert.equal(await page.evaluate(()=>window.__baitUses),1,'RAF and deadline races consume exactly one bait')
    assert.equal(await page.evaluate(()=>window.__encounters||0),0,'Snagging cannot award fish, coins or discoveries')
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down','Bottom snag restores normal idle')
    await page.clock.fastForward(10000)
    assert.equal(await page.evaluate(()=>window.__baitUses),1)
    assert(!await page.evaluate(()=>window.__fishingTest.scene.castSplash),'Finished casts clean up the world effect')
    assert(await page.evaluate(()=>window.__fishingTest.scene.cameras.main._follow===window.__fishingTest.scene.player),'Fishing restores the original feet-based camera follow')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/snag-${mode}.png`})
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await open()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog',{name:'Kastelengde'}).count(),0)
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down','Cancelling before casting restores idle')
    assert.equal(await page.evaluate(()=>window.__baitUses||0),0,'Cancelling an aimed cast consumes no bait')
    const directional=await page.evaluate(async()=>{
      const {MAPS,isWalkable,TILE_SIZE}=await import('/src/game/world.ts')
      const {castTargets}=await import('/src/game/fishing.ts')
      const s=window.__fishingTest.scene,results=[]
      for(const facing of ['up','down','left','right']) {
        let source
        for(const map of Object.values(MAPS)) for(let y=0;y<map.tiles.length&&!source;y++) for(let x=0;x<map.tiles[y].length&&!source;x++) {
          const position={mapId:map.id,x,y,facing}
          if(isWalkable(map.tiles[y][x])&&castTargets(position).some(t=>t.steps===5)) source=position
        }
        if(!source) throw new Error('No full-length shore for '+facing)
        s.enterMap(source);s.fishing=true
        const idlePosition={...s.position},image=s.playerImage
        s.setCastAim(true)
        if(image.texture.key!==`player-${facing}-cast-aim`) throw new Error('Incorrect cast pose facing')
        if(image.scaleX!==.05||image.scaleY!==.05) throw new Error('Casting changed player scale')
        const mask=document.createElement('canvas');mask.width=image.width;mask.height=image.height
        const ctx=mask.getContext('2d');ctx.drawImage(image.texture.source[0].image,0,0)
        const alpha=ctx.getImageData(0,0,mask.width,mask.height).data
        let sole=0
        for(let y=mask.height-1;y>=0&&!sole;y--) for(let x=0;x<mask.width;x++) if(alpha[(y*mask.width+x)*4+3]>=128){sole=y+1;break}
        if(sole!==1524||Math.abs(image.y+(sole-image.originY*image.height)*image.scaleY-14)>.001) throw new Error('Cast pose feet moved')
        if(JSON.stringify(s.position)!==JSON.stringify(idlePosition)) throw new Error('Cast pose moved world position')
        s.setCastAim(false)
        if(image.texture.key!==`player-${facing}`||image.originY!==1172/1184) throw new Error('Idle anchor not restored')
        s.setCastAim(true)
        for(const target of castTargets(source)) {
          s.showCastSplash(target.steps)
          if(image.texture.key!==`player-${facing}-fishing-idle`) throw new Error('Incorrect relaxed pose facing at landing')
          const g=s.castSplash
          results.push({facing,steps:target.steps,x:g.x,y:g.y,expectedX:target.x*TILE_SIZE+TILE_SIZE/2,expectedY:target.y*TILE_SIZE+TILE_SIZE/2})
        }
        const last=s.castSplash;s.showCastSplash(99)
        if(s.castSplash!==last) throw new Error('Invalid cast replaced a valid splash')
        if(image.width!==2048||image.height!==1536||image.originX!==.5||image.originY!==1524/1536||image.scaleX!==.05||image.scaleY!==.05||image.texture.source[0].scaleMode!==1) throw new Error('Relaxed pose format or nearest filtering changed')
        const relaxedMask=document.createElement('canvas');relaxedMask.width=image.width;relaxedMask.height=image.height
        const relaxedCtx=relaxedMask.getContext('2d');relaxedCtx.drawImage(image.texture.source[0].image,0,0)
        const relaxedPixels=relaxedCtx.getImageData(0,0,image.width,image.height).data
        let relaxedSole=0
        for(let i=3;i<relaxedPixels.length;i+=4) if(relaxedPixels[i]!==0&&relaxedPixels[i]!==255) throw new Error('Relaxed pose contains semi-transparent pixels')
        for(let y=image.height-1;y>=0&&!relaxedSole;y--) for(let x=0;x<image.width;x++) if(relaxedPixels[(y*image.width+x)*4+3]){relaxedSole=y+1;break}
        if(relaxedSole!==1524||image.y+(relaxedSole-image.originY*image.height)*image.scaleY!==14) throw new Error('Relaxed pose feet moved')
        if(JSON.stringify(s.position)!==JSON.stringify(idlePosition)) throw new Error('Relaxed pose moved world position')
        for(const progress of [0,.5,1]) {
          s.setRetrieveProgress(5,progress)
          const distance=5+( .7-5)*progress,g=s.lureShadow
          const dx={up:0,down:0,left:-1,right:1}[facing],dy={up:-1,down:1,left:0,right:0}[facing]
          if(Math.abs(g.x-(s.player.x+dx*distance*TILE_SIZE))>.001||Math.abs(g.y-(s.player.y+dy*distance*TILE_SIZE))>.001) throw new Error('Wrong shadow position for '+facing)
          if(image.texture.key!==`player-${facing}-fishing-idle`) throw new Error('Retrieval changed relaxed pose')
        }
        s.finishFishing()
        if(s.castSplash||s.lureShadow) throw new Error('Water effect cleanup failed')
        if(image.texture.key!==`player-${facing}`) throw new Error('Fishing finish left the casting pose active')
        s.fishing=true
        const interrupted=s.playCast(5)
        if(image.texture.key!==`player-${facing}-cast-forward`) throw new Error('Incorrect forward pose facing')
        if(image.originX!==.5||image.originY!==1524/1536||image.scaleX!==.05) throw new Error('Forward pose anchor/scale changed')
        const forwardMask=document.createElement('canvas');forwardMask.width=image.width;forwardMask.height=image.height
        const forwardCtx=forwardMask.getContext('2d');forwardCtx.drawImage(image.texture.source[0].image,0,0)
        const pixels=forwardCtx.getImageData(0,0,forwardMask.width,forwardMask.height).data
        let forwardSole=0
        for(let y=forwardMask.height-1;y>=0&&!forwardSole;y--) for(let x=0;x<forwardMask.width;x++) if(pixels[(y*forwardMask.width+x)*4+3]>=128){forwardSole=y+1;break}
        if(forwardSole!==1524) throw new Error('Forward pose actual soles moved')
        s.finishFishing()
        if(await interrupted) throw new Error('Interrupted cast reported a completed splash')
        if(s.castFlight||s.castSplash||s.castFlightTween||s.castDone) throw new Error('Interrupted cast left an effect or promise alive')
        if(image.texture.key!==`player-${facing}`) throw new Error('Interrupted forward pose not restored')
      }
      return results
    })
    assert.equal(directional.length,20)
    for(const shot of directional) {assert.equal(shot.x,shot.expectedX);assert.equal(shot.y,shot.expectedY)}
    assert.deepEqual(errors,[])
    await context.close()
    console.log(`${mode}: cast/depth sequence, relaxed pose from landing through fishing in four directions, live tap speed, single keyboard/touch pulses, hook shadow, early/mid/late bites, landing/no-bite/snag and one-bait outcomes passed.`)
  }
} finally {await browser.close()}
