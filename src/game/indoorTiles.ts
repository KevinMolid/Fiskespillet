import type Phaser from 'phaser'
import { TILE_SIZE, type Tile, type WorldMap } from './world'
import { ENVIRONMENT_PALETTE as p, pixelPainter, woodGrain } from './environmentPixels'

export function isIndoorObject(tile: Tile) {
  return ['wardrobe', 'furniture', 'bed', 'table', 'hearth', 'counter', 'stove', 'sofa', 'chest', 'shopCounter'].includes(tile)
}

export function drawIndoorGround(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  const r = pixelPainter(g, col * TILE_SIZE, row * TILE_SIZE), tile = map.tiles[row][col]
  const at = (dx: number, dy: number) => map.tiles[row + dy]?.[col + dx]
  r(0, 0, 32, 32, 0xc19b70)
  for (let y = 0; y < 32; y += 8) {
    r(0,y,32,1,0xd6b88c); r(0,y+7,32,1,0x9e7b55)
    const seam = ((row * 2 + col + y / 8) % 3) * 10 + 5
    r(seam,y+1,1,6,0xa7865e); r((seam+8)%27,y+4,5,1,0xba9368)
  }
  if (tile === 'wall' || tile === 'window') {
    r(0,0,32,32,p.cream)
    for (let y=1;y<27;y+=6) { r(0,y,32,1,p.creamLight); r(0,y+5,32,1,p.creamDark) }
    r(0,27,32,5,p.timberDark); r(0,27,32,1,p.timberLight)
    if (tile === 'window') {
      r(3,3,26,22,p.timberDark); r(4,4,24,20,p.creamLight); r(6,6,20,16,p.glass)
      r(7,6,18,4,p.glassLight); r(8,12,6,7,0x709fab)
      r(15,5,2,18,p.creamLight); r(5,13,22,2,p.creamLight)
      r(2,24,28,2,p.timber); r(2,24,28,1,p.creamLight)
    }
  } else if (tile === 'rug') {
    const same = (dx: number, dy: number) => at(dx,dy) === 'rug'
    r(0,0,32,32,0x9e6454)
    if (!same(0,-1)) { r(0,0,32,2,0x6b4840); r(0,3,32,2,0xd2b27e) }
    if (!same(0,1)) { r(0,30,32,2,0x6b4840); r(0,27,32,2,0xd2b27e) }
    if (!same(-1,0)) { r(0,0,2,32,0x6b4840); r(3,0,2,32,0xd2b27e) }
    if (!same(1,0)) { r(30,0,2,32,0x6b4840); r(27,0,2,32,0xd2b27e) }
    r(14,13,4,1,0xc59873); r(13,14,6,3,0xc59873); r(14,17,4,1,0xc59873)
    r(15,14,2,3,0x805444)
  } else if (tile === 'stairs') {
    r(2,1,28,30,p.timberDark)
    for (let y=2;y<31;y+=6) { r(4,y,24,4,p.timber); r(4,y,24,1,p.timberLight); r(4,y+4,24,1,0x463b30) }
    r(2,1,1,30,p.timberLight); r(29,1,1,30,p.timber)
    // Small stair marker retains the existing affordance without changing transitions.
    r(15,3,2,1,p.creamLight); r(13,4,6,1,p.creamLight); r(11,5,10,1,p.creamLight)
  } else if (tile === 'door') {
    r(4,2,24,28,p.timberDark); woodGrain(r,6,3,20,25,col)
    r(8,6,16,9,p.timberDark); r(9,7,14,7,p.timber); r(9,7,14,1,p.timberLight)
    r(8,19,16,7,p.timberDark); r(9,20,14,5,p.timber)
    r(22,17,2,2,0xe6c57d); r(3,30,26,2,p.stoneLight)
  }
}

export function drawIndoorObject(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  const r=pixelPainter(g,col*TILE_SIZE,row*TILE_SIZE), tile=map.tiles[row][col]
  const at=(dx:number,dy:number)=>map.tiles[row+dy]?.[col+dx]
  if (!isIndoorObject(tile)) return
  r(3,28,29,3,p.timberDark,0.25)
  if (tile === 'wardrobe') {
    r(3,-15,26,44,p.timberDark); r(4,-14,24,41,p.timber); r(3,-16,26,3,p.timberLight)
    for (const x of [6,17]) { r(x,-10,9,34,p.timberDark); r(x+1,-9,7,32,p.timber); r(x+1,-9,7,1,p.timberLight); r(x+2,-6,1,11,0xa9784c) }
    r(15,-13,1,40,p.timberDark); r(13,8,2,3,0xe1bb71); r(18,8,2,3,0xe1bb71)
    r(5,27,4,3,p.timberDark); r(23,27,4,3,p.timberDark)
  } else if (tile === 'chest') {
    r(3,6,26,23,p.timberDark); woodGrain(r,4,7,24,20,6)
    r(5,1,22,3,p.timberDark); r(3,4,26,7,p.timber); r(5,2,22,3,p.timberLight)
    r(6,4,20,1,p.creamDark); r(3,12,26,2,p.timberDark)
    for (const x of [7,23]) { r(x,3,2,24,p.metalDark); r(x,3,1,23,p.metalLight) }
    r(14,11,5,7,p.metalDark); r(15,11,3,5,0xe1bb71); r(16,13,1,2,p.timberDark)
  } else if (tile === 'counter' || tile === 'shopCounter' || tile === 'stove') {
    const counter=(t?:Tile)=>['counter','shopCounter','stove'].includes(t ?? '')
    const left=counter(at(-1,0))?0:2, right=counter(at(1,0))?32:30
    r(left,2,right-left,28,p.timberDark); r(left+1,12,right-left-2,16,p.timber)
    r(left,1,right-left,10,p.cream); r(left,1,right-left,1,p.creamLight); r(left,10,right-left,2,p.creamDark)
    r(left+2,14,right-left-4,1,p.timberLight); r(left+2,24,right-left-4,1,p.timberDark)
    r(14,17,4,1,p.metalDark); r(14,16,4,1,p.metalLight)
    if (tile === 'stove') {
      r(3,2,26,10,p.metal); r(4,3,24,8,p.metalLight)
      for (const x of [8,20]) { r(x,4,5,5,p.metalDark); r(x+1,5,3,3,p.metal); r(x+2,6,1,1,p.metalDark) }
      r(6,15,20,11,p.metalDark); r(8,17,16,7,p.metal); r(8,16,16,1,p.metalLight)
      r(9,13,2,1,p.metalDark); r(21,13,2,1,p.metalDark)
    } else if (tile === 'shopCounter') {
      // Register and bait tins, avoiding labels too small to read at world scale.
      r(16,-4,10,9,p.metalDark); r(17,-3,8,5,p.metal); r(18,-2,6,2,p.glassLight)
      r(17,4,9,3,p.metal); r(18,5,1,1,p.creamLight); r(21,5,1,1,p.creamLight)
      r(5,4,5,4,0xc59c61); r(5,3,5,1,p.creamLight); r(6,5,3,1,0x956747)
    }
  } else if (tile === 'bed') {
    const same=(dx:number,dy:number)=>at(dx,dy)==='bed'
    const left=same(-1,0)?0:3, right=same(1,0)?32:29
    const upper=same(0,-1), lower=same(0,1)
    r(left?1:0,0,right-left+(left?2:0)+(right<32?2:0),lower?32:30,p.timberDark)
    r(left,0,right-left,lower?32:28,p.cream)
    if (!upper) {
      r(left?1:0,-5,right-left+(left?2:0)+(right<32?2:0),5,p.timberDark)
      r(left?2:0,-4,right-left+(left?1:0)+(right<32?1:0),1,p.timberLight)
      r(5,2,22,8,p.creamLight); r(6,8,20,1,p.creamDark)
    }
    const start=upper?0:12, end=lower?32:28
    r(left,start,right-left,end-start,p.fabric)
    if (left) { r(left+1,start,2,end-start,p.fabricLight); r(left+5,start,1,end-start,0x3a5d61) }
    if (right<32) r(right-3,start,3,end-start,0x3a5d61)
    if (!upper) { r(left,start,right-left,1,p.fabricLight); r(left,start+2,right-left,1,0x638783) }
    if (!lower) { r(left?1:0,28,right-left+(left?2:0)+(right<32?2:0),2,p.timber); r(left?2:0,28,right-left+(left?1:0)+(right<32?1:0),1,p.timberLight) }
  } else if (tile === 'sofa') {
    const same=(dx:number)=>at(dx,0)==='sofa'
    r(0,1,32,28,p.timberDark); r(1,0,30,10,p.fabric); r(2,0,28,2,p.fabricLight)
    r(1,12,30,14,p.fabric); r(2,12,28,2,p.fabricLight); r(16,14,1,11,0x32565a)
    if (!same(-1)) { r(1,8,4,20,0x32565a); r(1,8,4,2,p.fabricLight) }
    if (!same(1)) { r(27,8,4,20,0x32565a); r(27,8,4,2,p.fabricLight) }
    r(3,28,3,2,p.timberDark); r(26,28,3,2,p.timberDark)
  } else if (tile === 'table') {
    const left=at(-1,0)==='table'?0:1, right=at(1,0)==='table'?32:31
    const upper=at(0,-1)==='table', lower=at(0,1)==='table'
    if (!lower) {
      if (left) r(4,20,3,10,p.timberDark)
      if (right<32) r(25,20,3,10,p.timberDark)
    }
    const top=upper?0:2, bottom=lower?32:25
    r(left,top,right-left,bottom-top,p.timberDark)
    for (let y=top+1;y<bottom-1;y+=5) woodGrain(r,left+(left?1:0),y,right-left-(left?1:0)-(right<32?1:0),Math.min(5,bottom-1-y),col+y)
    if (!lower) r(left,23,right-left,2,p.timberDark)
  } else if (tile === 'hearth') {
    r(2,-6,28,35,p.stoneDark); r(3,-5,26,32,p.stone)
    for (let y=-3;y<27;y+=6) { r(3,y,26,1,p.stoneLight); r(9+(y%2)*5,y+1,1,5,p.stoneDark) }
    r(6,7,20,19,p.timberDark); r(8,8,16,17,0x3e3935)
    r(11,18,10,6,0xd18542); r(13,13,3,9,0xe7b65b); r(17,16,2,7,0xf4d785)
    r(9,23,14,2,p.timberDark); r(0,27,32,3,p.stoneDark); r(0,27,32,1,p.stoneLight)
    r(0,-8,32,3,p.timberDark); r(0,-8,32,1,p.timberLight)
  } else if (tile === 'furniture') {
    r(3,-4,26,33,p.timberDark); r(4,-3,24,30,p.timber)
    if (map.id === 'butikk') {
      r(6,-1,20,25,p.timberDark)
      for (const y of [0,10,20]) {
        r(6,y+7,20,2,p.timberLight)
        for (const x of [8,15,22]) { r(x,y+1,3,5,(x+y)%2 ? p.fabricLight : 0xc49a63); r(x,y+1,3,1,p.creamLight) }
      }
    } else {
      r(5,0,22,8,p.timberDark); r(6,1,20,6,p.timberLight); r(13,4,6,1,p.metalDark)
      r(5,11,22,13,p.timberDark); r(6,12,20,11,p.timber); r(15,12,1,11,p.timberDark)
    }
    r(3,-5,26,2,p.timberLight)
  }
}

export function drawIndoorTile(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  drawIndoorGround(g,map,col,row)
  drawIndoorObject(g,map,col,row)
}
