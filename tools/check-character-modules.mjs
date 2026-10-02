import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle=await build({stdin:{contents:"export * from './src/game/characters'; export * from './src/game/characterArt'; export * from './src/game/characterCompositor'; export * from './src/game/characterPalettes'; export * from './src/game/characterStandard'; export { isAppearance } from './src/game/world'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty'}})
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(m.STANDARD_CHARACTERS.length,9)
for(const character of m.STANDARD_CHARACTERS) for(const direction of m.CHARACTER_DIRECTIONS) {
  const rgba=m.composeCharacter(character.appearance,direction)
  assert.equal(rgba.length,48*48*4)
  const ys=[]
  for(let y=0;y<48;y++) for(let x=0;x<48;x++) {
    const p=(y*48+x)*4,alpha=rgba[p+3]
    assert([0,255].includes(alpha))
    if(!alpha) assert.deepEqual([...rgba.slice(p,p+4)],[0,0,0,0])
    else { ys.push(y); assert(x>0&&x<47&&y>0&&y<47) }
  }
  assert.equal(Math.max(...ys)+1,42,`${character.id}/${direction}: actual sole`)
  const soles=[]
  for(let x=0;x<48;x++) if(rgba[(41*48+x)*4+3]) soles.push(x)
  assert.equal((Math.min(...soles)+Math.max(...soles)+1)/2,24,`${character.id}/${direction}: sole center X`)
  for(const module of m.appearanceModules(character.appearance,direction)) {
    assert.equal(module.pixels.length,2304)
    assert(module.pixels.every(slot=>slot>=0&&slot<m.SOURCE_SLOT_COLORS.length))
  }
}
const base=m.PLAYER_CHARACTER.appearance, modules=m.appearanceModules(base,'down')
assert.deepEqual(modules.map(x=>x.layer),['body','bottom','shoes','top','outerwear','hairFront','faceDetails','headwear','accessories'])
assert(m.isAppearance({shirt:0,hair:0,skin:0}))
assert(m.isAppearance({shirt:4,hair:4,skin:3,outfit:'sport',hairstyle:'bald'}))
assert(!m.isAppearance({shirt:0,hair:0,skin:0,outfit:'unsafe'}))
assert.deepEqual(m.playerCharacter({shirt:0,hair:0,skin:0}).appearance,base)
for(const field of ['skinPalette','hairPalette','topPalette']) {
  const changed={...base,[field]:field==='skinPalette'?'dark':field==='hairPalette'?'red':'rose'}
  assert.notDeepEqual(m.composeCharacter(base,'down'),m.composeCharacter(changed,'down'))
  assert.deepEqual(m.appearanceModules(changed,'down').map(x=>x.pixels),modules.map(x=>x.pixels),'Recolor preserves every pixel cluster')
}
for(const color of ['blond','darkBlond','brown','darkBrown','black','red']) assert.equal(m.characterPalette(color).length,8)
assert.equal(m.composedCharacter(base),m.composedCharacter({...base}),'Identical appearances reuse composed pixels')
for(let i=0;i<70;i++) m.composedCharacter({...base,skinPalette:['light','medium','dark'][i%3],hairPalette:['brown','black','red','blond','darkBlond','darkBrown'][Math.floor(i/3)%6],topPalette:['blue','green','rose','rust'][Math.floor(i/18)%4]})
assert(m.characterCompositeCacheSize()<=32)
assert.notDeepEqual(m.playerCharacter({shirt:0,hair:0,skin:0,outfit:'casual'}).appearance,base)
const magnus=m.NPC_CHARACTERS.magnus
assert.equal(magnus.appearance.body,'stockyAdult');assert.equal(magnus.appearance.hair,'bald')
for(const d of m.CHARACTER_DIRECTIONS) assert(!m.appearanceModules(magnus.appearance,d).some(x=>x.layer.startsWith('hair')))
assert.equal(m.NPC_CHARACTERS.bendik.appearance.body,'tallAdult')
assert.deepEqual(m.characterFrame({direction:'left',state:'walk',frame:3}),{state:'idle',frame:0,x:0,y:144,width:48,height:48})
console.log('36 poses, native geometry, soles, layers, controlled recolor, shared cache, identities, old/new wardrobe data and state fallback passed.')
