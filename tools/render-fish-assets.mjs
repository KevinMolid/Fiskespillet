import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// Small, hand-authored 48x32 fish pixels are doubled onto Fiskebok's 96x64 canvas.
const art = {
  makrell: { body:[[7,16],[9,10],[16,7],[27,8],[37,13],[40,16],[36,20],[26,24],[16,24],[9,21]], colors:['#293b38','#597a76','#799990','#b6c9b9','#e2dfc9','#506c68','#324641'], pattern:'waves', tail:[[37,13],[45,9],[42,16],[45,23],[37,20]], fins:[[[16,9],[19,3],[22,8]],[[24,8],[27,5],[30,9]],[[19,22],[23,28],[25,23]],[[29,22],[32,27],[34,21]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,18,36,17] },
  sei: { body:[[7,16],[10,10],[17,7],[27,8],[36,12],[39,16],[36,20],[26,24],[17,23],[10,21]], colors:['#293b38','#536f68','#789286','#bac9b7','#e5ddbe','#596f68','#34483f'], tail:[[37,12],[45,10],[43,16],[45,22],[37,20]], fins:[[[18,8],[21,4],[24,9]],[[25,9],[30,5],[33,11]],[[19,22],[23,27],[25,23]],[[29,22],[32,27],[34,21]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,17], pattern:'sparse' },
  torsk: { body:[[6,16],[8,11],[13,8],[21,7],[30,9],[37,13],[39,16],[36,20],[29,23],[19,24],[12,22],[8,20]], colors:['#293b38','#687858','#91a06b','#c0bd8d','#e5d9b1','#8d805f','#405345'], tail:[[37,13],[44,11],[46,16],[44,21],[37,20]], fins:[[[14,9],[16,4],[19,9]],[[20,8],[23,3],[26,9]],[[27,9],[31,5],[34,12]],[[17,22],[19,28],[22,23]],[[29,22],[31,27],[34,20]]], eye:[9,14], gill:[13,10,13,20], lateral:[14,16,37,16], barbel:[8,18,6,21], pattern:'speckles' },
  orret: { body:[[7,16],[9,11],[16,8],[26,9],[35,13],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#655546','#8c6f50','#ba9468','#e2d3ac','#c06b50','#38453a'], tail:[[37,13],[45,10],[43,16],[45,22],[37,20]], fins:[[[17,9],[21,5],[24,10]],[[20,22],[23,27],[26,23]],[[30,21],[33,25],[35,20]],[[31,9],[33,7],[35,13]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,17], pattern:'trout' },
  lyr: { body:[[7,16],[10,11],[17,8],[26,9],[35,12],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#5d685b','#849078','#b5b49a','#e5ddc4','#9c8060','#3c4d42'], tail:[[37,12],[45,8],[43,16],[45,24],[37,20]], fins:[[[17,9],[20,5],[24,10]],[[20,22],[24,27],[26,23]],[[30,21],[33,26],[35,20]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,18], pattern:'sparse', underbite:true },
  sjoorret: { body:[[7,16],[9,11],[16,8],[26,9],[35,13],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#526765','#718c86','#a9b9ad','#e3e1cf','#bd7058','#344740'], tail:[[37,13],[45,10],[43,16],[45,22],[37,20]], fins:[[[17,9],[21,5],[24,10]],[[20,22],[24,27],[26,23]],[[30,21],[33,26],[35,20]],[[31,10],[34,8],[36,14]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,17], pattern:'trout' },
  gjedde: { body:[[3,16],[6,12],[12,10],[20,10],[30,11],[38,14],[41,16],[38,19],[29,21],[18,22],[10,21],[5,19]], colors:['#293b38','#556b42','#71864d','#99a363','#d5d1a0','#718051','#34483a'], tail:[[39,14],[46,10],[44,16],[46,22],[39,19]], fins:[[[28,12],[32,8],[35,13]],[[31,19],[35,25],[37,19]],[[34,13],[36,10],[38,15]]], eye:[6,14], gill:[11,12,11,19], lateral:[12,16,39,17], pattern:'mottled' },
  roye: { body:[[7,16],[9,11],[16,8],[27,9],[35,13],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#46574f','#66756a','#879477','#d8cfad','#bd6245','#364941'], tail:[[37,13],[45,10],[43,16],[45,22],[37,20]], fins:[[[17,9],[21,5],[24,10]],[[20,22],[23,27],[26,23]],[[30,21],[33,26],[35,20]],[[31,10],[34,8],[36,14]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,17], pattern:'paleSpots' },
  sild: { body:[[7,16],[11,12],[18,10],[28,11],[37,14],[39,16],[37,19],[28,21],[18,22],[11,20]], colors:['#293b38','#687f7a','#91a8a0','#c2d0c7','#e9e4cf','#849b94','#3b514d'], tail:[[37,14],[45,10],[43,16],[45,22],[37,19]], fins:[[[21,11],[24,7],[27,12]],[[20,21],[23,25],[25,21]]], eye:[11,14], gill:[15,12,15,19], lateral:[16,16,37,16], pattern:'silver' },
  hvitting: { body:[[7,16],[9,11],[16,9],[25,10],[34,13],[39,16],[36,20],[26,23],[16,22],[10,20]], colors:['#293b38','#69786f','#929d8a','#c6c3a7','#e5ddc0','#85785e','#3e4c43'], tail:[[37,13],[44,11],[46,16],[44,21],[37,20]], fins:[[[15,10],[17,6],[19,10]],[[20,10],[23,7],[25,11]],[[27,11],[30,8],[33,14]],[[18,21],[21,26],[23,22]],[[30,21],[33,25],[35,20]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,16,37,17], pattern:'pectoralSpot' },
  rodspette: { body:[[8,16],[10,10],[16,7],[24,6],[32,8],[39,12],[42,16],[39,20],[32,24],[23,26],[15,24],[10,21]], colors:['#293b38','#655844','#8a7956','#b5a276','#d8c995','#c46143','#3c4938'], tail:[[40,13],[46,11],[47,16],[46,21],[40,19]], fins:[[[12,11],[14,8],[17,9]],[[12,20],[14,24],[17,24]]], eye:[12,12], secondEye:[14,12], gill:[15,13,15,18], pattern:'redSpots', edgeFin:true },
  harr: { body:[[7,17],[9,12],[16,9],[26,10],[35,13],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#66694f','#8b8a66','#b8ad87','#e3d9b8','#807553','#3e4b40'], tail:[[37,13],[45,10],[43,16],[45,22],[37,20]], fins:[[[18,10],[20,2],[22,1],[24,3],[27,4],[29,11]],[[19,22],[22,27],[25,23]],[[30,21],[33,25],[35,20]]], eye:[10,14], gill:[14,11,14,20], lateral:[15,17,37,17], pattern:'graylingFin' },
  sik: { body:[[7,16],[10,11],[17,9],[27,10],[36,13],[39,16],[36,19],[27,22],[17,22],[10,20]], colors:['#293b38','#64766e','#91a39a','#bec9bc','#e9e2ce','#829188','#394a43'], tail:[[37,13],[45,10],[43,16],[45,22],[37,19]], fins:[[[19,10],[22,6],[25,11]],[[20,21],[23,25],[25,21]],[[30,21],[32,24],[34,20]],[[31,10],[33,8],[35,14]]], eye:[11,14], gill:[15,11,15,19], lateral:[16,16,37,16], pattern:'silver' },
  laks: { body:[[7,16],[9,10],[16,7],[27,8],[36,13],[40,16],[37,20],[28,24],[17,24],[10,21]], colors:['#293b38','#516d68','#78918a','#b4c1b1','#e7dfc6','#cf866e','#394841'], tail:[[38,13],[45,9],[43,16],[45,23],[38,20]], fins:[[[18,8],[21,4],[24,9]],[[20,23],[23,28],[26,24]],[[31,22],[34,27],[36,20]],[[32,10],[34,8],[36,14]]], eye:[10,14], gill:[14,10,14,21], lateral:[15,16,38,17], pattern:'salmon' },
  brosme: { body:[[5,16],[7,11],[13,8],[20,8],[28,10],[36,13],[39,16],[36,20],[29,23],[20,24],[13,22],[8,20]], colors:['#293b38','#655846','#857054','#a8906c','#d7c49c','#927c60','#3c493c'], tail:[[37,13],[43,12],[45,16],[43,20],[37,20]], fins:[[[13,9],[15,7],[20,9],[28,10],[35,13]],[[13,22],[18,24],[29,23],[36,20]]], eye:[8,14], gill:[12,11,12,20], lateral:[13,16,37,16], barbel:[6,18,4,21], pattern:'mottled' },
  lange: { body:[[3,16],[7,12],[12,10],[21,11],[31,12],[38,14],[41,16],[38,19],[29,21],[18,22],[9,20],[5,19]], colors:['#293b38','#5c5144','#817057','#ad9872','#ded0ad','#8c7254','#3b493d'], tail:[[39,14],[46,12],[47,16],[46,20],[39,19]], fins:[[[14,11],[17,6],[20,11]],[[21,12],[27,11],[36,14]],[[12,20],[18,23],[25,21]],[[29,20],[37,19]]], eye:[7,14], gill:[11,12,11,19], lateral:[12,16,39,16], barbel:[4,18,2,20], pattern:'mottled' },
  gjors: { body:[[6,16],[9,10],[16,7],[26,8],[35,12],[39,16],[36,20],[27,23],[17,23],[10,21]], colors:['#293b38','#4f5d45','#778052','#a29c69','#ded4a4','#c57849','#35483d'], tail:[[37,12],[45,9],[43,16],[45,23],[37,20]], fins:[[[16,9],[18,3],[20,9],[22,3],[24,9]],[[24,9],[28,6],[32,11]],[[19,22],[22,27],[25,23]],[[31,20],[34,25],[36,20]]], eye:[9,14], gill:[13,10,13,20], lateral:[14,16,37,16], pattern:'zander' },
  kveite: { body:[[5,16],[9,9],[16,6],[25,7],[34,10],[40,14],[42,16],[39,19],[32,23],[23,25],[14,24],[8,21]], colors:['#293b38','#465247','#68725e','#96957c','#d5cba7','#f0e5c7','#3a4539'], tail:[[40,13],[46,11],[47,16],[46,21],[40,19]], fins:[[[9,11],[7,16],[9,21]],[[11,9],[10,16],[11,23]],[[14,7],[13,16],[14,24]],[[17,6],[16,16],[17,25]],[[20,7],[19,16],[20,25]]], eye:[11,10], secondEye:[14,10], gill:[16,12,16,17], pattern:'flatfish', edgeFin:true },
  steinbit: { body:[[4,16],[7,10],[13,8],[21,9],[29,11],[36,14],[40,16],[37,20],[30,23],[21,24],[13,22],[7,20]], colors:['#293b38','#566258','#7c8376','#a8a88f','#ded4b7','#9b7e62','#39473e'], tail:[[38,14],[45,12],[46,16],[45,20],[38,19]], fins:[[[16,9],[19,6],[23,10]],[[17,22],[22,27],[25,23]],[[29,21],[33,25],[35,20]]], eye:[8,13], gill:[12,10,12,20], pattern:'catfish' },
}

const palette = ['#26392f','#415342','#5d7349','#7d8d55','#a7a77a','#d1c69e','#eee1bf','#bb7552','#d18b58','#b9523d','#465b5a','#78928d']
const rgbPalette = palette.map(c => c.slice(1).match(/../g).map(hex => parseInt(hex,16)))
const width=96,height=64,gridW=48,gridH=32

function paintFish(id,spec) {
  const pixels=new Uint8Array(width*height*4), colors=spec.colors
  const grid=Array.from({length:gridH},()=>new Uint8Array(gridW)), colorIds=new Map()
  const color=(token)=>{
    if(colorIds.has(token))return colorIds.get(token)
    const rgb=token.slice(1).match(/../g).map(hex=>parseInt(hex,16));let best=0,distance=Infinity
    rgbPalette.forEach((entry,index)=>{const d=entry.reduce((sum,value,channel)=>sum+(value-rgb[channel])**2,0);if(d<distance){best=index;distance=d}})
    colorIds.set(token,best+1);return best+1
  }
  function polygon(points,fill,outline=true) {
    const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p[0])))),maxX=Math.min(gridW-1,Math.ceil(Math.max(...points.map(p=>p[0]))))
    const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),maxY=Math.min(gridH-1,Math.ceil(Math.max(...points.map(p=>p[1]))))
    const contains=(x,y)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside}return inside}
    const cells=[]
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(contains(x+.5,y+.5)){grid[y][x]=color(fill);cells.push([x,y])}
    if(outline)for(const [x,y] of cells)if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny])=>nx<0||ny<0||nx>=gridW||ny>=gridH||!grid[ny][nx]))grid[y][x]=color(colors[0])
  }
  function line(x0,y0,x1,y1,c,thickness=1) {
    let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy
    for(;;){for(let oy=-Math.floor(thickness/2);oy<=Math.floor(thickness/2);oy++)for(let ox=-Math.floor(thickness/2);ox<=Math.floor(thickness/2);ox++)if(x0+ox>=0&&y0+oy>=0&&x0+ox<gridW&&y0+oy<gridH)grid[y0+oy][x0+ox]=color(c);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx}if(e<=dx){err+=dx;y0+=sy}}
  }
  function dot(x,y,r,c){for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++)if(xx*xx+yy*yy<=r*r&&x+xx>=0&&y+yy>=0&&x+xx<gridW&&y+yy<gridH)grid[y+yy][x+xx]=color(c)}
  // Fins and tail sit behind the body and keep each species' outline readable.
  polygon(spec.tail,colors[5]);for(const fin of spec.fins)polygon(fin,colors[5]);
  polygon(spec.body,colors[2]);
  const bodyColumns=[]
  for(let x=0;x<gridW;x++){
    const intersections=[]
    for(let i=0,j=spec.body.length-1;i<spec.body.length;j=i++){
      const [x1,y1]=spec.body[j],[x2,y2]=spec.body[i]
      if((x1<=x+.5&&x2>x+.5)||(x2<=x+.5&&x1>x+.5))intersections.push(y1+(y2-y1)*(x+.5-x1)/(x2-x1))
    }
    intersections.sort((a,b)=>a-b);if(intersections.length>=2)bodyColumns[x]=[intersections[0],intersections.at(-1)]
  }
  for(let x=0;x<bodyColumns.length;x++)if(bodyColumns[x]){
    const [,bottom]=bodyColumns[x],depth=Math.min(3,Math.max(1,Math.round((bottom-bodyColumns[x][0])*.24)))
    for(let y=Math.ceil(bottom-depth);y<=Math.floor(bottom);y++)if(grid[y]?.[x])grid[y][x]=color(colors[4])
  }
  if(spec.edgeFin){for(let x=9;x<=40;x+=2){const upper=spec.body.find(p=>p[0]>=x);if(upper)dot(x,upper[1],0,colors[0])}}
  if(spec.lateral)line(...spec.lateral,colors[3])
  if(spec.pattern==='waves')for(let x=16;x<36;x+=4)line(x,10,x+2,14,colors[0],2)
  if(spec.pattern==='stripes')for(const x of [17,21,25,29,33])line(x,10,x+1,21,colors[0],2)
  if(spec.pattern==='trout'||spec.pattern==='salmon')for(let x=17;x<=34;x+=3)for(let y of (x%2?[11,15]:[12,17]))dot(x,y,0,spec.pattern==='salmon'&&y<16?colors[0]:colors[5])
  if(spec.pattern==='speckles'||spec.pattern==='mottled'||spec.pattern==='catfish')for(let x=18;x<=34;x+=4)for(let y=13+(x%2);y<20;y+=4)dot(x,y,0,colors[0])
  if(spec.pattern==='paleSpots')for(let x=17;x<=34;x+=4)for(let y=13+(x%2);y<20;y+=4)dot(x,y,1,colors[4])
  if(spec.pattern==='silver')line(17,15,35,15,colors[3]);
  if(spec.pattern==='pectoralSpot')dot(18,17,1,colors[0])
  if(spec.pattern==='mottled')for(let x=15;x<35;x+=6)line(x,13,x+2,15,colors[1])
  if(spec.pattern==='zander'){for(const x of [17,22,27,32])line(x,10,x+1,20,colors[0],1);dot(10,13,1,colors[6])}
  if(spec.pattern==='flatfish'){for(const [x,y] of [[19,11],[24,9],[29,12],[34,14],[22,17],[31,19],[16,16]])dot(x,y,1,colors[5])}
  if(spec.pattern==='redSpots')for(const [x,y] of [[20,12],[26,10],[32,13],[22,18],[30,19]])dot(x,y,1,colors[5])
  if(spec.pattern==='graylingFin')for(let y=5;y<=10;y+=2)for(let x=21;x<29;x+=3)dot(x,y,0,colors[4])
  if(spec.pattern==='catfish')for(const x of [18,22,26,30,34])line(x,11,x+1,20,colors[5])
  if(spec.gill)line(...spec.gill,colors[0])
  line(spec.eye[0]-4,spec.eye[1]+3,spec.eye[0]-1,spec.eye[1]+3,colors[0])
  dot(...spec.eye,1,colors[0]);dot(...spec.eye,0,colors[4])
  if(spec.secondEye){dot(...spec.secondEye,1,colors[0]);dot(...spec.secondEye,0,colors[4])}
  if(spec.barbel)line(...spec.barbel,colors[5])
  if(spec.underbite)line(5,18,9,20,colors[6])
  let minX=gridW,minY=gridH,maxX=-1,maxY=-1
  for(let y=0;y<gridH;y++)for(let x=0;x<gridW;x++)if(grid[y][x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
  const sourceW=maxX-minX+1,sourceH=maxY-minY+1,targetW=40,targetH=Math.min(28,Math.round(sourceH*targetW/sourceW)),offsetX=4,offsetY=Math.floor((gridH-targetH)/2)
  const finalGrid=Array.from({length:gridH},()=>new Uint8Array(gridW))
  for(let y=0;y<targetH;y++)for(let x=0;x<targetW;x++)finalGrid[offsetY+y][offsetX+x]=grid[minY+Math.floor((y+.5)*sourceH/targetH)][minX+Math.floor((x+.5)*sourceW/targetW)]
  for(let y=0;y<gridH;y++)for(let x=0;x<gridW;x++)if(finalGrid[y][x]){
    const [r,g,b]=rgbPalette[finalGrid[y][x]-1]
    for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){const i=((y*2+oy)*width+x*2+ox)*4;pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255}
  }
  return pixels
}

function pngChunk(type,data){
  const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length,0);b.write(type,4,'ascii');data.copy(b,8)
  let crc=0xffffffff;for(let i=4;i<8+data.length;i++){crc^=b[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  b.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return b
}
function encodePng(rgba){
  const source=Buffer.from(rgba),raw=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)source.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4)
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))])
}

const output='src/assets/fish';mkdirSync(output,{recursive:true})
for(const [id,spec] of Object.entries(art))writeFileSync(`${output}/${id}.png`,encodePng(paintFish(id,spec)))
console.log(`Rendered ${Object.keys(art).length} authored transparent fish sprites at 96x64.`)
