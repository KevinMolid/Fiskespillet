// Reproducible native pixel assets from the same modules used by the renderer.
import { build } from 'esbuild'
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
const bundle=await build({ stdin:{contents:"export * from './src/game/characters'; export * from './src/game/characterArt'; export * from './src/game/characterCompositor'; export * from './src/game/characterPalettes'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.png':'empty'} })
const { STANDARD_CHARACTERS, CHARACTER_DIRECTIONS, CHARACTER_STANDARD, composeCharacter, appearanceModules, characterModule, SOURCE_SLOT_COLORS }=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function crc(bytes) {
  let c=0xffffffff
  for (const byte of bytes) { c^=byte; for(let b=0;b<8;b++) c=(c>>>1)^((c&1)?0xedb88320:0) }
  return (c^0xffffffff)>>>0
}
function chunk(type,data) { const label=Buffer.from(type), n=Buffer.alloc(4), check=Buffer.alloc(4); n.writeUInt32BE(data.length); check.writeUInt32BE(crc(Buffer.concat([label,data]))); return Buffer.concat([n,label,data,check]) }
async function png(path,width,height,rgba) {
  const header=Buffer.alloc(13); header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6
  const rows=Buffer.alloc(height*(width*4+1))
  for(let y=0;y<height;y++) Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(rows,y*(width*4+1)+1)
  await mkdir(dirname(path),{recursive:true})
  await writeFile(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]))
}
const modules=new Map(), measurements={standard:CHARACTER_STANDARD,characters:{},modules:[]}
for (const character of STANDARD_CHARACTERS) {
  const directory=join('src/assets/characters',character.id)
  await mkdir(directory,{recursive:true})
  measurements.characters[character.id]={appearance:character.appearance,directions:{}}
  for(const direction of CHARACTER_DIRECTIONS) {
    const rgba=composeCharacter(character.appearance,direction)
    await png(join(directory,`${direction}.png`),48,48,rgba)
    const points=[]
    for(let y=0;y<48;y++) for(let x=0;x<48;x++) if(rgba[(y*48+x)*4+3]) points.push([x,y])
    measurements.characters[character.id].directions[direction]={bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0]))+1,Math.max(...points.map(p=>p[1]))+1]}
    for(const module of appearanceModules(character.appearance,direction)) modules.set(module.id,{layer:module.layer,body:character.appearance.body,id:module.id.split('/')[1]})
  }
  for(const name of await readdir(directory)) if(/^(down|up|left|right)-walk-[12]\.png$/.test(name)) await unlink(join(directory,name))
}
for(const [key,definition] of modules) {
  const module=characterModule(definition.id,definition.layer,definition.body), rgba=new Uint8ClampedArray(48*192*4)
  CHARACTER_DIRECTIONS.forEach((direction,row)=>module.frames[direction].forEach((slot,pixel)=>{
    if(!slot)return
    const offset=(row*48*48+pixel)*4,color=SOURCE_SLOT_COLORS[slot]
    rgba[offset]=(color>>16)&255;rgba[offset+1]=(color>>8)&255;rgba[offset+2]=color&255;rgba[offset+3]=255
  }))
  const path=join('src/assets/characters/modules',key,'idle.png')
  await png(path,48,192,rgba)
  measurements.modules.push({id:key,layer:definition.layer,sheet:path.replaceAll('\\','/'),width:48,height:192})
}
await writeFile('docs/character-48-measurements.json',JSON.stringify(measurements,null,2)+'\n')
console.log(`Exported 36 native 48×48 RGBA characters and ${modules.size} reusable 48×192 module sheets. Old walk art removed.`)
