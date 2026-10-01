import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const [sourcePath, targetPath] = process.argv.slice(2)
if (!sourcePath || !targetPath) throw new Error('Usage: node tools/prepare-fish-illustration.mjs source.png target.png')
const source = readFileSync(sourcePath), signature = '89504e470d0a1a0a'
if (source.subarray(0, 8).toString('hex') !== signature) throw new Error('Source is not a PNG')
let width, height, depth, type
const compressed=[]
for(let p=8;p<source.length;){const length=source.readUInt32BE(p),kind=source.toString('ascii',p+4,p+8),chunk=source.subarray(p+8,p+8+length);if(kind==='IHDR'){width=source.readUInt32BE(p+8);height=source.readUInt32BE(p+12);depth=chunk[8];type=chunk[9]}if(kind==='IDAT')compressed.push(chunk);p+=length+12;if(kind==='IEND')break}
if(depth!==8||type!==6)throw new Error('Expected an 8-bit RGBA PNG')
const stride=width*4,filtered=inflateSync(Buffer.concat(compressed)),rgba=Buffer.alloc(height*stride)
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c}
for(let y=0;y<height;y++){const f=filtered[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,v=filtered[y*(stride+1)+x+1],a=x>=4?rgba[i-4]:0,b=y?rgba[i-stride]:0,c=y&&x>=4?rgba[i-stride-4]:0;rgba[i]=(v+(f===1?a:f===2?b:f===3?Math.floor((a+b)/2):f===4?paeth(a,b,c):0))&255}}
let x0=width,y0=height,x1=-1,y1=-1
for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
if(x1<0)throw new Error('No opaque subject found; check the generated alpha channel')
const targetW=80,targetH=Math.round((y1-y0+1)*targetW/(x1-x0+1))
if(targetH>52)throw new Error(`Subject is too tall for the 96x64 canvas (${targetW}x${targetH})`)
const samples=[]
for(let y=0;y<targetH;y++)for(let x=0;x<targetW;x++){const sx=x0+Math.floor((x+.5)*(x1-x0+1)/targetW),sy=y0+Math.floor((y+.5)*(y1-y0+1)/targetH),i=(sy*width+sx)*4;if(rgba[i+3]>=128)samples.push([rgba[i],rgba[i+1],rgba[i+2]])}
// Median-cut palette preserves the generated art's own restrained species colors.
let boxes=[samples]
while(boxes.length<12){let best=-1,score=-1;for(let i=0;i<boxes.length;i++){if(boxes[i].length<2)continue;const ranges=[0,1,2].map(c=>Math.max(...boxes[i].map(p=>p[c]))-Math.min(...boxes[i].map(p=>p[c]))),s=Math.max(...ranges)*Math.log2(boxes[i].length);if(s>score){best=i;score=s}}if(best<0)break;const box=boxes.splice(best,1)[0],ranges=[0,1,2].map(c=>Math.max(...box.map(p=>p[c]))-Math.min(...box.map(p=>p[c]))),channel=ranges.indexOf(Math.max(...ranges));box.sort((a,b)=>a[channel]-b[channel]);const mid=Math.floor(box.length/2);boxes.push(box.slice(0,mid),box.slice(mid))}
const palette=boxes.map(box=>[0,1,2].map(c=>Math.round(box.reduce((sum,p)=>sum+p[c],0)/box.length)))
const image=Buffer.alloc(96*64*4),left=8,top=Math.floor((64-targetH)/2)
for(let y=0;y<targetH;y++)for(let x=0;x<targetW;x++){const sx=x0+Math.floor((x+.5)*(x1-x0+1)/targetW),sy=y0+Math.floor((y+.5)*(y1-y0+1)/targetH),si=(sy*width+sx)*4;if(rgba[si+3]<128)continue;let index=0,distance=Infinity;for(let c=0;c<palette.length;c++){const d=palette[c].reduce((sum,v,ch)=>sum+(v-rgba[si+ch])**2,0);if(d<distance){index=c;distance=d}}const i=((top+y)*96+left+x)*4;image[i]=palette[index][0];image[i+1]=palette[index][1];image[i+2]=palette[index][2];image[i+3]=255}
function chunk(name,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);let crc=0xffffffff;for(let i=4;i<8+data.length;i++){crc^=b[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}b.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return b}
const rows=Buffer.alloc(64*(96*4+1));for(let y=0;y<64;y++)image.copy(rows,y*(96*4+1)+1,y*96*4,(y+1)*96*4)
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(96);ihdr.writeUInt32BE(64,4);ihdr[8]=8;ihdr[9]=6
writeFileSync(targetPath,Buffer.concat([Buffer.from(signature,'hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]))
console.log(`Prepared 96x64 RGBA; subject ${targetW}x${targetH}; ${palette.length}-color palette; cropped from ${x0},${y0}–${x1},${y1}.`)
