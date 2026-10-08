// Real scene animation checks; all instrumentation is limited to served test responses.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173'
await mkdir('output/character-review', { recursive: true })
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage(); const errors = []
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/,()=>{})
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__characterTest = { game, scene }; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('__characterTest'))
      await route.fulfill({ response, body })
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(() => window.__characterTest?.scene.playerImage)
    const results = await page.evaluate(async () => {
      const { NPCS } = await import('/src/game/npcs.ts')
      const { NPC_CHARACTERS } = await import('/src/game/characters.ts')
      const { scene } = window.__characterTest
      for (const character of Object.values(NPC_CHARACTERS)) {
        if(character.walk.down[2]!==character.sprites.down) throw new Error(`${character.id}: front C must map to idle`)
        const pixels=key=>{
          const canvas=document.createElement('canvas');canvas.width=48;canvas.height=64
          const context=canvas.getContext('2d')
          context.drawImage(scene.textures.get(key).getSourceImage(),0,0)
          return context.getImageData(0,0,48,64).data
        }
        const idle=pixels(`${character.id}-down`),passing=pixels(`${character.id}-down-walk-3`)
        if(!idle.every((value,index)=>value===passing[index])) throw new Error(`${character.id}: runtime front C pixels differ`)
      }
      scene.setUiBlocked(true)
      const result = []
      for (const mapId of ['havn', 'hjem', 'butikk', 'skogstjern']) {
        scene.enterMap({ mapId, x: 2, y: 16, facing: 'down' })
        for (const definition of NPCS.filter(n => n.mapId === mapId)) {
          const n = scene.residents.find(n => n.definition.id === definition.id)
          const original = n.image
          for (const direction of ['down', 'right', 'up', 'left']) {
            n.facing = direction
            for (const phase of NPC_CHARACTERS[definition.id].walk ? [0, 1, 2, 3] : [0]) {
              n.moving = phase > 0; n.walkStarted = scene.time.now; n.walkFrame = phase
              scene.drawResident(n)
              const i = n.image
              result.push({ id: definition.id, direction, phase, texture: i.texture.key, sameObject: i === original,
                x: n.sprite.x, y: n.sprite.y, depth: n.sprite.depth,
                originX: i.originX, originY: i.originY, filter: i.texture.source[0].scaleMode,
                scale: i.scaleX, width: i.width, height: i.height,
                groundY: n.sprite.y + i.y + (60 - i.originY * i.height) * i.scaleY,
              })
            }
          }
              n.moving = false; n.walkUntil = 0; scene.drawResident(n)
        }
      }
      return result
    })
    assert.equal(results.length, await page.evaluate(async () => {
      const { NPC_CHARACTERS } = await import('/src/game/characters.ts')
      return Object.values(NPC_CHARACTERS).reduce((count, character) => count + 4 * (character.walk ? 4 : 1), 0)
    }))
    for (const direction of ['down','right','up','left']) {
      const passingTexture = await page.evaluate(direction => {
        const texture = window.__characterTest.scene.textures.get(`player-${direction}-walk-3`)
        const source = texture.getSourceImage()
        return { width: source.width, height: source.height, filter: texture.source[0].scaleMode }
      },direction)
      assert.deepEqual(passingTexture,{width:768,height:1184,filter:1},`${direction} C must use the shared canvas and nearest filtering`)
    }
    for (const r of results) {
      assert.equal(r.texture, `${r.id}-${r.direction}${r.phase ? '-walk-' + r.phase : ''}`)
      assert(r.sameObject, 'Animation must retain the same image object')
      assert.equal(r.filter, 1); assert.equal(r.scale, 1)
      assert.equal(r.originX, .5); assert.equal(r.originY, 60 / 64)
      assert.equal(r.width, 48); assert.equal(r.height, 64)
      assert.equal(r.groundY, r.y + 14)
    }
    await page.evaluate(async () => {
      const { scene, game } = window.__characterTest
      const { MAPS, isWalkable } = await import('/src/game/world.ts')
      scene.enterMap({ mapId: 'havn', x: 15, y: 12, facing: 'right' })
      const map=MAPS.havn
      let start
      for (let y=3;y<map.tiles.length-3&&!start;y++) for (let x=3;x<map.tiles[0].length-8&&!start;x++) {
        if (Array.from({length:7},(_,i)=>isWalkable(map.tiles[y][x+i])).every(Boolean) && !scene.residents.some(n=>n.y===y&&n.x>=x&&n.x<=x+6)) start={mapId:'havn',x,y,facing:'right'}
      }
      if(!start) throw new Error('No clear gait-test path')
      scene.enterMap(start); scene.playerWalkPhase=-1
      scene.setUiBlocked(false)
      window.__gaitSamples = []
      game.events.on('postrender', () => window.__gaitSamples.push({ player: scene.playerImage.texture.key,
        phase: scene.playerWalkPhase, moving: scene.moving,
        ground: scene.playerImage.y+(1172-scene.playerImage.originY*scene.playerImage.height)*scene.playerImage.scaleY,
        scale: scene.playerImage.scaleX, filter: scene.playerImage.texture.source[0].scaleMode,
        oda: scene.residents.find(n => n.definition.id === 'oda')?.image.texture.key }))
      scene.residents.find(n => n.definition.id === 'oda').next = scene.time.now - 1
      scene.move('right')
    })
    for(let tile=0;tile<4;tile++) {
      if(tile>0) await page.evaluate(() => window.__characterTest.scene.move('right'))
      await page.waitForTimeout(450)
    }
    const samples = await page.evaluate(() => window.__gaitSamples)
    assert(samples.some(s => s.player === 'player-right-walk-1'))
    assert(samples.some(s => s.player === 'player-right-walk-2'))
    assert(samples.some(s => s.player === 'player-right-walk-3'), 'Right movement must include passing C')
    for(const [phase,frame] of [1,3,2,3].entries()) {
      const movingFrames=samples.filter(s=>s.moving&&s.phase===phase).map(s=>s.player)
      assert(movingFrames.length>0,`No render samples for tile ${phase+1}`)
      assert.deepEqual([...new Set(movingFrames)],[`player-right-walk-${frame}`],'Exactly one texture throughout each tile')
    }
    assert.equal(samples.at(-1).player, 'player-right')
    assert(samples.some(s => s.oda === 'oda-right-walk-1'))
    assert(samples.some(s => s.oda === 'oda-right-walk-3'), 'NPCs hold A then C over successive tiles')
    assert.equal(samples.at(-1).oda, 'oda-right')
    // Each additional view has the same four-tile cadence and ground anchor.
    for(const direction of ['left','down','up']) {
      const start=await page.evaluate(async direction => {
        const { scene }=window.__characterTest
        const { MAPS,isWalkable }=await import('/src/game/world.ts')
        const map=MAPS.havn
        const [dx,dy]=({left:[-1,0],down:[0,1],up:[0,-1]})[direction]
        let start
        for(let y=7;y<map.tiles.length-7&&!start;y++) for(let x=7;x<map.tiles[0].length-7&&!start;x++) {
          const path=Array.from({length:5},(_,i)=>({x:x+dx*i,y:y+dy*i}))
          if(path.every(p=>isWalkable(map.tiles[p.y][p.x])&&!scene.residents.some(n=>n.x===p.x&&n.y===p.y))) start={mapId:'havn',x,y,facing:direction}
        }
        if(!start) throw new Error(`No clear ${direction} gait-test path`)
        scene.enterMap(start);scene.playerWalkPhase=-1;window.__gaitSamples=[]
        return {...start,dx,dy}
      },direction)
      for(let tile=0;tile<4;tile++) {
        await page.evaluate(direction=>window.__characterTest.scene.move(direction),direction)
        await page.waitForTimeout(260)
      }
      const directional=await page.evaluate(()=>({samples:window.__gaitSamples,position:window.__characterTest.scene.position}))
      for(const sample of directional.samples) {
        assert.equal(sample.ground,14,'Pose change must not shift ground anchor')
        assert.equal(sample.scale,.05)
        assert.equal(sample.filter,1)
      }
      for(const [phase,frame] of [1,3,2,3].entries()) {
        const keys=directional.samples.filter(s=>s.moving&&s.phase===phase).map(s=>s.player)
        assert(keys.length>0,`${direction}: no moving samples for phase ${phase}`)
        assert.deepEqual([...new Set(keys)],[`player-${direction}-walk-${frame}`])
      }
      assert.equal(directional.samples.at(-1).player,`player-${direction}`)
      assert.equal(directional.position.x,start.x+4*start.dx)
      assert.equal(directional.position.y,start.y+4*start.dy)
    }
    // Continuous keyboard walking must bridge the inter-tile pause without an
    // idle flash; release still settles back into the correct facing idle.
    await page.evaluate(async () => {
      const { scene } = window.__characterTest
      const { MAPS, isWalkable } = await import('/src/game/world.ts')
      const map=MAPS.havn
      let start
      for (let y=3;y<map.tiles.length-3&&!start;y++) for (let x=3;x<map.tiles[0].length-8&&!start;x++) {
        if (Array.from({length:7},(_,i)=>isWalkable(map.tiles[y][x+i])).every(Boolean) && !scene.residents.some(n=>n.y===y&&n.x>=x&&n.x<=x+6)) start={mapId:'havn',x,y,facing:'right'}
      }
      scene.enterMap(start); window.__gaitSamples=[]
    })
    await page.locator('.game-frame').focus()
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(480)
    const held = await page.evaluate(() => window.__gaitSamples.map(sample=>sample.player))
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(260)
    const fromFirstStep=held.slice(held.findIndex(key=>key.includes('-walk-')))
    assert(fromFirstStep.some(key=>key==='player-right-walk-1') && fromFirstStep.some(key=>key==='player-right-walk-2'))
    assert(fromFirstStep.some(key=>key==='player-right-walk-3'), 'Held movement must include C')
    assert(fromFirstStep.every(key=>key.includes('-walk-')), 'No idle flash during continuous walking')
    assert.equal(await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key),'player-right')
    await page.locator('.game-frame').screenshot({ path: `output/character-review/world-${mode}.png` })
    const maritaPlacement = await page.evaluate(async () => {
      const { scene } = window.__characterTest
      const { MAPS } = await import('/src/game/world.ts')
      scene.enterMap({ mapId: 'skogstjern', x: 38, y: 21, facing: 'up' })
      scene.setUiBlocked(false)
      const n = scene.residents.find(n => n.definition.id === 'marita')
      if (!n) throw new Error('Marita was not spawned in area 2')
      const before = { ...scene.position }
      scene.move('up')
      if (JSON.stringify(scene.position) !== JSON.stringify(before) || scene.moving) throw new Error('Player walked through Marita')
      if (scene.npcAhead() !== n) throw new Error('Marita is not accessible for conversation')
      return { x: n.x, y: n.y, shoreline: MAPS.skogstjern.tiles[n.y - 1][n.x], texture: n.image.texture.key,
        ground: n.sprite.y + n.image.y + (60 - n.image.originY * n.image.height) * n.image.scaleY,
        expectedGround: n.sprite.y + 14, depth: n.sprite.depth }
    })
    assert.equal(maritaPlacement.x,38);assert.equal(maritaPlacement.y,20)
    assert.equal(maritaPlacement.shoreline,'water')
    assert.equal(maritaPlacement.texture,'marita-down')
    assert.equal(maritaPlacement.ground,maritaPlacement.expectedGround)
    assert.equal(maritaPlacement.depth,20*32+16)
    await page.locator('.game-frame').focus()
    if(mobile) await page.getByRole('button',{name:'Snakk',exact:true}).last().tap()
    else await page.keyboard.press('e')
    await page.locator('.world-message').filter({hasText:'Marita'}).waitFor()
    assert((await page.locator('.world-message').textContent()).includes('Du mottok joggesko.'))
    await page.locator('.game-frame').screenshot({path:`output/character-review/marita-world-${mode}.png`})
    await page.getByRole('button',{name:'Videre ▼',exact:true}).click()
    await page.locator('.world-message').waitFor({state:'hidden'})
    await page.locator('.game-frame').focus()
    if(mobile) await page.getByRole('button',{name:'Snakk',exact:true}).last().tap()
    else await page.keyboard.press('e')
    await page.locator('.world-message').filter({hasText:'Husk å ta en pause mellom løpeturene.'}).waitFor()
    await page.goto(`${base}/tools/character-preview.html`)
    await page.waitForSelector('.card img')
    assert.equal(await page.locator('.card').count(), 10)
    for (const direction of ['down', 'right', 'up', 'left']) {
      await page.locator('#direction').selectOption(direction)
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      if (!mobile && mode !== 'canvas') await page.screenshot({ path: `output/character-review/${direction}.png`, fullPage: true })
    }
    assert.deepEqual(errors, [])
    console.log(`${mode}: all NPC directional poses, Marita shoreline placement/collision/conversation, persistent rendering, ground/filter, actual player/NPC tween gait and review gallery passed.`)
    await context.close()
  }
} finally { await browser.close() }
