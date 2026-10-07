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
      scene.setUiBlocked(true)
      const result = []
      for (const mapId of ['havn', 'hjem', 'butikk', 'skogstjern']) {
        scene.enterMap({ mapId, x: 2, y: 16, facing: 'down' })
        for (const definition of NPCS.filter(n => n.mapId === mapId)) {
          const n = scene.residents.find(n => n.definition.id === definition.id)
          const original = n.image
          for (const direction of ['down', 'right', 'up', 'left']) {
            n.facing = direction
            for (const phase of NPC_CHARACTERS[definition.id].walk ? [0, 1, 2] : [0]) {
              n.moving = phase > 0; n.walkStarted = scene.time.now - (phase === 2 ? 225 : 25)
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
          n.moving = false; scene.drawResident(n)
        }
      }
      return result
    })
    assert.equal(results.length, await page.evaluate(async () => {
      const { NPC_CHARACTERS } = await import('/src/game/characters.ts')
      return Object.values(NPC_CHARACTERS).reduce((count, character) => count + 4 * (character.walk ? 3 : 1), 0)
    }))
    for (const r of results) {
      assert.equal(r.texture, `${r.id}-${r.direction}${r.phase ? '-walk-' + r.phase : ''}`)
      assert(r.sameObject, 'Animation must retain the same image object')
      assert.equal(r.filter, 1); assert.equal(r.scale, 1)
      assert.equal(r.originX, .5); assert.equal(r.originY, 60 / 64)
      assert.equal(r.width, 48); assert.equal(r.height, 64)
      assert.equal(r.groundY, r.y + 14)
    }
    await page.evaluate(() => {
      const { scene, game } = window.__characterTest
      scene.enterMap({ mapId: 'havn', x: 15, y: 12, facing: 'right' })
      scene.setUiBlocked(false)
      window.__gaitSamples = []
      game.events.on('postrender', () => window.__gaitSamples.push({ player: scene.playerImage.texture.key,
        oda: scene.residents.find(n => n.definition.id === 'oda')?.image.texture.key }))
      scene.residents.find(n => n.definition.id === 'oda').next = scene.time.now - 1
      scene.move('right')
    })
    await page.waitForTimeout(450)
    await page.evaluate(() => window.__characterTest.scene.move('right'))
    await page.waitForTimeout(450)
    const samples = await page.evaluate(() => window.__gaitSamples)
    assert(samples.some(s => s.player === 'player-right-walk-1'))
    assert(samples.some(s => s.player === 'player-right-walk-2'))
    assert.equal(samples.at(-1).player, 'player-right')
    assert(samples.some(s => s.oda === 'oda-right-walk-1'))
    assert(samples.some(s => s.oda === 'oda-right-walk-2'))
    assert.equal(samples.at(-1).oda, 'oda-right')
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
