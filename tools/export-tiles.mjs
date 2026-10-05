import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const bundle = await build({ entryPoints: ['src/game/outdoorTiles.ts','src/game/indoorTiles.ts'], outdir:'unused', bundle: true, write: false, platform: 'node', format: 'esm', loader:{'.png':'dataurl'} })
const modules=await Promise.all(bundle.outputFiles.map(file=>import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const {drawOutdoorTile,drawDecoration}=modules[0], {drawIndoorTile}=modules[1]
const outdoor=['grass','path','water','wall','roof','houseWall','window','door','dock','soil','sign','fence','rock']
const props=['flowers','reeds','bench','barrel','lamp','shopSign','chimney']
const indoor=['floor','wall','window','door','stairs','rug','counter','stove','shopCounter','table','sofa','bed','wardrobe','furniture','hearth','chest']
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
await mkdir('docs/art',{recursive:true})
await writeFile('docs/art/fiskespillet-tiles.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${columns*slotW}" height="${Math.ceil(index/columns)*slotH}" viewBox="0 0 ${columns*slotW} ${Math.ceil(index/columns)*slotH}" shape-rendering="crispEdges"><title>Fiskespillet – native 32px environment artwork</title><rect width="100%" height="100%" fill="#203b36"/>${shapes}<g fill="#e4d5b0" font-family="sans-serif" font-size="8">${labels}</g></svg>`)
console.log(`Exported ${index} environment designs, including unclipped tree crowns and all interior objects.`)
