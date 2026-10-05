import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173'
const errors=[], results=[]
await mkdir('output/environment-review',{recursive:true})
try {
  for(const mode of ['desktop','mobile','canvas']) {
    const mobile=mode==='mobile'
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage()
    page.on('pageerror',e=>errors.push(`${mode}: ${e.message}`))
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch()
      let body=(await response.text()).replace('return { game, scene };','window.__environmentTest={game,scene}; return { game, scene };')
      if(mode==='canvas')body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('window.__environmentTest'))
      await route.fulfill({response,body})
    })
    await page.goto(`${base}/tools/game-preview.html`)
    await page.waitForFunction(()=>window.__environmentTest?.scene.playerImage?.texture.key==='player-down')
    await page.waitForTimeout(1200)
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow')
    for(const [mapId,x,y] of [['havn',12,16],['skogstjern',9,16],['hjem',12,12],['hjem2',12,12],['butikk',12,12],['havn',12,16]]) {
      const metrics=await page.evaluate(async ({mapId,x,y})=>{
        const {scene,game}=window.__environmentTest
        const old=scene.environmentObjects.getChildren().slice()
        scene.enterMap({mapId,x,y,facing:'down'})
        const {MAPS}=await import('/src/game/world.ts')
        const {isOutdoorObject,isRaisedDecoration}=await import('/src/game/outdoorTiles.ts')
        const {isIndoorObject}=await import('/src/game/indoorTiles.ts')
        const map=MAPS[mapId],outside=['havn','skogstjern'].includes(mapId)
        const expected=map.tiles.flat().filter(outside?isOutdoorObject:isIndoorObject).length+(map.decorations??[]).filter(d=>isRaisedDecoration(d.kind)).length
        const objects=scene.environmentObjects.getChildren()
        return {expected,count:objects.length,oldDestroyed:old.every(o=>!o.scene),depths:objects.every(o=>(o.depth-16)%32===0),playerX:scene.player.x,playerY:scene.player.y,cameraFollows:scene.cameras.main._follow===scene.player,nearest:scene.playerImage.texture.source[0].scaleMode===1,pixelated:game.canvas.style.imageRendering==='pixelated',fps:game.loop.actualFps}
      },{mapId,x,y})
      assert.equal(metrics.count,metrics.expected);assert(metrics.oldDestroyed&&metrics.depths)
      assert.equal(metrics.playerX,x*32+16);assert.equal(metrics.playerY,y*32+16)
      assert(metrics.cameraFollows&&metrics.nearest&&metrics.pixelated)
      await page.waitForTimeout(350)
      if(mode==='desktop'||mapId==='havn')await page.locator('[aria-label="Spillkart"] canvas').screenshot({path:`output/environment-review/${mapId}-${mode}.png`})
      results.push({mode,mapId,...metrics})
    }
    for(const y of [19,21]) {
      const depth=await page.evaluate(({y})=>{
        const {scene}=window.__environmentTest
        scene.enterMap({mapId:'havn',x:9,y,facing:'down'})
        scene.player.setDepth(scene.player.y)
        scene.sys.displayList.depthSort()
        const tree=scene.environmentObjects.getChildren().find(o=>o.name==='environment-wall:9,20')
        const list=scene.sys.displayList.getChildren()
        return {hasTree:!!tree,playerOrder:list.indexOf(scene.player),treeOrder:list.indexOf(tree),playerDepth:scene.player.depth,treeDepth:tree?.depth}
      },{y})
      assert(depth.hasTree)
      assert(y<20?depth.playerOrder<depth.treeOrder:depth.playerOrder>depth.treeOrder,'Foot Y must govern actual display order')
      if(mode==='desktop')await page.locator('[aria-label="Spillkart"] canvas').screenshot({path:`output/environment-review/tree-${y<20?'behind':'front'}.png`})
    }
    if(mobile) {
      await page.setViewportSize({width:844,height:390})
      await page.waitForTimeout(500)
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Landscape overflow')
      await page.locator('[aria-label="Spillkart"] canvas').screenshot({path:'output/environment-review/havn-mobile-landscape.png'})
    }
    await context.close()
    console.log(`${mode}: five maps, repeated transitions, environment cleanup, ground depth, camera, nearest filtering and layout passed.`)
  }
  assert.deepEqual(errors,[])
  await writeFile('output/environment-review/checks.json',JSON.stringify(results,null,2))
} finally {await browser.close()}
