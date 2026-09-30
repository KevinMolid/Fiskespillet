import type { NpcDefinition } from './npcs'
import type { Direction } from './world'
import type { SpritePixel } from './fisherSprite'

// Original pixel portraits, sharing the fisher's 2x pixels, ink and shaded palette.
export function npcPixels(npc: NpcDefinition, direction: Direction = 'down', stride = 0): SpritePixel[] {
  const pixels = new Map<string, SpritePixel>()
  const ink = 0x293e3e, skin = 0xe8b98c, shadow = 0xc78f69
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels.set(xx + ',' + yy, { x: xx, y: yy, color })
  }
  const outline = (x: number,y: number,w: number,h: number,color: number) => { rect(x,y,w,h,ink); rect(x+1,y+1,w-2,h-2,color) }
  const side = direction === 'left' || direction === 'right'
  const back = direction === 'up'
  const top = npc.tall ? -2 : 0
  outline(4,2+top,10,10,skin)
  for (const [x,y] of [[4,2+top],[13,2+top],[4,11+top],[13,11+top]]) pixels.delete(x+','+y)
  rect(6,3+top,5,1,0xf2cca2)
  rect(5,9+top,8,2,shadow)
  if (!npc.bald) {
    rect(5,1+top,8,3,npc.hair); rect(4,3+top,2,npc.longHair ? 11 : 3,npc.hair)
    rect(6,1+top,6,1,ink)
    rect(6,2+top,4,1,npc.longHair ? 0x49404b : npc.hair < 0x800000 ? 0x625246 : 0xefcf7d)
    if (!(npc.longHair && side)) rect(12,3+top,2,npc.longHair ? 11 : 3,npc.hair)
    if (back) rect(5,3+top,8,npc.longHair ? 10 : 6,npc.hair)
  }
  if (!back) {
    if (side) { rect(12,6+top,2,1,ink); rect(14,7+top,1,2,skin) }
    else { rect(6,6+top,1,2,ink); rect(11,6+top,1,2,ink) }
    if (npc.longHair) {
      // Open face, bright eyes and a small smile; keep the hair beside the cheeks.
      rect(side ? 9 : 6,9+top,side ? 5 : 6,3,skin)
      for (const x of side ? [11] : [6,10]) {
        rect(x,6+top,2,2,0xfff4df)
        rect(x+1,6+top,1,2,0x384d42)
        rect(x,5+top,2,1,ink)
      }
      rect(side ? 12 : 8,10+top,2,1,0xb56c69)
    }
    if (npc.glasses) {
      outline(side ? 10 : 5,5+top,4,4,0xa8c6c0)
      if (!side) { outline(10,5+top,4,4,0xa8c6c0); rect(9,6+top,1,1,ink) }
    }
    if (npc.beard) { rect(side ? 10 : 5,9+top,side ? 4 : 8,2,npc.hair); rect(7,11+top,5,1,npc.hair) }
  }
  const w = side ? npc.width-2 : npc.width, left = 9-w/2
  outline(left,12+top,w,7-top,npc.shirt)
  rect(8,12+top,3,1,skin)
  rect(left+1,14+top,1,3,0x405e62)
  rect(left+1,17,w-2,1,0x405e62)
  rect(left-1,13+top,2,4,npc.shirt); rect(left+w-1,13+top,2,4,npc.shirt)
  rect(left-1,17+top,2,2,skin); rect(left+w-1,17+top,2,2,skin)
  if (npc.sport) { rect(left+1,13+top,1,4,0xe8ebcf); rect(left+w-2,13+top,1,4,0xe8ebcf) }
  if (npc.hawaii) for (const [x,y] of [[left+2,14],[left+6,16],[left+8,13]]) { rect(x,y,3,1,0xf6d48d); rect(x+1,y-1,1,3,0xf6d48d) }
  const step = stride === 1 ? 1 : 0, other = stride === 2 ? 1 : 0
  outline(5,18,4,4-step,0x52666c); outline(10,18,4,4-other,0x52666c)
  rect(4,21-step,5,1,npc.sport ? 0xe2dfc7 : ink); rect(10,21-other,5,1,npc.sport ? 0xe2dfc7 : ink)
  return [...pixels.values()].map(p => ({ ...p, x: direction === 'left' ? 17-p.x : p.x }))
}
