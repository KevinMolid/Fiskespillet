// Exercise real keyboard/touch events against GamePage and WorldScene. All
// instrumentation is confined to served test responses; no account writes.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173'
const controls = [
  ['up','ArrowUp','w','Opp',0,-1], ['right','ArrowRight','d','Høyre',1,0],
  ['down','ArrowDown','s','Ned',0,1], ['left','ArrowLeft','a','Venstre',-1,0],
]
const opposite = { up:'down', down:'up', left:'right', right:'left' }
try {
  for (const mode of ['desktop','mobile','canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:900}, deviceScaleFactor:mobile ? 3 : 1, isMobile:mobile, hasTouch:mobile })
    const page = await context.newPage(), errors = []
    await page.clock.install()
    page.on('pageerror', e => errors.push(e.message))
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      await route.fulfill({response, body:(await response.text()).replace('equippedBait: "bread"','equippedBait: "spinner"')})
    })
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };','window.__turnTest = { game, scene }; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('window.__turnTest'))
      await route.fulfill({response, body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__turnTest?.scene.playerImage)
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)))
    const advance=ms=>page.clock.runFor(ms)
    await page.evaluate(async () => {
      const {MAPS,isWalkable} = await import('/src/game/world.ts')
      const {scene} = window.__turnTest
      const map = MAPS.havn
      for(let y=3;y<map.tiles.length-3&&!window.__openTile;y++) for(let x=3;x<map.tiles[0].length-3&&!window.__openTile;x++) {
        if ([-1,0,1].every(dy=>[-1,0,1].every(dx=>isWalkable(map.tiles[y+dy][x+dx]))) && !scene.residents.some(n=>Math.abs(n.x-x)<3&&Math.abs(n.y-y)<3)) window.__openTile={mapId:'havn',x,y}
      }
      if(!window.__openTile) throw new Error('No unobstructed test area')
      const onPosition = scene.callbacks.onPosition
      window.__positionEvents=[]
      window.__positionTimes=[]
      scene.callbacks.onPosition=(position,transitioned)=>{ window.__positionTimes.push(scene.time.now);window.__positionEvents.push({...position,transitioned});onPosition(position,transitioned) }
    })
    const state = () => page.evaluate(() => {
      const {scene} = window.__turnTest
      return {position:{...scene.position}, x:scene.player.x, y:scene.player.y, moving:scene.moving, texture:scene.playerImage.texture.key,
        follow:scene.cameras.main._follow===scene.player, lastEvent:window.__positionEvents.at(-1), nextMove:scene.nextMove,lastPositionAt:window.__positionTimes.at(-1)}
    })
    const reset = async facing => {
      await page.evaluate(facing=>{
        const s=window.__turnTest.scene
        s.setUiBlocked(false);s.finishFishing();s.nextMove=0
        s.enterMap({...window.__openTile,facing})
      },facing)
      await advance(80)
      await page.locator('.game-frame').focus()
    }
    const tap = async (control, letters = false) => {
      if (mobile) await page.getByRole('button',{name:control[3],exact:true}).tap()
      else {
        const key = control[letters ? 2 : 1]
        await page.keyboard.down(key);await advance(30);await page.keyboard.up(key)
      }
      await advance(25)
    }
    for(const letters of mobile ? [false] : [false,true]) for(const control of controls) {
      const [direction,,,,dx,dy]=control
      await reset(opposite[direction])
      const before=await state()
      await tap(control,letters)
      const turned=await state()
      assert.deepEqual(turned.position,{...before.position,facing:direction},'First tap turns without changing tile coordinates')
      assert.equal(turned.x,before.x);assert.equal(turned.y,before.y)
      assert(!turned.moving);assert.equal(turned.texture,`player-${direction}`);assert(turned.follow)
      assert.deepEqual(turned.lastEvent,{...turned.position,transitioned:false},'Turning updates interaction and saved facing')
      // Deliberately tap again within the repeat cooldown: a new key press
      // must be distinct from holding, and must not disappear in that gap.
      await tap(control,letters)
      await advance(240)
      const stepped=await state()
      assert.deepEqual(stepped.position,{...turned.position,x:turned.position.x+dx,y:turned.position.y+dy},'Second tap takes exactly one tile step')
      await advance(180)
      assert.deepEqual((await state()).position,stepped.position,'A released tap never starts repeating')
    }
    // The first held walking turn waits 50ms independently of repeat cadence.
    const control=controls[1]
    await reset('down')
    const heldStart=await state()
    let touch
    if(mobile) {
      touch=await context.newCDPSession(page)
      const box=await page.getByRole('button',{name:'Høyre',exact:true}).boundingBox()
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]})
    } else await page.keyboard.down('ArrowRight')
    await advance(40)
    const first=await state()
    assert.deepEqual(first.position,{...heldStart.position,facing:'right'})
    assert(!first.moving,'Hold begins with a stationary turn')
    assert.equal(first.nextMove-first.lastPositionAt,50,'The initial turn wait is exactly 50ms')
    await advance(40)
    assert((await state()).moving,'The first step begins after the 50ms turn window')
    await advance(350)
    if(mobile) await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    else await page.keyboard.up('ArrowRight')
    await advance(250)
    const stopped=await state()
    assert(stopped.position.x>heldStart.position.x,'Hold continues walking after turning')
    await advance(250)
    assert.deepEqual((await state()).position,stopped.position,'Release stops holding')
    for(const block of ['uiBlocked','fishing']) {
      await reset('down')
      const before=await state()
      await page.evaluate(block=>{window.__turnTest.scene[block]=true},block)
      await tap(controls[0])
      assert.deepEqual((await state()).position,before.position,'Blocked input cannot turn or walk')
      await page.evaluate(block=>{window.__turnTest.scene[block]=false},block)
      await advance(180)
      assert.deepEqual((await state()).position,before.position,'Blocked taps are not queued')
    }
    // Turning at the map exit must not transition; stepping afterwards does.
    await page.evaluate(()=>window.__turnTest.scene.enterMap({mapId:'havn',x:46,y:16,facing:'up'}))
    await tap(controls[1])
    assert.deepEqual((await state()).position,{mapId:'havn',x:46,y:16,facing:'right'})
    await tap(controls[1]);await advance(240)
    assert.equal((await state()).position.mapId,'skogstjern')
    // Facing a collision tile remains stationary on both the turn and step.
    await page.evaluate(()=>window.__turnTest.scene.enterMap({mapId:'havn',x:1,y:16,facing:'down'}))
    await tap(controls[3]);await tap(controls[3]);await advance(180)
    assert.deepEqual((await state()).position,{mapId:'havn',x:1,y:16,facing:'left'})
    // The turn immediately changes fishing eligibility and the mobile label.
    await page.evaluate(()=>window.__turnTest.scene.enterMap({mapId:'havn',x:24,y:25,facing:'up'}))
    await tap(controls[2])
    assert.deepEqual((await state()).position,{mapId:'havn',x:24,y:25,facing:'down'})
    assert(await page.evaluate(async()=>{
      const {canFish}=await import('/src/game/world.ts')
      return canFish(window.__turnTest.scene.position)
    }))
    if(mobile) await page.getByRole('button',{name:'Fisk',exact:true}).last().tap()
    else await page.keyboard.press('e')
    await page.waitForSelector('[role="dialog"]')
    assert(await page.evaluate(()=>window.__turnTest.scene.fishing))
    await page.keyboard.press('Escape')
    assert.deepEqual(errors,[])
    console.log(`${mode}: 50ms walking turn delay, short turn-only taps, fast second tap, hold/release, blocked inputs, collision, map exit and fishing-facing passed.`)
    await context.close()
  }
} finally { await browser.close() }
