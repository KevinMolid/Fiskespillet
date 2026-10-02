import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
await mkdir('output/character-review',{recursive:true})
try {
  for(const mode of ['desktop','mobile','canvas']) {
    const mobile=mode==='mobile',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:mobile?3:1,isMobile:mobile,hasTouch:mobile})
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route(/\/src\/game\/characterRendering\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch(),body=(await response.text())+'\nwindow.__characterRendering = { createCharacterImage, setCharacterPose, characterTextureCacheSize };'
      await route.fulfill({response,body})
    })
    await page.route(/\/src\/game\/WorldScene\.ts(?:\?.*)?$/,async route=>{
      const response=await route.fetch();let body=(await response.text()).replace('return { game, scene };','window.__characterTest = { game, scene }; return { game, scene };')
      if(mode==='canvas') body=body.replace('type: Phaser.AUTO','type: Phaser.CANVAS')
      assert(body.includes('__characterTest'));await route.fulfill({response,body})
    })
    await page.goto('http://127.0.0.1:5173/tools/game-preview.html');await page.waitForFunction(()=>window.__characterTest?.scene.playerImage)
    const result=await page.evaluate(async()=>{
      const {scene}=window.__characterTest, {NPCS}=await import('/src/game/npcs.ts')
      const {NPC_CHARACTERS,playerCharacter}=await import('/src/game/characters.ts')
      const {createCharacterImage,setCharacterPose,characterTextureCacheSize}=window.__characterRendering
      const {composeCharacter}=await import('/src/game/characterCompositor.ts')
      scene.setUiBlocked(true)
      let poses=0
      for(const mapId of ['havn','hjem','butikk','skogstjern']) {
        scene.enterMap({mapId,x:2,y:16,facing:'down'})
        for(const definition of NPCS.filter(n=>n.mapId===mapId)) {
          const n=scene.residents.find(n=>n.definition.id===definition.id),original=n.image
          for(const direction of ['down','right','up','left']) {
            n.facing=direction;scene.drawResident(n)
            for(const state of ['idle','walk','fishCast','dig']) {
              setCharacterPose(n.image,{direction,state,frame:3});const i=n.image
              if(i!==original||i.width!==48||i.height!==48||i.scaleX!==1||i.scaleY!==1||i.originX!==.5||i.originY!==42/48||i.y!==14||i.texture.source[0].scaleMode!==1) throw Error('Renderer geometry/filter/object changed')
              const actual=i.texture.getSourceImage().getContext('2d').getImageData(0,0,48,48).data
              if(!actual.every((v,index)=>v===composeCharacter(NPC_CHARACTERS[definition.id].appearance,direction)[index])) throw Error('GPU canvas differs from canonical module pixels')
              poses++
            }
          }
        }
      }
      const kevin=NPC_CHARACTERS.kevin, a=createCharacterImage(scene,kevin,'down'),b=createCharacterImage(scene,{...kevin,id:'same-look'},'down')
      if(a.texture.key!==b.texture.key) throw Error('Equivalent NPCs do not reuse texture')
      a.destroy();b.destroy()
      const image=scene.playerImage
      for(let n=0;n<120;n++) scene.setAppearance({shirt:n%5,hair:Math.floor(n/5)%5,skin:Math.floor(n/25)%4,outfit:n%2?'sport':'casual'})
      if(scene.playerImage!==image||characterTextureCacheSize(scene)>32) throw Error('Wardrobe leaks image objects or appearance textures')
      scene.setAppearance({shirt:0,hair:0,skin:0})
      if(!image.texture.getSourceImage().getContext('2d').getImageData(0,0,48,48).data.every((v,index)=>v===composeCharacter(playerCharacter().appearance,scene.position.facing)[index])) throw Error('Appearance restoration differs')
      scene.enterMap({mapId:'havn',x:15,y:12,facing:'down'})
      return {poses,cache:characterTextureCacheSize(scene)}
    })
    assert.equal(result.poses,128);assert(result.cache<=32)
    await page.locator('.game-frame').screenshot({path:`output/character-review/native-world-${mode}.png`})
    const savedTexture=await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key)
    await page.evaluate(()=>window.__characterTest.scene.callbacks.onWardrobe())
    await page.getByRole('dialog',{name:'Garderoben'}).waitFor()
    await page.getByRole('button',{name:'Hverdagsklær',exact:true}).click()
    await page.getByRole('button',{name:'Skallet',exact:true}).click()
    assert.notEqual(await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key),savedTexture)
    assert.equal(await page.locator('.wardrobe-preview canvas').count(),3)
    await page.getByRole('button',{name:'Avbryt',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key),savedTexture)
    await page.evaluate(()=>window.__characterTest.scene.callbacks.onWardrobe())
    await page.getByRole('button',{name:'Sport',exact:true}).click()
    await page.getByRole('button',{name:'Lagre utseende',exact:true}).click()
    await page.getByRole('dialog',{name:'Garderoben'}).waitFor({state:'hidden'})
    const updatedTexture=await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key)
    assert.notEqual(updatedTexture,savedTexture)
    await page.evaluate(()=>window.__characterTest.scene.callbacks.onWardrobe())
    await page.getByRole('button',{name:'Fisker',exact:true}).click()
    await page.getByRole('button',{name:'Avbryt',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.__characterTest.scene.playerImage.texture.key),updatedTexture)
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
    await page.goto('http://127.0.0.1:5173/tools/character-preview.html');await page.waitForSelector('.card canvas')
    assert.equal(await page.locator('.card').count(),9);assert.equal(await page.locator('.card canvas').count(),36)
    for(const [control,choice] of [['Hud','dark'],['Hår','longHair'],['Hårfarge','red'],['Overdel','tshirt'],['Vest','none'],['Hatt','none'],['Veske','none'],['State','walk']]) await page.getByLabel(control,{exact:true}).selectOption(choice)
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
    await page.reload();await page.waitForSelector('.card canvas')
    if(mode==='desktop') await page.screenshot({path:'output/character-review/native-48-gallery.png',fullPage:true})
    assert.deepEqual(errors,[]);await context.close()
    console.log(`${mode}: 128 NPC direction/state checks, exact rendered pixels, shared textures, 120 wardrobe changes/cache, modular gallery and layout passed.`)
  }
} finally {await browser.close()}
