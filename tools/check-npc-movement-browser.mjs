// Exercise every NPC's directional gait on temporary test-only routes. Actual
// map data, stationary NPC definitions and production routes remain unchanged.
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5180'
try {
  for(const mode of ['desktop','mobile','canvas']) {
    const mobile=mode==='mobile'
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},
      deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage(),errors=[]
    // Keep this long asset audit stable if another local preview/test writes a
    // review file: Vite's automatic reload is unrelated to gameplay behavior.
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    await page.clock.install()
    page.on('pageerror',e=>errors.push(e.message))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      let body=(await response.text()).replace('return { game, scene };','window.__npcTest={game,scene}; return { game, scene };')
      if(mode==='canvas')body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('__npcTest'));await route.fulfill({response,body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(()=>window.__npcTest?.scene.playerImage)
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)))
    const ids=await page.evaluate(async()=>{
      const {NPCS}=await import('/src/game/npcs.ts')
      const {scene,game}=window.__npcTest
      window.__npcSamples=[]
      game.events.on('postrender',()=>{
        const n=window.__testResident
        if(n?.sprite.active)window.__npcSamples.push({time:scene.time.now,x:n.sprite.x,y:n.sprite.y,depth:n.sprite.depth,
          moving:n.moving,phase:n.walkPhase,texture:n.image.texture.key,scale:n.image.scaleX,filter:n.image.texture.source[0].scaleMode,
          ground:n.image.y+(60-n.image.originY*n.image.height)*n.image.scaleY})
      })
      return NPCS.map(n=>n.id)
    })
    for(const id of ids)for(const direction of process.argv.includes('--interactions-only') ? [] : ['right','left','down','up']) {
      const start=await page.evaluate(async({id,direction})=>{
        const {MAPS,isWalkable}=await import('/src/game/world.ts')
        const {NPCS}=await import('/src/game/npcs.ts')
        const {scene}=window.__npcTest
        scene.enterMap({mapId:'havn',x:2,y:16,facing:'down'})
        scene.setUiBlocked(false);scene.finishFishing()
        const [dx,dy]=({right:[1,0],left:[-1,0],down:[0,1],up:[0,-1]})[direction]
        const map=MAPS.havn
        let start
        for(let y=7;y<map.tiles.length-7&&!start;y++)for(let x=7;x<map.tiles[0].length-7&&!start;x++) {
          if(Array.from({length:5},(_,i)=>isWalkable(map.tiles[y+dy*i][x+dx*i])).every(Boolean))start={x,y}
        }
        if(!start)throw new Error(`No ${direction} review path`)
        const n=scene.residents[0]
        for(const other of scene.residents.slice(1))other.sprite.destroy()
        scene.residents=[n]
        const route=[0,1,2,3,4,3,2,1].map(i=>[start.x+dx*i,start.y+dy*i])
        n.definition={...NPCS.find(n=>n.id===id),mapId:'havn',route}
        n.x=n.fromX=start.x;n.y=n.fromY=start.y;n.index=0;n.facing=direction
        n.moving=false;n.next=0;n.walkPhase=-1;n.walkUntil=0
        n.sprite.setPosition(start.x*32+16,start.y*32+16)
        scene.drawResident(n)
        window.__testResident=n;window.__npcSamples=[]
        return {...start,dx,dy}
      },{id,direction})
      await page.clock.runFor(1450)
      const result=await page.evaluate(()=>({samples:window.__npcSamples,n:{moving:window.__testResident.moving,
        x:window.__testResident.x,y:window.__testResident.y,index:window.__testResident.index}}))
      const moving=result.samples.filter(s=>s.moving)
      assert(moving.length>40,`${id}/${direction}: moving samples`)
      for(let i=1;i<moving.length;i++) {
        const a=moving[i-1],b=moving[i],dt=b.time-a.time
        if(dt<=0)continue
        assert(Math.abs(b.x-a.x-start.dx*32*dt/300)<.001,`${id}/${direction}: constant horizontal velocity`)
        assert(Math.abs(b.y-a.y-start.dy*32*dt/300)<.001,`${id}/${direction}: constant vertical velocity`)
      }
      for(const [phase,frame] of [1,3,2,3].entries()) {
        const frames=moving.filter(s=>s.phase===phase)
        assert(frames.length>0,`${id}/${direction}: missing phase ${phase}`)
        assert.deepEqual([...new Set(frames.map(s=>s.texture))],[`${id}-${direction}-walk-${frame}`],'One texture per tile')
      }
      for(const s of result.samples) {
        assert.equal(s.depth,s.y);assert.equal(s.ground,14);assert.equal(s.scale,1);assert.equal(s.filter,1)
      }
      assert(!result.n.moving,'NPC pauses at the direction change')
      assert.equal(result.n.x,start.x+4*start.dx);assert.equal(result.n.y,start.y+4*start.dy)
      assert.equal(result.samples.at(-1).texture,`${id}-${direction}`,'Idle during route turnaround pause')
      await page.clock.runFor(300)
      assert.equal(await page.evaluate(()=>window.__testResident.index),4,'Turnaround pause retained')
    }
    // Restore the real definitions and confirm every stationary NPC still stays put.
    await page.evaluate(()=>{window.__testResident=null;window.__npcSamples=[]})
    for(const mapId of ['havn','skogstjern','hjem','butikk']) {
      const before=await page.evaluate(mapId=>{
        const s=window.__npcTest.scene
        s.enterMap({mapId,x:2,y:16,facing:'down'})
        return s.residents.filter(n=>n.definition.route.length===1).map(n=>({id:n.definition.id,x:n.x,y:n.y}))
      },mapId)
      await page.clock.runFor(2200)
      const after=await page.evaluate(()=>window.__npcTest.scene.residents.filter(n=>n.definition.route.length===1).map(n=>({id:n.definition.id,x:n.x,y:n.y})))
      assert.deepEqual(after,before,'Stationary NPC positions are unchanged')
    }
    // A real route must stop next to the player, allowing normal conversation.
    await page.evaluate(()=>{
      const s=window.__npcTest.scene
      s.enterMap({mapId:'havn',x:21,y:17,facing:'left'})
      s.residents.find(n=>n.definition.id==='oda').next=0
      s.move('left')
    })
    await page.clock.runFor(100)
    assert(await page.evaluate(()=>{
      const s=window.__npcTest.scene
      return s.moving&&s.residents.find(n=>n.definition.id==='oda').moving
    }),'An unobstructed NPC can keep walking while the player moves')
    await page.clock.runFor(1000)
    assert.equal(await page.evaluate(()=>window.__npcTest.scene.residents.find(n=>n.definition.id==='oda').x),19,
      'NPC stops next to the approaching player')
    await page.evaluate(()=>{
      const s=window.__npcTest.scene
      s.enterMap({mapId:'havn',x:20,y:17,facing:'left'})
      s.residents.find(n=>n.definition.id==='oda').next=0
      s.move('left')
    })
    await page.clock.runFor(100)
    assert(await page.evaluate(()=>{
      const s=window.__npcTest.scene,n=s.residents.find(n=>n.definition.id==='oda')
      return s.moving&&!n.moving&&n.x===18
    }),'NPC cannot enter the player\'s reserved destination tile')
    await page.clock.runFor(1000)
    const conversation=await page.evaluate(()=>{
      const s=window.__npcTest.scene,n=s.residents.find(n=>n.definition.id==='oda')
      const before={x:n.x,y:n.y,moving:n.moving,visibleX:n.sprite.x,ahead:s.npcAhead()?.definition.id}
      s.action()
      return {...before,blocked:s.uiBlocked,texture:n.image.texture.key}
    })
    assert.deepEqual(conversation,{x:18,y:17,moving:false,visibleX:18*32+16,ahead:'oda',blocked:true,texture:'oda-right'},
      'NPC respects player occupancy, waits within interaction range and uses idle when talking')
    assert.deepEqual(errors,[])
    console.log(`${mode}: ${process.argv.includes('--interactions-only')?'concurrent movement and occupancy':'all nine NPCs × four directions, continuous 300ms steps, A-C-B-C per-tile frames, feet/depth/filter, turnaround pauses'}, stationary positions and conversation passed`)
    await context.close()
  }
} finally {await browser.close()}
