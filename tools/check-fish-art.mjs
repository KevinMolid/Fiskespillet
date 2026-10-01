import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { build } from 'esbuild'

const ids=['makrell','sei','torsk','orret','abbor','lyr','sjoorret','gjedde','roye','sild','hvitting','rodspette','harr','sik','laks','brosme','lange','gjors','kveite','steinbit']
const bundle=await build({stdin:{contents:"export { FISH_BY_ID } from './src/game/fish'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'dataurl'}})
const {FISH_BY_ID}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))

for(const id of ids){
  const path=`src/assets/fish/${id}.png`,png=readFileSync(path)
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${id}: PNG signature`)
  assert.equal(png.readUInt32BE(16),96,`${id}: width`);assert.equal(png.readUInt32BE(20),64,`${id}: height`)
  assert.equal(png[25],6,`${id}: RGBA color type`)
  const chunks=[];let offset=8
  while(offset<png.length){const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+size));offset+=size+12;if(type==='IEND')break}
  const scanlines=inflateSync(Buffer.concat(chunks)),rgba=Buffer.alloc(96*64*4),stride=96*4
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c}
  for(let y=0;y<64;y++){const filter=scanlines[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,raw=scanlines[y*(stride+1)+x+1],a=x>=4?rgba[i-4]:0,b=y?rgba[i-stride]:0,c=y&&x>=4?rgba[i-stride-4]:0;rgba[i]=(raw+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255}}
  const alpha=new Set(),colors=new Set(),xs=[]
  for(let i=0;i<rgba.length;i+=4){alpha.add(rgba[i+3]);if(rgba[i+3]){colors.add(rgba.subarray(i,i+3).toString('hex'));xs.push((i/4)%96)}}
  assert.deepEqual([...alpha].sort((a,b)=>a-b),[0,255],`${id}: clean transparent background`)
  assert(colors.size<=12,`${id}: restrained palette`)
  const ratio=(Math.max(...xs)-Math.min(...xs)+1)/96
  assert(ratio>=.75&&ratio<=.85,`${id}: silhouette width ${ratio.toFixed(2)}`)
  assert.match(FISH_BY_ID[id].image,/^data:image\/png;base64,/ ,`${id}: data import`)
}
for(const id of ['mort','gullorret'])assert.equal(FISH_BY_ID[id].image,undefined,`${id}: not part of requested illustration set`)
console.log(`${ids.length} fish illustrations: 96x64 RGBA, clean alpha, 12-color palette, 75-85% silhouette width, species imports and unillustrated extras OK.`)
