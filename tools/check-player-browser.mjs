// Local integration checks against the real GamePage/WorldScene, without account writes.
// Start Vite first. PLAYWRIGHT_MODULE may point to a bundled Playwright installation.
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
const errors = []
try {
  for (const mode of ['desktop', 'mobile', 'canvas']) {
    const mobile = mode === 'mobile'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/\/tools\/game-preview\.tsx(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      // Use the fixture's owned Sluk, which is valid for sea fishing at the pier.
      const body = (await response.text()).replace('equippedBait: "bread"', 'equippedBait: "spinner"')
      await route.fulfill({ response, body })
    })
    // Expose the existing scene only in the served test response, never in app code.
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      let body = (await response.text()).replace('return { game, scene };', 'window.__playerTest = { game, scene }; return { game, scene };')
      if (mode === 'canvas') body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS')
      assert(body.includes('window.__playerTest'), 'Scene instrumentation must match the served module')
      await route.fulfill({ response, body })
    })
    await page.goto('http://127.0.0.1:5173/tools/game-preview.html')
    await page.waitForFunction(() => window.__playerTest?.scene.playerImage?.texture.key === 'player-down')
    const state = () => page.evaluate(() => {
      const { scene, game } = window.__playerTest
      const p = scene.player, i = scene.playerImage, c = scene.cameras.main
      const mask = document.createElement('canvas')
      mask.width = i.width; mask.height = i.height
      const ctx = mask.getContext('2d')
      ctx.drawImage(i.texture.source[0].image, 0, 0)
      const rgba = ctx.getImageData(0, 0, mask.width, mask.height).data
      let soleY = 0
      for (let y = mask.height - 1; y >= 0 && !soleY; y--) {
        for (let x = 0; x < mask.width; x++) if (rgba[(y * mask.width + x) * 4 + 3] >= 128) { soleY = y + 1; break }
      }
      let headY = mask.height
      for (let y = 0; y < mask.height && headY === mask.height; y++) {
        for (let x = 0; x < mask.width; x++) if (rgba[(y * mask.width + x) * 4 + 3] >= 128) { headY = y; break }
      }
      return { position: { ...scene.position }, x: p.x, y: p.y, depth: p.depth, texture: i.texture.key,
        visibleHeight: (soleY - headY) * i.scaleY,
        feetY: p.y + i.y + (soleY - i.originY * i.height) * i.scaleY, soleY,
        scaleX: i.scaleX, scaleY: i.scaleY, originX: i.originX, originY: i.originY,
        height: i.displayHeight, width: i.displayWidth, localX: i.x, localY: i.y,
        filter: i.texture.source[0].scaleMode, zoom: c.zoom, follow: c._follow === p,
        scrollX: c.scrollX, scrollY: c.scrollY, canvasWidth: game.canvas.width,
        cssWidth: game.canvas.getBoundingClientRect().width, cssRendering: getComputedStyle(game.canvas).imageRendering,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    const start = await state()
    const npcGroundOffset = await page.evaluate(async () => {
      const { npcPixels } = await import('/src/game/npcSprite.ts')
      const { NPCS } = await import('/src/game/npcs.ts')
      const offsets = NPCS.flatMap(npc => ['down','up','left','right'].map(direction => Math.max(...npcPixels(npc, direction).map(p => (p.y + 1) * 2 - 30))))
      if (!offsets.every(y => y === offsets[0])) throw new Error('NPC sole baseline differs by character or direction')
      return offsets[0]
    })
    assert(start.height > 32)
    assert.equal(start.height, 59.2)
    assert.equal(start.scaleX, .05); assert.equal(start.scaleY, .05)
    assert.equal(start.width / start.height, 768 / 1184)
    assert.equal(start.originX, .5)
    assert.equal(start.originY, start.soleY / 1184)
    assert.equal(start.localX, 0); assert.equal(start.localY, npcGroundOffset)
    assert.equal(start.feetY, start.y + npcGroundOffset, 'Player and NPC soles align at identical world Y')
    assert.equal(start.x, start.position.x * 32 + 16)
    assert.equal(start.y, start.position.y * 32 + 16)
    assert(start.follow); assert.equal(start.depth, start.y)
    assert.equal(start.filter, 1) // Phaser NEAREST, including Canvas fallback.
    assert.equal(start.cssRendering, 'pixelated')
    assert(!start.overflow)
    assert(start.canvasWidth >= start.cssWidth * (mobile ? 3 : 1) - 2)

    for (const [direction, key, label] of [['up','ArrowUp','Opp'], ['right','d','Høyre'], ['down','s','Ned'], ['left','a','Venstre']]) {
      const before = await state()
      if (mobile) {
        const button = page.getByRole('button', { name: label, exact: true })
        const box = await button.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.waitForTimeout(380)
        await page.mouse.up()
      } else {
        await page.locator('.game-frame').focus()
        await page.keyboard.down(key)
        await page.waitForTimeout(380)
        await page.keyboard.up(key)
      }
      await page.waitForTimeout(250)
      const stopped = await state()
      assert.equal(stopped.texture, `player-${direction}`)
      assert.equal(stopped.position.facing, direction)
      assert.equal(stopped.originY, stopped.soleY / 1184, `${direction}: origin excludes PNG bottom padding`)
      assert.equal(stopped.feetY, stopped.y + npcGroundOffset, `${direction}: measured player/NPC foot baseline matches`)
      assert.notDeepEqual([stopped.x, stopped.y], [before.x, before.y])
      assert.equal(stopped.x, stopped.position.x * 32 + 16)
      assert.equal(stopped.y, stopped.position.y * 32 + 16)
      assert.equal(stopped.depth, stopped.y)
      if (direction === 'up') assert.notEqual(stopped.scrollY, before.scrollY, 'Camera follows the changing feet position')
      await page.waitForTimeout(250)
      assert.deepEqual((await state()).position, stopped.position, 'Release stops hold-to-move and keeps facing')
    }
    // Put the player beside Kevin on the exact same tile row, then inspect all
    // directional PNG soles against his rendered glyph baseline without moving.
    await page.evaluate(() => {
      const s = window.__playerTest.scene
      s.enterMap({ mapId: 'havn', x: 15, y: 12, facing: 'down' })
      s.setUiBlocked(true)
    })
    for (const direction of ['down','up','left','right']) {
      await page.evaluate(direction => {
        const s = window.__playerTest.scene
        s.position.facing = direction
        s.drawPlayer()
        const kevin = s.residents.find(n => n.definition.id === 'kevin')
        kevin.facing = direction
        s.drawResident(kevin)
      }, direction)
      const aligned = await state()
      assert.equal(aligned.soleY, 1172)
      assert.equal(aligned.scaleX, start.scaleX); assert.equal(aligned.scaleY, start.scaleY)
      assert.equal(aligned.height, start.height); assert.equal(aligned.width, start.width)
      assert.equal(aligned.filter, 1)
      const npc = await page.evaluate(() => {
        const s = window.__playerTest.scene
        const n = s.residents.find(n => n.definition.id === 'kevin')
        const i = n.sprite.list.find(child => child.type === 'Image')
        const mask = document.createElement('canvas')
        mask.width = i.width; mask.height = i.height
        const ctx = mask.getContext('2d')
        ctx.drawImage(i.texture.source[0].image, 0, 0)
        const rgba = ctx.getImageData(0, 0, mask.width, mask.height).data
        let soleY = 0
        for (let y = mask.height - 1; y >= 0 && !soleY; y--) {
          for (let x = 0; x < mask.width; x++) if (rgba[(y * mask.width + x) * 4 + 3] >= 128) { soleY = y + 1; break }
        }
        let headY = mask.height
        for (let y = 0; y < mask.height && headY === mask.height; y++) {
          for (let x = 0; x < mask.width; x++) if (rgba[(y * mask.width + x) * 4 + 3] >= 128) { headY = y; break }
        }
        return { y: n.sprite.y, depth: n.sprite.depth, x: n.sprite.x,
          sourceWidth: i.width, sourceHeight: i.height, visibleHeight: (soleY-headY) * i.scaleY,
          scaleX: i.scaleX, scaleY: i.scaleY, originX: i.originX, localY: i.y,
          feetY: n.sprite.y + i.y + (soleY - i.originY * i.height) * i.scaleY,
          texture: i.texture.key, filter: i.texture.source[0].scaleMode,
          originY: i.originY, soleY, height: i.displayHeight, width: i.displayWidth,
          otherNPCsRegistered: s.residents.filter(other => other !== n).every(other => other.sprite.list.some(child => child.type === 'Image' && child.texture.key.startsWith(other.definition.id+'-'))),
        }
      })
      const npcY = npc.y
      assert.equal(aligned.y, npcY, 'Same-row characters retain identical world Y')
      assert.equal(aligned.feetY, npcY + npcGroundOffset, `${direction}: actual same-row NPC and player align`)
      assert.equal(npc.feetY, aligned.feetY, `${direction}: real PNG soles align for player and new Kevin`)
      assert.equal(npc.texture, `kevin-${direction}`)
      assert.equal(npc.originY, npc.soleY / npc.sourceHeight)
      assert.equal(npc.sourceWidth, 48); assert.equal(npc.sourceHeight, 64)
      assert.equal(npc.scaleX, 1); assert.equal(npc.scaleY, 1)
      assert.equal(npc.originX, aligned.originX); assert.equal(npc.localY, aligned.localY)
      assert(Math.abs(npc.visibleHeight - aligned.visibleHeight) < 5, 'Characters fit the same world scale')
      assert(Math.abs(npc.width / npc.height - npc.sourceWidth / npc.sourceHeight) < 1e-12, 'Kevin keeps the source aspect ratio')
      assert.equal(npc.filter, 1)
      assert.equal(npc.depth, npc.y)
      assert.equal(npc.x, 14 * 32 + 16)
      assert(npc.otherNPCsRegistered)
      if (direction === 'down') {
        await page.waitForTimeout(150)
        await page.locator('.game-frame').screenshot({ path: join(tmpdir(), `fiskespillet-player-alignment-${mode}.png`) })
      }
    }
    await page.evaluate(() => window.__playerTest.scene.setUiBlocked(false))
    await page.evaluate(() => window.__playerTest.scene.move('left'))
    assert.equal((await state()).position.x, 15, 'Kevin still blocks his original tile, independent of artwork')
    await page.locator('.game-frame').focus()
    await page.keyboard.press('Space')
    await page.getByRole('paragraph').filter({ hasText: 'Velkommen! Trykk Enter' }).waitFor()
    assert.equal(await page.evaluate(() => window.__playerTest.scene.residents.find(n => n.definition.id === 'kevin').facing), 'right', 'Kevin faces the player during the existing conversation')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    // Blocked movement must face the wall, without moving the feet or camera target.
    await page.evaluate(() => window.__playerTest.scene.enterMap({ mapId: 'havn', x: 1, y: 16, facing: 'down' }))
    await page.evaluate(() => window.__playerTest.scene.move('left'))
    await page.waitForTimeout(180)
    const blocked = await state()
    assert.equal(blocked.position.x, 1); assert.equal(blocked.texture, 'player-left')
    assert.equal(blocked.x, 48); assert.equal(blocked.y, 528)
    assert(blocked.width > 32, 'Visual overlap extends beyond the collision tile')
    await page.evaluate(() => window.__playerTest.scene.move('up'))
    await page.waitForTimeout(180)
    assert.equal((await state()).position.y, 15, 'Can walk alongside a wall despite overlapping visual bounds')

    // Normal outdoor transitions and indoor doors/stairs use the existing move path.
    await page.evaluate(() => window.__playerTest.scene.enterMap({ mapId: 'havn', x: 46, y: 16, facing: 'right' }))
    await page.evaluate(() => window.__playerTest.scene.move('right'))
    await page.waitForTimeout(300)
    assert.equal((await state()).position.mapId, 'skogstjern')
    await page.evaluate(async () => {
      const { MAPS, isWalkable } = await import('/src/game/world.ts')
      const scene = window.__playerTest.scene
      window.__transitionCases = []
      for (const map of Object.values(MAPS)) for (const [tile, destination] of Object.entries(map.transitions ?? {})) {
        const [x,y] = tile.split(',').map(Number)
        const step = [[0,1,'up'], [0,-1,'down'], [1,0,'left'], [-1,0,'right']].find(([dx,dy]) => isWalkable(map.tiles[y+dy]?.[x+dx]))
        if (step) window.__transitionCases.push({ source: { mapId: map.id, x: x+step[0], y: y+step[1], facing: step[2] }, direction: step[2], destination })
      }
      scene.setUiBlocked(false)
    })
    for (const c of await page.evaluate(() => window.__transitionCases)) {
      await page.evaluate(c => { const s=window.__playerTest.scene; s.enterMap(c.source); s.move(c.direction) }, c)
      await page.waitForTimeout(180)
      assert.deepEqual((await state()).position, c.destination)
    }

    const sign = await page.evaluate(async () => {
      const { MAPS, isWalkable } = await import('/src/game/world.ts')
      const [tile, sign] = Object.entries(MAPS.havn.signs)[0]
      const [x,y] = tile.split(',').map(Number)
      const [dx,dy,facing] = [[0,1,'up'],[0,-1,'down'],[1,0,'left'],[-1,0,'right']].find(([dx,dy]) => isWalkable(MAPS.havn.tiles[y+dy]?.[x+dx]))
      window.__playerTest.scene.enterMap({ mapId: 'havn', x: x+dx, y: y+dy, facing })
      return sign
    })
    await page.waitForTimeout(180)
    if (mobile) await page.getByRole('button', { name: 'Les', exact: true }).last().click()
    else { await page.locator('.game-frame').focus(); await page.keyboard.press('Space') }
    await page.getByRole('paragraph').filter({ hasText: sign.text }).waitFor()
    await page.keyboard.press('Escape')

    // Direction determines fishing eligibility; action still opens the existing dialog.
    await page.getByText('Teststeder og posisjon', { exact: true }).click()
    await page.getByRole('button', { name: 'Fiske ved bryggen', exact: true }).click()
    await page.waitForFunction(() => window.__playerTest.scene.position.x === 24 && window.__playerTest.scene.playerImage?.texture.key === 'player-down')
    const facing = await page.evaluate(async () => {
      const { canFish } = await import('/src/game/world.ts')
      const p=window.__playerTest.scene.position
      return ['down','up','left','right'].map(facing=>canFish({...p,facing}))
    })
    assert.deepEqual(facing, [true, false, false, false])
    if (mobile) await page.getByRole('button', { name: 'Fisk', exact: true }).last().click()
    else { await page.locator('.game-frame').focus(); await page.keyboard.press('e') }
    await page.waitForSelector('[role="dialog"]')
    assert(await page.evaluate(() => window.__playerTest.scene.fishing))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.getByText('Teststeder og posisjon', { exact: true }).click()
    const final = await state()
    assert(!final.overflow)
    assert.equal(final.height, start.height)
    if (mobile) {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.waitForTimeout(250)
      const rotated = await state()
      assert.equal(rotated.scaleX, start.scaleX)
      assert(!rotated.overflow)
      assert(rotated.follow)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(250)
    }
    await page.screenshot({ path: join(tmpdir(), `fiskespillet-player-${mode}.png`), fullPage: true })
    console.log(`${mode}: pixel player 4 directions, common scale/PNG foot alignment, nearest filtering, all NPCs registered, Kevin blocking/conversation, movement, depth, camera, transitions, signs/fishing and layout passed.`)
    await context.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
