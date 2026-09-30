import { build } from 'esbuild'
import assert from 'node:assert/strict'
const bundle = await build({ stdin: { contents: `export * from './src/game/world'; export * from './src/game/npcs'; export * from './src/game/npcSprite'`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' })
const { NPCS, MAPS, isWalkable, npcPixels } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
assert.equal(NPCS.length,5)
assert.equal(new Set(NPCS.map(n=>n.id)).size,5)
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
