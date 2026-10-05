import assert from 'node:assert/strict'
import {build} from 'esbuild'
const bundle=await build({entryPoints:['src/game/outdoorTiles.ts','src/game/indoorTiles.ts','src/game/world.ts'],outdir:'unused',bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'dataurl'}})
const [outdoor,indoor,world]=await Promise.all(bundle.outputFiles.map(file=>import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
let active=[],color=0,alpha=1
const g={fillStyle(c,a=1){color=c;alpha=a;return this},fillRect(x,y,w,h){assert([x,y,w,h].every(Number.isInteger),'Native pixels must be integers');assert(w>0&&h>0,'Empty pixel cluster');assert(alpha>0&&alpha<=1);active.push({x,y,w,h,color,alpha});return this}}
const before=JSON.stringify(world.MAPS)
let tiles=0,objects=0,decorations=0,details=0
for(const map of Object.values(world.MAPS)) {
  const outside=['havn','skogstjern'].includes(map.id)
  for(let y=0;y<map.tiles.length;y++)for(let x=0;x<map.tiles[y].length;x++) {
    active=[]
    ;(outside?outdoor.drawOutdoorGround:indoor.drawIndoorGround)(g,map,x,y)
    assert(active.length>0)
    assert(active.every(s=>s.x>=x*32&&s.y>=y*32&&s.x+s.w<=x*32+32&&s.y+s.h<=y*32+32),`Ground art outside ${map.id} ${x},${y} ${map.tiles[y][x]}: ${JSON.stringify(active.filter(s=>s.x<x*32||s.y<y*32||s.x+s.w>x*32+32||s.y+s.h>y*32+32))}`)
    details+=active.filter(s=>s.w===1||s.h===1).length
    tiles++
    if(outside?outdoor.isOutdoorObject(map.tiles[y][x]):indoor.isIndoorObject(map.tiles[y][x])) {
      active=[]
      ;(outside?outdoor.drawOutdoorObject:indoor.drawIndoorObject)(g,map,x,y)
      assert(active.length>0)
      const bounds={left:Math.min(...active.map(s=>s.x-x*32)),top:Math.min(...active.map(s=>s.y-y*32)),right:Math.max(...active.map(s=>s.x+s.w-x*32)),bottom:Math.max(...active.map(s=>s.y+s.h-y*32))}
      assert(bounds.bottom<=32&&bounds.top>=-48&&bounds.left>=-10&&bounds.right<=42,'Object art exceeds authored bounds')
      const first=JSON.stringify(active);active=[]
      ;(outside?outdoor.drawOutdoorObject:indoor.drawIndoorObject)(g,map,x,y)
      assert.equal(JSON.stringify(active),first,'Map redraw should preserve art exactly')
      objects++
    }
  }
  for(const d of map.decorations??[]) {active=[];outdoor.drawDecoration(g,d);assert(active.length>0);decorations++}
}
assert(details>tiles,'Native 1px detail throughout the environment')
assert.equal(JSON.stringify(world.MAPS),before,'Artwork must never mutate gameplay/map data')
console.log(`${tiles} tiles, ${objects} objects, ${decorations} decorations: native integer pixels, bounded ground/visual bounds, deterministic redraw and unchanged map data passed.`)
