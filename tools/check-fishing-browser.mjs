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
  for(const mode of ['desktop','mobile','landscape','canvas']) {
    const mobile=mode==='mobile'||mode==='landscape'
    const context=await browser.newContext({viewport:mode==='mobile'?{width:390,height:844}:mode==='landscape'?{width:844,height:390}:{width:1280,height:900},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
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
    const castFour = async ()=>{
      const track=await page.locator('.cast-meter-track').boundingBox()
      const x=track.x+track.width/2,y=track.y+track.height*.25
      if(mobile) await page.touchscreen.tap(x,y)
      else await page.mouse.click(x,y)
      await page.getByRole('dialog',{name:'Fiskedybde'}).waitFor()
    }
    const selectDepth = async ()=>{
      if(mobile) await page.getByRole('button',{name:'Velg',exact:true}).last().tap()
      else await page.keyboard.press('e')
      await page.getByText('Hvordan vil du sveive inn?',{exact:true}).waitFor()
    }
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
    await castFour()
    assert.equal(await page.evaluate(()=>window.__fishingTest.scene.playerImage.texture.key),'player-down','Casting releases the aiming pose')
    const landing=await page.evaluate(()=>{
      const s=window.__fishingTest.scene,g=s.castSplash
      if(!g) throw new Error('Missing splash: '+JSON.stringify({fishing:s.fishing,position:s.position,objects:s.children.list.map(g=>g.name).filter(Boolean)}))
      return {x:g.x,y:g.y,tileX:g.getData('tileX'),tileY:g.getData('tileY'),steps:g.getData('steps'),commands:g.commandBuffer.length,
        playerX:s.player.x,playerY:s.player.y,position:{...s.position},inView:s.cameras.main.worldView.contains(g.x,g.y)}
    })
    assert.equal(landing.steps,4);assert.equal(landing.tileX,24);assert.equal(landing.tileY,29)
    assert.equal(landing.x,landing.playerX);assert.equal(landing.y,landing.playerY+4*32)
    assert(landing.commands>0)
    assert.equal(await page.locator('.cast-animation,.cast-scene,.cast-meter-readout,.fishing-choice-list').count(),0)
    assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).textContent().then(s=>s.replace(/\s/g,'')),'GRUNT12345DYPT')
    assert(Number(await page.getByRole('meter',{name:'Synkende agn'}).getAttribute('aria-valuenow'))<10)
    await page.clock.runFor(220)
    assert(await page.evaluate(()=>{
      const s=window.__fishingTest.scene,g=s.castSplash
      return s.cameras.main.worldView.contains(g.x,g.y)
    }),'The actual splash is visible, including short landscape viewports')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/splash-${mode}.png`})
    console.log(`${mode}: four-tile splash initially in camera view: ${landing.inView}`)
    await page.clock.fastForward(2200)
    const sunk=Number(await page.getByRole('meter',{name:'Synkende agn'}).getAttribute('aria-valuenow'))
    assert(sunk>30&&sunk<65,'Depth moves down from the top over time')
    await page.locator('.game-frame').screenshot({path:`output/fishing-review/depth-${mode}.png`})
    await selectDepth()
    await page.clock.fastForward(6500)
    assert.equal(await page.getByText('Hvordan vil du sveive inn?',{exact:true}).count(),1,'Stopping the meter cancels the snag deadline')
    assert.equal(await page.evaluate(()=>window.__baitUses||0),0)
    await page.getByRole('button',{name:/^Jevnt/}).click()
    assert.equal(await page.evaluate(()=>window.__conditions.depth),'midwater')
    assert.equal(await page.evaluate(()=>window.__conditions.castLength),'long')
    await page.clock.fastForward(1100)
    await page.getByRole('button',{name:/Gi tilslag/}).waitFor()
    await page.keyboard.press('e')
    await page.getByRole('button',{name:/Hold inne for å sveive/}).waitFor()

    // Both end layers remain selectable, but hitting the absolute deadline fails.
    for(const [elapsed,depth] of [[0,'surface'],[4800,'bottom']]) {
      await open();await castFour();await page.clock.fastForward(elapsed)
      await selectDepth()
      await page.getByRole('button',{name:/^Jevnt/}).click()
      assert.equal(await page.evaluate(()=>window.__conditions.depth),depth)
    }
    await open();await castFour()
    await page.clock.fastForward(6100)
    await page.getByText(/Kroken satte seg fast i bunnen/).waitFor()
    assert.equal(await page.getByRole('dialog',{name:'Fiskedybde'}).count(),0)
    assert.equal(await page.evaluate(()=>window.__baitUses),1,'RAF and deadline races consume exactly one bait')
    assert.equal(await page.evaluate(()=>window.__encounters||0),0,'Snagging cannot award fish, coins or discoveries')
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
          const g=s.castSplash
          results.push({facing,steps:target.steps,x:g.x,y:g.y,expectedX:target.x*TILE_SIZE+TILE_SIZE/2,expectedY:target.y*TILE_SIZE+TILE_SIZE/2})
        }
        const last=s.castSplash;s.showCastSplash(99)
        if(s.castSplash!==last) throw new Error('Invalid cast replaced a valid splash')
        s.finishFishing()
        if(s.castSplash) throw new Error('Splash cleanup failed')
        if(image.texture.key!==`player-${facing}`) throw new Error('Fishing finish left the casting pose active')
      }
      return results
    })
    assert.equal(directional.length,20)
    for(const shot of directional) {assert.equal(shot.x,shot.expectedX);assert.equal(shot.y,shot.expectedY)}
    assert.deepEqual(errors,[])
    await context.close()
    console.log(`${mode}: four casting poses/foot anchors, aim/cast/cancel lifecycle, bare meters, actual water splash, depth choice, fishing continuation and single bait consumption passed.`)
  }
} finally {await browser.close()}
