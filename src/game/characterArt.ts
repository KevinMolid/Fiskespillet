import { CHARACTER_DIRECTIONS, CHARACTER_LAYER_ORDER, type BodyStyle, type CharacterAppearance, type CharacterLayer, type CharacterState } from './characterStandard'
import type { Direction } from './world'

export type PixelModule = { id: string; layer: CharacterLayer; palette: string; pixels: Uint8Array }
export type CharacterModule = { id: string; layer: CharacterLayer; frames: Record<Direction, Uint8Array>; states: Partial<Record<CharacterState,Record<Direction,readonly Uint8Array[]>>> }
const moduleCache = new Map<string, CharacterModule>()
// Native 48×48 integer pixel geometry. Every module is authored in this one space.
// The body variants are explicit identity exceptions, never renderer transforms.
function drawModule(id: string, body: BodyStyle, direction: Direction): Uint8Array {
  const pixels = new Uint8Array(48 * 48)
  const side = direction === 'right' || direction === 'left', back = direction === 'up'
  const heavy = body === 'stockyAdult', tall = body === 'tallAdult'
  const headY = tall ? -2 : 0, shoulderY = tall ? 21 : 22
  const left = side ? (heavy ? 18 : 20) : (heavy ? 14 : 17)
  const width = side ? (heavy ? 13 : 10) : (heavy ? 20 : 14)
  const rect = (x: number, y: number, w: number, h: number, slot: number) => {
    for (let yy = y; yy < y+h; yy++) for (let xx = x; xx < x+w; xx++) {
      if (xx < 0 || xx >= 48 || yy < 0 || yy >= 48) throw new Error(`${id}: artwork outside canvas`)
      pixels[yy * 48 + xx] = slot
    }
  }
  const box = (x: number, y: number, w: number, h: number, slot = 4) => {
    rect(x,y,w,h,1); rect(x+1,y+1,w-2,h-2,slot)
    if (w > 4 && h > 3) { rect(x+1,y+1,1,h-2,5); rect(x+w-2,y+2,1,h-3,3) }
  }
  const head = (x:number,y:number,w:number,h:number,slot:number) => rect(x,y+headY,w,h,slot)
  const headBox = (x:number,y:number,w:number,h:number,slot=4) => box(x,y+headY,w,h,slot)
  const legs = side ? [20,24] : [18,26]
  if (id === 'body') {
    // Compact adult skull: small eyes, defined jaw; no oversized chibi face.
    head(20,7,8,1,1); head(18,8,12,1,1); headBox(17,9,14,9)
    head(18,9,12,2,4); head(19,9,7,1,5)
    head(16,13,1,4,1); head(17,14,1,2,3)
    head(31,13,1,4,1); head(30,14,1,2,3)
    head(18,18,12,1,1); head(19,18,10,1,3)
    head(19,19,10,1,1); head(20,19,8,1,4); head(21,20,6,1,1)
    if (side) { head(30,15,2,2,1); head(30,15,1,2,4); head(21,14,2,3,3); head(22,14,1,2,5) }
    box(21,20+headY,6,4,4); box(left,shoulderY,width,11)
    if (side) { box(21,shoulderY+2,5,9); rect(22,29,3,3,4); rect(22,29,1,2,5) }
    else for (const x of [left-3,left+width]) { box(x,24,3,8); rect(x+1,28,1,3,5) }
    for (const x of legs) box(x,32,5,9)
  } else if (id === 'jeans' || id === 'cargo') {
    box(left+1,31,width-2,3)
    for (const x of legs) { box(x,33,5,7); rect(x+1,36,3,1,3); rect(x+1,38,2,1,5) }
    rect(23,32,2,2,2)
    if (id === 'cargo') { box(18,33,3,3,3); if (!side) box(27,33,3,3,3) }
  } else if (id === 'boots' || id === 'sneakers') {
    for (const x of legs) {
      const sx = side ? x-2 : x-1
      box(sx,39,side ? 8 : 6,3)
      rect(sx,41,side ? 8 : 6,1,1); rect(sx+1,40,side ? 6 : 4,1,5)
      if (id === 'boots') { rect(x+1,39,3,1,3); rect(x+1,40,2,1,6) }
    }
  } else if (['shirt','tshirt','sport','hawaiian'].includes(id)) {
    box(left,shoulderY,width,10)
    // Rounded shoulder and lower hem clusters, widening Magnus around the belly.
    rect(left,shoulderY,1,1,0); rect(left+width-1,shoulderY,1,1,0)
    rect(left+2,31,width-4,1,2); rect(left+2,shoulderY+2,2,6,5)
    rect(left+width-3,shoulderY+3,2,6,3)
    if (side) {
      box(21,shoulderY+1,5,id === 'shirt' ? 6 : 4)
      rect(22,shoulderY+2,2,1,5)
    } else {
      for (const x of [left-3,left+width]) box(x,shoulderY+1,3,id === 'shirt' ? 6 : 4)
      rect(22,shoulderY,4,1,2); if (!back) rect(23,shoulderY+1,2,1,3)
    }
    if (id === 'shirt' && !back) {
      rect(side ? 28 : 23,shoulderY+2,1,7,3)
      rect(side ? 28 : 24,shoulderY+3,1,1,6); rect(side ? 28 : 24,shoulderY+6,1,1,6)
    }
    if (id === 'sport') {
      rect(left+1,shoulderY+1,width-2,1,6)
      rect(side ? 22 : left+2,25,1,4,6)
      if (!side) rect(left+width-3,25,1,4,6)
    }
    if (id === 'hawaiian') for (const [x,y] of [[left+3,25],[left+width-5,28],[left+5,30]]) {
      rect(x,y,3,1,6); rect(x+1,y-1,1,3,6); rect(x+1,y,1,1,3)
    }
  } else if (id === 'fishingVest') {
    if (back) {
      box(left+1,shoulderY,width-2,10); box(left+3,26,width-6,3,3)
      rect(left+2,shoulderY+1,width-4,1,5)
    } else if (side) {
      box(27,shoulderY,3,10); box(27,26,3,3,5); rect(27,shoulderY,2,2,3)
      box(20,28,2,4,3)
    } else {
      box(left,shoulderY,5,10); box(left+width-5,shoulderY,5,10)
      box(left+1,26,4,3,5); box(left+width-5,26,4,3,5)
      rect(left+2,27,1,1,6); rect(left+width-3,27,1,1,6)
    }
  } else if (id === 'hairBack-longHair') {
    if (back) {
      headBox(16,10,16,14); head(18,11,2,10,5); head(28,12,2,10,3); head(19,23,10,1,3)
    } else { headBox(16,10,3,13); if (!side) headBox(29,10,3,13); head(17,12,1,8,5) }
  } else if (id.startsWith('hairFront-')) {
    const long = id.endsWith('longHair'), player = id.endsWith('playerHair')
    head(20,6,7,1,1); head(18,7,12,1,1); headBox(17,8,14,4)
    head(18,8,12,2,4); head(20,7,6,1,5); head(19,8,6,1,5)
    if (back) {
      headBox(17,10,14,long ? 7 : 8); head(18,10,2,6,5)
      head(20,16,8,2,3); head(20,18,8,1,1)
    } else if (side) {
      head(17,10,6,6,4); head(18,10,2,4,5); head(18,16,3,2,3)
      head(23,10,3,2,4); if (player) { head(26,10,2,3,3); head(27,12,1,1,1) }
    } else {
      head(17,10,2,long ? 9 : 6,4); head(29,10,2,long ? 9 : 6,3)
      head(19,11,3,2,4); head(21,11,2,3,3); head(25,11,3,2,4)
      if (player) { head(24,10,3,3,4); head(24,13,1,1,3) }
    }
  } else if (id === 'eyes') {
    if (!back) {
      for (const x of side ? [28] : [20,27]) {
        head(x,13,2,1,2); head(x,14,2,2,7); head(x+(side ? 1 : 0),14,1,2,1)
      }
      head(side ? 29 : 24,16,1,1,3); head(side ? 28 : 23,18,side ? 2 : 3,1,6)
    }
  } else if (id === 'glasses') {
    if (!back) {
      if (side) { head(22,13,6,1,1); head(27,13,4,1,1); head(27,16,4,1,1); head(27,14,1,2,1); head(30,14,1,2,1) }
      else {
        for (const x of [19,26]) { head(x,13,4,1,1); head(x,16,4,1,1); head(x,14,1,2,1); head(x+3,14,1,2,1) }
        head(23,14,3,1,1)
      }
    } else { head(16,14,1,1,1); head(31,14,1,1,1) }
  } else if (id === 'beard' || id === 'stubble') {
    if (!back) {
      const x = side ? 25 : 20, w = side ? 5 : 8
      head(x,19,w,1,3); head(x+1,20,w-2,1,2)
      if (id === 'beard') { head(x,17,1,2,3); head(x+w-1,17,1,2,3); head(x+1,18,w-2,1,4) }
      else for (let xx=x;xx<x+w;xx+=2) head(xx,18,1,1,3)
    }
  } else if (id === 'strawHat') {
    head(20,4,8,1,1); headBox(17,5,14,6); head(18,5,12,1,5)
    head(17,9,14,2,6); head(18,9,12,1,6)
    headBox(11,11,26,3); head(12,11,24,1,5); head(14,13,20,1,3)
    head(21,6,2,2,5); head(26,7,2,1,3)
  } else if (id === 'fishingSatchel') {
    // The satchel remains on the character's anatomical left across views.
    const bx = back ? 14 : side ? (direction === 'left' ? 18 : 25) : 28
    box(bx,29,6,7); box(bx,29,6,3,3); rect(bx+2,31,2,2,6)
    if (side) { rect(25,23,2,5,3); rect(26,27,2,3,4) }
    else for (let y=22;y<31;y++) rect(back ? 29-Math.floor((y-22)*1.5) : 18+Math.floor((y-22)*1.5),y,2,1,3)
  } else throw new Error(`Unknown character module: ${id}`)
  if (direction === 'left') {
    const mirrored = new Uint8Array(pixels.length)
    for (let y=0;y<48;y++) for (let x=0;x<48;x++) mirrored[y*48+x] = pixels[y*48+47-x]
    return mirrored
  }
  return pixels
}

export function characterModule(id: string, layer: CharacterLayer, body: BodyStyle): CharacterModule {
  const key = `${body}/${id}`
  let module = moduleCache.get(key)
  if (!module) {
    const frames = Object.fromEntries(CHARACTER_DIRECTIONS.map(d => [d,drawModule(id,body,d)])) as Record<Direction,Uint8Array>
    module = { id: key, layer, frames, states: { idle: { down:[frames.down], right:[frames.right], up:[frames.up], left:[frames.left] } } }
    moduleCache.set(key,module)
  }
  return module
}
export function appearanceModules(appearance: CharacterAppearance, direction: Direction, state: CharacterState='idle', frame=0): PixelModule[] {
  const modules: PixelModule[] = []
  const add = (id: string, layer: CharacterLayer, palette: string) => {
    const module = characterModule(id,layer,appearance.body)
    const pixels=module.states[state]?.[direction]?.[frame]
    if (!pixels) throw new Error(`${module.id}: missing ${state}/${direction}/${frame}`)
    modules.push({ id: module.id, layer, palette, pixels })
  }
  add('body','body',appearance.skinPalette)
  if (appearance.hair === 'longHair') add('hairBack-longHair','hairBack',appearance.hairPalette)
  add(appearance.bottom,'bottom',appearance.bottomPalette); add(appearance.shoes,'shoes',appearance.shoesPalette)
  add(appearance.top,'top',appearance.topPalette)
  if (appearance.outerwear) add(appearance.outerwear,'outerwear','tan')
  if (appearance.hair && appearance.hair !== 'bald') add(`hairFront-${appearance.hair}`,'hairFront',appearance.hairPalette)
  add('eyes','faceDetails',appearance.skinPalette)
  for (const detail of [...(appearance.faceDetails ?? [])].sort()) add(detail,'faceDetails',detail === 'glasses' ? 'charcoal' : appearance.hairPalette)
  if (appearance.headwear) add(appearance.headwear,'headwear','gold')
  for (const accessory of appearance.accessories ?? []) add(accessory,'accessories','brown')
  modules.sort((a,b) => CHARACTER_LAYER_ORDER.indexOf(a.layer)-CHARACTER_LAYER_ORDER.indexOf(b.layer))
  return modules
}
