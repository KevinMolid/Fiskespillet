import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const bundle = await build({ entryPoints: ['src/game/outdoorTiles.ts','src/game/indoorTiles.ts','src/game/fenceArt.ts','src/game/buildingOpenings.ts'], outdir:'unused', bundle: true, write: false, platform: 'node', format: 'esm', loader:{'.png':'dataurl'} })
const modules=await Promise.all(bundle.outputFiles.map(file=>import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const {drawOutdoorTile,drawDecoration}=modules[0], {drawIndoorTile}=modules[1]
const {drawFence}=modules[2]
const outdoor=['grass','path','water','wall','roof','houseWall','window','door','dock','soil','sign','fence','rock']
const props=['flowers','reeds','bench','barrel','lamp','shopSign','chimney']
const indoor=['floor','wall','window','door','stairs','rug','counter','stove','shopCounter','table','sofa','bed','wardrobe','furniture','hearth','chest','fridge','sink','bin','diningTable','chairUp','chairDown']
const columns=8, slotW=64, slotH=112
let color='#000000', opacity=1, shapes='', labels='', offsetX=0, offsetY=0, index=0
const g={
  fillStyle(c,a=1) { color=`#${c.toString(16).padStart(6,'0')}`; opacity=a; return this },
  fillRect(x,y,w,h) { shapes+=`<rect x="${x+offsetX}" y="${y+offsetY}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`; return this },
}
function slot(label,draw) {
  const x=index%columns*slotW,y=Math.floor(index/columns)*slotH
  offsetX=x+16; offsetY=y+52
  labels+=`<text x="${x+32}" y="${y+103}" text-anchor="middle">${label}</text>`
  draw(); index++
}
for(const tile of outdoor) slot(tile,()=>drawOutdoorTile(g,{tiles:[[tile]],decorations:[]},0,0))
for(const kind of props) slot(kind,()=>drawDecoration(g,{kind,x:0,y:0}))
for(const tile of indoor) slot(tile,()=>drawIndoorTile(g,{id:'butikk',tiles:[[tile]]},0,0))
for(let links=0;links<16;links++) {
  const label=['N','E','S','W'].filter((_,i)=>links&(1<<i)).join('/')||'solo'
  slot(`fence ${label}`,()=>drawFence((x,y,w,h,c,a=1)=>g.fillStyle(c,a).fillRect(x,y,w,h),links))
}
await mkdir('docs/art',{recursive:true})
await writeFile('docs/art/fiskespillet-tiles.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${columns*slotW}" height="${Math.ceil(index/columns)*slotH}" viewBox="0 0 ${columns*slotW} ${Math.ceil(index/columns)*slotH}" shape-rendering="crispEdges"><title>Fiskespillet – native 32px environment artwork</title><rect width="100%" height="100%" fill="#203b36"/>${shapes}<g fill="#e4d5b0" font-family="sans-serif" font-size="8">${labels}</g></svg>`)
console.log(`Exported ${index} environment designs, including unclipped tree crowns and all interior objects.`)

// Multi-tile samples need wider slots than the ordinary single-tile catalogue.
shapes=''; labels=''
for (const [x,cols,rows] of [[16,1,1],[72,2,2],[152,3,2]]) {
  const map={id:'havn',tiles:Array.from({length:rows},()=>Array(cols).fill('window'))}
  for(let y=0;y<rows;y++)for(let col=0;col<cols;col++) {
    offsetX=x+col*32; offsetY=108-rows*32+y*32
    drawOutdoorTile(g,map,col,y)
  }
  labels+=`<text x="${x+cols*16}" y="128" text-anchor="middle">${cols}×${rows} / ${cols*rows} tiles</text>`
}
for(const [x,glazed] of [[280,true],[340,false]]) {
  offsetX=x; offsetY=78
  const painter=(x,y,w,h,c,a=1)=>g.fillStyle(c,a).fillRect(x,y,w,h)
  if(glazed) modules[3].drawDoor(painter)
  else modules[3].drawIndoorDoor(painter)
  labels+=`<text x="${x+16}" y="128" text-anchor="middle">${glazed?'Outside':'Inside'}</text>`
}
await writeFile('docs/art/building-openings.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="392" height="144" viewBox="0 0 392 144" shape-rendering="crispEdges"><title>Joined windows, exterior doors and single-tile interior exits</title><rect width="100%" height="100%" fill="#203b36"/>${shapes}<g fill="#e4d5b0" font-family="sans-serif" font-size="9"><text x="16" y="18">Joined window frames · 32px tiles · 64px exterior / 32px interior</text>${labels}</g></svg>`)
console.log('Exported joined 1-, 4- and 6-tile windows and full-height door samples.')
