// Real start menu + GamePage/Phaser, with offline preview services only.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181'
await mkdir('output/female-player-review', { recursive: true })
try {
  for (const [mode, width, height] of [['desktop',1280,900], ['mobile',390,844], ['landscape',844,390]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mode === 'desktop' ? 1 : 3, isMobile: mode !== 'desktop', hasTouch: mode !== 'desktop' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/, () => {})
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch()
      const body = (await response.text()).replace('return { game, scene };', 'window.__choiceWorld = { game, scene }; return { game, scene };')
      assert(body.includes('window.__choiceWorld'))
      await route.fulfill({ response, body })
    })
    const choose = page.getByRole('dialog', { name: 'Velg spillkarakter' })
    const fits = async () => {
      const dimensions = await choose.evaluate(el => {
        const r = el.getBoundingClientRect(), b = el.querySelector('footer button:last-child').getBoundingClientRect()
        return { right: r.right, bottom: r.bottom, left: r.left, top: r.top, buttonBottom: b.bottom, buttonTop: b.top, windowWidth: innerWidth, windowHeight: innerHeight }
      })
      assert(dimensions.left >= 0 && dimensions.top >= 0 && dimensions.right <= dimensions.windowWidth && dimensions.bottom <= dimensions.windowHeight, `${mode}: choice fits screen`)
      assert(dimensions.buttonTop >= dimensions.top && dimensions.buttonBottom <= dimensions.bottom + 1, `${mode}: start button visible without scrolling`)
    }
    await page.goto(`${base}/tools/menu-preview.html?saved=0`)
    await page.getByRole('button', { name: 'Nytt spill', exact: true }).click()
    await choose.waitFor()
    await fits()
    await page.getByRole('button', { name: 'Figur med røde detaljer' }).click()
    assert.equal(await page.getByRole('button', { name: 'Figur med røde detaljer' }).getAttribute('aria-pressed'), 'true')
    assert(!(await choose.textContent()).match(/mannlig|kvinnelig/i), 'Character choices do not name genders')
    await page.screenshot({ path: `output/female-player-review/choice-${mode}.png` })
    await page.getByRole('button', { name: 'Tilbake', exact: true }).click()
    assert.equal(await choose.count(), 0, 'Cancel never starts or resets a game')
    await page.getByRole('button', { name: 'Nytt spill', exact: true }).click()
    await page.getByRole('button', { name: 'Figur med røde detaljer' }).click()
    await page.getByRole('button', { name: 'Start spillet', exact: true }).click()
    await page.getByRole('dialog', { name: 'Spillmeny' }).waitFor()
    assert((await page.locator('.equipment-portrait img').getAttribute('src')).includes('player-female'))
    await page.goto(`${base}/tools/menu-preview.html?saved=1`)
    await page.getByRole('button', { name: 'Nytt spill', exact: true }).click()
    await page.getByRole('alertdialog').waitFor()
    await page.getByRole('button', { name: 'Avbryt', exact: true }).click()
    assert.equal(await choose.count(), 0)
    await page.getByRole('button', { name: 'Nytt spill', exact: true }).click()
    await page.getByRole('button', { name: 'Slett alt og start', exact: true }).click()
    await choose.waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await choose.count(), 0)

    // Existing saves, including legacy appearances, continue without a selection.
    await page.goto(`${base}/tools/game-preview.html?character=legacy`)
    await page.waitForFunction(() => window.__choiceWorld?.scene.playerImage?.texture.key === 'player-down')
    assert.equal(await choose.count(), 0)
    await page.goto(`${base}/tools/game-preview.html?character=female`)
    await page.waitForFunction(() => window.__choiceWorld?.scene.playerImage?.texture.key === 'player-female-down')
    assert.equal(await choose.count(), 0, 'Saved choice loads without asking again')
    const audit = await page.evaluate(async () => {
      const { FEMALE_PLAYER_CHARACTER: female, PLAYER_CHARACTER: male } = await import('/src/game/characters.ts')
      const { setCharacterDirection } = await import('/src/game/characterRendering.ts')
      const { scene } = window.__choiceWorld
      const original = { ...scene.position }, out = []
      scene.setUiBlocked(true)
      for (const direction of ['down','right','up','left']) {
        for (const pose of [undefined,'castAim','castForward','fishingIdle']) {
          for (const step of pose ? [0] : [0,1,3,2]) {
            setCharacterDirection(scene.playerImage, female, direction, step, pose)
            const image = scene.playerImage, source = image.texture.getSourceImage()
            const format = pose ? female.poses[pose].format : female.format
            const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height
            const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0)
            const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data
            let solid = 0, alphaValid = true, sole = 0
            for (let p=3;p<pixels.length;p+=4) { if(pixels[p]!==0&&pixels[p]!==255) alphaValid=false; if(pixels[p]) solid++ }
            for (let y=canvas.height-1;y>=0&&!sole;y--) for(let x=Math.max(0,format.groundAnchor.x-384);x<Math.min(canvas.width,format.groundAnchor.x+384);x++) {
              if(pixels[(y*canvas.width+x)*4+3]) { sole=y+1; break }
            }
            out.push({ direction, pose, step, solid, alphaValid, sole, anchor: format.groundAnchor.y,
              scale:image.scaleX, filter:image.texture.source[0].scaleMode,
              actual:[source.width,source.height], expected:[format.canvas.width,format.canvas.height],
              origin:[image.originX,image.originY], expectedOrigin:[format.groundAnchor.x/format.canvas.width,format.groundAnchor.y/format.canvas.height] })
          }
        }
      }
      scene.drawPlayer()
      return { out, original, position:scene.position, sameScale:female.format.renderScale===male.format.renderScale, follows:scene.cameras.main._follow===scene.player }
    })
    assert.equal(audit.out.length,28)
    for(const a of audit.out) {
      assert(a.solid>0 && a.alphaValid, `${mode}: ${a.direction}/${a.pose}/${a.step} clean RGBA`)
      assert.deepEqual(a.actual,a.expected); assert.deepEqual(a.origin,a.expectedOrigin)
      assert.equal(a.scale,.05); assert.equal(a.filter,1); assert.equal(a.sole,a.anchor, `${a.direction}/${a.pose}/${a.step}: actual boot baseline matches shared anchor`)
    }
    assert(audit.sameScale && audit.follows); assert.deepEqual(audit.position,audit.original)
    const casts = await page.evaluate(async () => {
      const { MAPS, isWalkable, TILE_SIZE } = await import('/src/game/world.ts')
      const { castTargets } = await import('/src/game/fishing.ts')
      const s = window.__choiceWorld.scene, results = []
      for(const facing of ['down','right','up','left']) {
        let origin
        for(const map of Object.values(MAPS)) {
          for(let y=1;y<map.tiles.length-1&&!origin;y++) for(let x=1;x<map.tiles[y].length-1&&!origin;x++) {
            const p = { mapId:map.id,x,y,facing }
            if(isWalkable(map.tiles[y][x]) && castTargets(p).length >= 4) origin = p
          }
          if(origin) break
        }
        if(!origin) throw new Error('No directional cast fixture')
        s.enterMap(origin); s.fishing = true; s.setCastAim(true)
        const aim = s.playerImage.texture.key, expectedTip = s.playerCharacter.poses.castForward
        const promise = s.playCast(4)
        const forward = s.playerImage.texture.key, flight = s.castFlight
        const tip = expectedTip.rodTip[facing], f = expectedTip.format
        const correctStart = Math.abs(flight.getData('startX')-(s.player.x+(tip.x-f.groundAnchor.x)*f.renderScale))<.001
          && Math.abs(flight.getData('startY')-(s.player.y+14+(tip.y-f.groundAnchor.y)*f.renderScale))<.001
        const completed = await promise
        const relaxed = s.playerImage.texture.key, before = { ...s.position }
        s.setRetrieveProgress(4,.5)
        const dx = { down:0,up:0,right:1,left:-1 }[facing],dy = { down:1,up:-1,right:0,left:0 }[facing]
        const distance = (4+.7)/2
        const shadowCorrect = Math.abs(s.lureShadow.x-(s.player.x+dx*distance*TILE_SIZE))<.001
          && Math.abs(s.lureShadow.y-(s.player.y+dy*distance*TILE_SIZE))<.001
        s.finishFishing()
        results.push({ facing, aim, forward, relaxed, correctStart, completed, shadowCorrect,
          idle:s.playerImage.texture.key, positionUnchanged:JSON.stringify(before)===JSON.stringify(s.position), clean:!s.castFlight&&!s.castSplash&&!s.lureShadow })
      }
      s.enterMap({ mapId:'havn',x:12,y:16,facing:'down' }); s.setUiBlocked(false)
      return results
    })
    for(const cast of casts) {
      for(const [state,suffix] of [['aim','-cast-aim'],['forward','-cast-forward'],['relaxed','-fishing-idle'],['idle','']]) assert.equal(cast[state],`player-female-${cast.facing}${suffix}`)
      assert(cast.correctStart && cast.completed && cast.shadowCorrect && cast.positionUnchanged && cast.clean)
    }
    await page.screenshot({ path: `output/female-player-review/game-${mode}.png`, fullPage: true })
    assert.deepEqual(errors,[])
    console.log(`${mode}: new-game-only character choice/cancel/reset, no gender labels, legacy continue, 28 female textures, RGBA, nearest, scale, foot anchors, camera and full 4-direction casting/retrieval passed.`)
    await context.close()
  }
} finally { await browser.close() }
