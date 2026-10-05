import assert from 'node:assert/strict'
import { build } from 'esbuild'
const bundle=await build({entryPoints:['src/game/fenceArt.ts','src/game/world.ts'],outdir:'unused',bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'dataurl'}})
const [art,world]=await Promise.all(bundle.outputFiles.map(file=>import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const {drawFence,fenceConnections,FENCE_LINK:L,FENCE_PICKET_SPACING}=art
assert.equal(FENCE_PICKET_SPACING,16)
function raster(links) {
  const pixels=Array.from({length:32},()=>Array(32).fill(null))
  drawFence((x,y,w,h,c,a=1)=>{
    assert([x,y,w,h].every(Number.isInteger)&&w>0&&h>0)
    assert(x>=0&&x+w<=32&&y>=0&&y+h<=32)
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels[yy][xx]={c,a}
  },links)
  return pixels
}
const opaque=(pixel)=>pixel&&pixel.a===1
for(let mask=0;mask<16;mask++) {
  const pixels=raster(mask)
  assert(pixels.flat().some(opaque))
  const map={tiles:Array.from({length:3},()=>Array(3).fill('grass'))}
  map.tiles[1][1]='fence'
  for(const [bit,x,y] of [[L.north,1,0],[L.east,2,1],[L.south,1,2],[L.west,0,1]])if(mask&bit)map.tiles[y][x]='fence'
  assert.equal(fenceConnections(map,1,1),mask)
  if(mask===L.north+L.south) {
    const xs=pixels.flatMap(row=>row.map((pixel,x)=>opaque(pixel)?x:null).filter(x=>x!==null))
    assert(Math.max(...xs)-Math.min(...xs)+1<=5,'Vertical fence must be one narrow row')
    for(const y of [2,18])assert(opaque(pixels[y][15])&&opaque(pixels[y][16]),'Visible pointed board tips')
    assert.equal(pixels[2][5],null);assert.equal(pixels[2][23],null)
  }
  for(const [bit,x,y] of [[L.north,16,0],[L.east,31,12],[L.south,16,31],[L.west,0,12]])if(mask&bit)assert(opaque(pixels[y][x]),'Each connected arm must reach its tile edge')
}
const run=[raster(L.east),raster(L.west+L.east),raster(L.west)]
const tips=run.flatMap((pixels,i)=>pixels[3].map((pixel,x)=>opaque(pixel)?i*32+x:null).filter(x=>x!==null))
const centers=[]
for(let i=0;i<tips.length;i+=2){assert.equal(tips[i+1],tips[i]+1);centers.push(tips[i]+1)}
assert.deepEqual(centers,[16,32,48,64,80],'Even spacing across both tile seams')
const top=fenceConnections(world.MAPS.havn,3,3), bottom=fenceConnections(world.MAPS.havn,3,13)
assert.equal(top,L.east+L.south);assert.equal(bottom,L.north+L.east)
assert.equal(world.MAPS.havn.tiles[13][3],'fence')
assert.equal(world.MAPS.havn.tiles[13][7],'path','House entrance opening retained')
console.log('All 16 fence connections, seamless 16px picket rhythm, single 5px vertical row, visible tips and both garden corners passed.')
