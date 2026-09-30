import type { NpcDefinition } from './npcs'
import type { Direction } from './world'
import type { SpritePixel } from './fisherSprite'

function tint(color: number, amount: number) {
  const channel = (shift: number) => Math.max(0, Math.min(255, ((color >> shift) & 255) + amount))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

// Side and rear views have their own anatomy, rather than a front body with a turned face.
function turnedPixels(npc: NpcDefinition, direction: Direction, stride: number): SpritePixel[] {
  const pixels = new Map<string, SpritePixel>()
  const ink = 0x293e3e, skin = 0xe8b98c, shade = 0xc78f69
  const hairLight = tint(npc.hair, 24), hairDark = tint(npc.hair, -18)
  const shirtDark = tint(npc.shirt, -28), shirtLight = tint(npc.shirt, 18)
  const back = direction === 'up', top = npc.tall ? -2 : 0
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let yy = y; yy < y+h; yy++) for (let xx = x; xx < x+w; xx++) pixels.set(`${xx},${yy}`, { x: xx, y: yy, color })
  }
  const box = (x: number, y: number, w: number, h: number, color: number) => {
    rect(x,y,w,h,ink); rect(x+1,y+1,w-2,h-2,color)
  }
  const width = back ? npc.width : npc.width-2, left = 9-width/2
  // Legs point in the direction of travel; profile legs overlap at rest.
  if (back) {
    for (const [x, lifted] of [[5,stride===1],[10,stride===2]] as const) {
      box(x,18,4,lifted ? 3 : 4,0x52666c)
      rect(x, lifted ? 20 : 21,4,1,npc.sport ? 0xe2dfc7 : ink)
    }
  } else {
    const rear = stride === 1 ? 5 : 7, front = stride === 2 ? 10 : 9
    box(rear,18,4,4,0x40535b); box(front,18,4,4,0x60747a)
    rect(rear,21,5,1,npc.sport ? 0xd0cdb8 : ink)
    rect(front,21,5,1,npc.sport ? 0xe2dfc7 : ink)
  }
  box(left,12+top,width,7-top,npc.shirt)
  rect(left+1,13+top,1,4-top,shirtLight)
  rect(left+width-2,14+top,1,4-top,shirtDark)
  rect(left+1,17,width-2,1,shirtDark)
  if (npc.hawaii) {
    for (const x of back ? [left+2,left+7] : [left+2]) {
      rect(x,14,3,1,0xf6d48d); rect(x+1,13,1,3,0xf6d48d)
    }
  }
  if (back) {
    // Back collar and two sleeves. No exposed front neckline on the back.
    rect(7,12+top,4,1,shirtDark)
    for (const x of [left-1,left+width-1]) {
      rect(x,13+top,2,4,npc.shirt); rect(x,17+top,2,2,shade)
      if (npc.sport) rect(x,13+top,1,3,0xe8ebcf)
    }
  } else {
    // Only the near sleeve and hand are visible in profile.
    box(8,13+top,4,5,npc.shirt)
    rect(9,14+top,1,2,shirtLight)
    rect(9,17+top,2,2,skin)
    if (npc.sport) rect(9,13+top,1,3,0xe8ebcf)
  }
  // Rounded skull shared in scale, with a narrower profile and a projecting nose.
  box(4,3+top,10,8,skin)
  rect(5,2+top,8,1,ink); rect(6,1+top,6,1,ink)
  rect(6,2+top,6,1,npc.bald ? 0xf2cca2 : npc.hair)
  if (npc.bald) rect(5,3+top,8,1,skin)
  rect(5,10+top,8,1,shade)
  rect(6,11+top,6,1,ink)
  if (back) {
    rect(3,6+top,1,3,shade); rect(14,6+top,1,3,shade)
    if (!npc.bald) {
      rect(5,3+top,8,6,npc.hair)
      rect(4,4+top,1,5,hairDark); rect(13,4+top,1,5,hairDark)
      rect(6,3+top,5,1,hairLight)
      rect(5,8+top,8,2,hairDark)
      // Long hair falls over the sweater instead of being overwritten by it.
      if (npc.longHair) {
        rect(4,8+top,10,6,ink); rect(5,8+top,8,5,npc.hair)
        rect(6,8+top,1,4,hairLight); rect(11,8+top,2,5,hairDark)
        rect(6,13+top,6,1,hairDark)
      }
    }
  } else {
    rect(14,7+top,1,2,skin)
    rect(10,10+top,3,1,skin)
    if (!npc.bald) {
      rect(5,3+top,8,2,npc.hair); rect(5,5+top,4,4,npc.hair)
      rect(5,8+top,2,2,hairDark); rect(6,3+top,5,1,hairLight)
      if (npc.longHair) {
        rect(4,7+top,4,7,ink); rect(5,7+top,2,6,npc.hair)
        rect(5,8+top,1,4,hairLight)
      }
    }
    rect(9,7+top,1,2,shade) // ear between hair and face
    rect(12,6+top,1,2,ink)
    if (npc.longHair) {
      rect(11,6+top,2,2,0xfff4df); rect(12,6+top,1,2,0x384d42)
      rect(11,5+top,2,1,ink); rect(12,10+top,2,1,0xb56c69)
    }
    if (npc.glasses) {
      rect(8,6+top,3,1,ink); box(10,5+top,4,4,0xa8c6c0)
      rect(12,6+top,1,1,ink)
    }
    if (npc.beard) {
      rect(10,9+top,4,2,npc.hair); rect(10,11+top,3,1,hairDark)
    }
  }
  return [...pixels.values()].map(p => ({ ...p, x: direction === 'left' ? 17-p.x : p.x }))
}

// Original pixel portraits, sharing the fisher's 2x pixels, ink and shaded palette.
export function npcPixels(npc: NpcDefinition, direction: Direction = 'down', stride = 0): SpritePixel[] {
  if (direction !== 'down') return turnedPixels(npc, direction, stride)
  const pixels = new Map<string, SpritePixel>()
  const ink = 0x293e3e, skin = 0xe8b98c, shadow = 0xc78f69
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels.set(xx + ',' + yy, { x: xx, y: yy, color })
  }
  const outline = (x: number,y: number,w: number,h: number,color: number) => { rect(x,y,w,h,ink); rect(x+1,y+1,w-2,h-2,color) }
  const top = npc.tall ? -2 : 0
  outline(4,2+top,10,10,skin)
  for (const [x,y] of [[4,2+top],[13,2+top],[4,11+top],[13,11+top]]) pixels.delete(x+','+y)
  rect(6,3+top,5,1,0xf2cca2)
  rect(5,9+top,8,2,shadow)
  if (!npc.bald) {
    rect(5,1+top,8,3,npc.hair); rect(4,3+top,2,npc.longHair ? 11 : 3,npc.hair)
    rect(6,1+top,6,1,ink)
    rect(6,2+top,4,1,npc.longHair ? 0x49404b : npc.hair < 0x800000 ? 0x625246 : 0xefcf7d)
    rect(12,3+top,2,npc.longHair ? 11 : 3,npc.hair)
  }
  {
    rect(6,6+top,1,2,ink); rect(11,6+top,1,2,ink)
    if (npc.longHair) {
      // Open face, bright eyes and a small smile; keep the hair beside the cheeks.
      rect(6,9+top,6,3,skin)
      for (const x of [6,10]) {
        rect(x,6+top,2,2,0xfff4df)
        rect(x+1,6+top,1,2,0x384d42)
        rect(x,5+top,2,1,ink)
      }
      rect(8,10+top,2,1,0xb56c69)
    }
    if (npc.glasses) {
      outline(5,5+top,4,4,0xa8c6c0)
      outline(10,5+top,4,4,0xa8c6c0); rect(9,6+top,1,1,ink)
    }
    if (npc.beard) { rect(5,9+top,8,2,npc.hair); rect(7,11+top,5,1,npc.hair) }
  }
  const w = npc.width, left = 9-w/2
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
  return [...pixels.values()]
}
