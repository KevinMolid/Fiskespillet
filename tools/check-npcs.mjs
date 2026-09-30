import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ stdin: { contents: `export * from './src/game/world'; export * from './src/game/npcs'; export * from './src/game/npcSprite'`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' })
const { NPCS, MAPS, isWalkable, npcPixels } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(NPCS.length,8)
assert.equal(new Set(NPCS.map(n=>n.id)).size,8)
for(const n of NPCS) {
 for(let i=0;i<n.route.length;i++) {
  const [x,y]=n.route[i],next=n.route[(i+1)%n.route.length]
  assert(isWalkable(MAPS[n.mapId].tiles[y]?.[x]),`${n.name}: blocked route ${x},${y}`)
  if(n.route.length>1) assert.equal(Math.abs(x-next[0])+Math.abs(y-next[1]),1,`${n.name}: route must use adjacent tiles`)
  assert([[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>isWalkable(MAPS[n.mapId].tiles[y+dy]?.[x+dx])),`${n.name}: cannot talk`)
 }
 for(const direction of ['up','down','left','right']) for(let stride=0;stride<3;stride++) {
  const pixels=npcPixels(n,direction,stride)
  assert(pixels.length>140)
  assert(pixels.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<18&&p.y>=-2&&p.y<22))
 }
 assert(n.lines.length>=2)
 console.log(`${n.name}: route, interaction access and 12 sprite poses OK`)
}

const oda=NPCS.find(n=>n.id==='oda')
for(const direction of ['down','left','right']) {
 const pixels=npcPixels(oda,direction)
 assert(pixels.some(p=>p.color===0xfff4df),'Oda needs visible eye whites')
 assert(pixels.some(p=>p.color===0xb56c69),'Oda needs her smile')
}
assert(NPCS.filter(n=>n.route.length===1).every(n=>n.facing==='down'))
assert.equal(MAPS.butikk.tiles[4][12],'floor','Remove the old painted shopkeeper')

// Profiles must mirror exactly, and rear hair must cover the face area.
for (const npc of NPCS) {
 for (let stride=0; stride<3; stride++) {
  const right=npcPixels(npc,'right',stride)
  const left=new Map(npcPixels(npc,'left',stride).map(p=>[`${p.x},${p.y}`,p.color]))
  for(const pixel of right) assert.equal(left.get(`${17-pixel.x},${pixel.y}`),pixel.color,`${npc.name}: asymmetric profile`)
  const rear=npcPixels(npc,'up',stride)
  assert(!rear.some(p=>[0xfff4df,0x384d42,0xb56c69,0xa8c6c0].includes(p.color)),`${npc.name}: face details on back`)
  if(!npc.bald) {
   const top=npc.tall?-2:0
   assert.equal(rear.find(p=>p.x===9&&p.y===6+top)?.color,npc.hair,`${npc.name}: exposed face through rear hair`)
  }
 }
}
