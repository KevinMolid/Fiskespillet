import type Phaser from 'phaser'
import { TILE_SIZE, type Tile, type WorldMap } from './world'
import { ENVIRONMENT_PALETTE as p, environmentVariant, pixelPainter, woodGrain, type PixelPainter } from './environmentPixels'

import { drawFence, fenceConnections } from './fenceArt'
import { drawDoor, drawWindow } from './buildingOpenings'

export const OUTDOOR_PALETTE = p
export type Decoration = { x: number; y: number; kind: 'flowers' | 'reeds' | 'bench' | 'barrel' | 'lamp' | 'shopSign' | 'chimney'; ground?: 'grass' | 'path' }

export function isOutdoorObject(tile: Tile) {
  return ['wall', 'sign', 'fence', 'rock'].includes(tile)
}
export function isRaisedDecoration(kind: Decoration['kind']) {
  return ['bench', 'barrel', 'lamp'].includes(kind)
}
function groundAt(map: WorldMap, x: number, y: number): Tile | undefined {
  const tile = map.tiles[y]?.[x]
  return tile === 'furniture' ? map.decorations?.find(d => d.x === x && d.y === y)?.ground ?? 'grass' : tile
}
function grass(r: PixelPainter, col: number, row: number) {
  const v = environmentVariant(col, row)
  r(0, 0, 32, 32, p.grass)
  // Sparse clusters rather than one repeating mark in every cell.
  if (v < 12) {
    const x = 4 + v, y = 4 + v % 5
    r(x, y, 1, 3, p.grassDark); r(x + 2, y - 1, 1, 4, p.grassDark)
    r(x - 1, y + 1, 1, 1, p.grassLight); r(x + 1, y + 3, 3, 1, p.grassLight)
  }
  if (v % 3 === 0) { r(22, 21, 3, 1, p.grassDark); r(24, 20, 1, 1, p.grassLight) }
  if (v % 4 === 1) { r(5, 26, 2, 1, p.grassLight); r(7, 25, 1, 1, p.grassDark) }
}

export function drawOutdoorGround(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  const tile = groundAt(map, col, row)
  const r = pixelPainter(g, col * TILE_SIZE, row * TILE_SIZE)
  const at = (dx: number, dy: number) => groundAt(map, col + dx, row + dy)
  const v = environmentVariant(col, row)
  grass(r, col, row)
  if (tile === 'path' || tile === 'exit') {
    r(0, 0, 32, 32, p.sand)
    const connects = (t?: Tile) => ['path', 'exit', 'door', 'dock'].includes(t ?? '')
    if (!connects(at(0, -1))) { r(0, 0, 32, 1, p.grassDark); r(0, 1, 32, 1, p.sandLight); r(3, 0, 3, 1, p.grass); r(20, 1, 4, 1, p.sand) }
    if (!connects(at(0, 1))) { r(0, 31, 32, 1, p.grassDark); r(0, 30, 32, 1, p.sandDark); r(8, 30, 3, 1, p.sand); r(25, 31, 2, 1, p.grass) }
    if (!connects(at(-1, 0))) { r(0, 0, 1, 32, p.grassDark); r(1, 2, 1, 28, p.sandLight); r(0, 8, 1, 3, p.grass) }
    if (!connects(at(1, 0))) { r(31, 0, 1, 32, p.grassDark); r(30, 2, 1, 28, p.sandDark); r(30, 21, 1, 4, p.sand) }
    if (v < 11) { r(6 + v, 8, 2, 1, p.sandDark); r(7 + v, 9, 1, 1, p.sandLight); r(23, 22, 2, 1, p.sandLight) }
    if (v % 4 === 0) { r(5, 26, 2, 1, p.sandDark); r(19, 15, 1, 1, p.sandLight) }
  } else if (tile === 'water') {
    r(0, 0, 32, 32, p.water)
    const ripple = (x: number, y: number, w: number) => { r(x, y, w, 1, p.waterLight); r(x + w, y + 1, 2, 1, p.waterLight); r(x + 2, y + 2, w - 2, 1, p.waterDark) }
    ripple(3 + v % 4, 7 + v % 3, 9); ripple(16 - v % 5, 23, 7)
    if (v % 4 === 0) r(5, 8 + v % 3, 3, 1, p.foam)
    const land = (t?: Tile) => t !== undefined && t !== 'water' && t !== 'dock'
    if (land(at(0, -1))) { r(0, 0, 32, 2, p.grassDark); r(0, 2, 32, 2, p.sandDark); r(0, 4, 32, 2, p.sand); r(0, 6, 32, 2, p.waterLight); r(1, 6, 7, 1, p.foam); r(12, 6, 9, 1, p.foam); r(25, 7, 4, 1, p.foam) }
    if (land(at(0, 1))) { r(0, 30, 32, 2, p.sandDark); r(0, 28, 32, 2, p.sand); r(0, 26, 32, 2, p.waterLight); r(3, 27, 9, 1, p.foam); r(19, 26, 8, 1, p.foam) }
    if (land(at(-1, 0))) { r(0, 0, 3, 32, p.sandDark); r(3, 0, 2, 32, p.sand); r(5, 0, 2, 32, p.waterLight); r(6, 3, 1, 8, p.foam); r(5, 19, 1, 7, p.foam) }
    if (land(at(1, 0))) { r(29, 0, 3, 32, p.sandDark); r(27, 0, 2, 32, p.sand); r(25, 0, 2, 32, p.waterLight); r(25, 5, 1, 7, p.foam); r(26, 21, 1, 6, p.foam) }
    // Inner shoreline corners, including diagonal-only land.
    for (const [dx, dy, x, y] of [[-1,-1,0,0],[1,-1,29,0],[-1,1,0,29],[1,1,29,29]]) {
      if (land(at(dx, dy)) && !land(at(dx, 0)) && !land(at(0, dy))) { r(x, y, 3, 3, p.sand); r(dx < 0 ? 3 : 28, dy < 0 ? 3 : 28, 1, 1, p.foam) }
    }
  } else if (tile === 'roof') {
    const shop = col >= 18
    const dark = shop ? 0x324e57 : 0x613e36, mid = shop ? 0x56737d : 0xb27556
    const shade = shop ? 0x45616d : 0x925a44, light = shop ? 0x8199a0 : 0xdba377
    r(0, 0, 32, 32, mid)
    for (let y = 0; y < 32; y += 8) {
      r(0, y, 32, 1, light); r(0, y + 6, 32, 1, shade); r(0, y + 7, 32, 1, dark)
      const start = (y / 8 % 2) * 8
      for (let x = start; x < 32; x += 16) { r(x, y + 1, 1, 6, dark); r(x + 1, y + 1, 1, 4, light); r(x + 5, y + 4, Math.min(6, 27-x), 1, shade) }
    }
    if (at(0,-1) !== 'roof') { r(0,0,32,2,dark); r(1,2,30,1,light) }
    if (at(-1,0) !== 'roof') { r(0,0,2,32,dark); r(2,0,1,32,light) }
    if (at(1,0) !== 'roof') r(30,0,2,32,dark)
    if (at(0,1) !== 'roof') { r(0,27,32,5,dark); r(0,27,32,1,light); r(0,29,32,1,shade) }
  } else if (['houseWall', 'window', 'door'].includes(tile ?? '')) {
    r(0,0,32,32,p.cream)
    for (let y = 0; y < 32; y += 6) { r(0,y,32,1,p.creamLight); if (y+5<32) r(0,y+5,32,1,p.creamDark) }
    const facade = (t?: Tile) => ['houseWall','window','door'].includes(t ?? '')
    if (at(0,-1) === 'roof') { r(0,0,32,5,p.creamDark); r(0,5,32,1,0xc9b997) }
    if (!facade(at(-1,0))) { r(0,0,3,32,p.timberDark); r(3,0,1,32,p.creamLight) }
    if (!facade(at(1,0))) { r(29,0,3,32,p.timberDark); r(29,0,1,32,p.timber) }
    if (!facade(at(0,1))) { r(0,28,32,4,p.stoneDark); r(0,28,32,1,p.stoneLight); r(0,30,32,1,p.stone) }
    if (tile === 'window') drawWindow(r, map, col, row)
  } else if (tile === 'dock') {
    r(0,0,32,32,p.timberDark)
    for (let y = 0; y < 32; y += 8) {
      woodGrain(r,0,y,32,7,col+y)
      r(4,y+2,1,1,p.metalDark); r(27,y+2,1,1,p.metalDark)
      r(18,y+4,7,1,0xa97b50)
    }
    if (at(-1,0) !== 'dock') { r(0,0,3,32,p.timberDark); r(1,0,1,32,p.timberLight) }
    if (at(1,0) !== 'dock') { r(29,0,3,32,p.timberDark); r(29,0,1,32,p.timberLight) }
    if (at(0,1) !== 'dock') { r(0,29,32,3,p.timberDark); r(0,29,32,1,p.timberLight) }
  } else if (tile === 'soil') {
    r(5,4,22,24,p.grassDark); r(3,7,26,18,p.grassDark)
    r(6,5,20,22,0x896747); r(4,8,24,15,0x896747)
    for (let y=8;y<25;y+=4) { r(6,y,20,1,p.timberDark); r(7,y+1,18,1,0xb28b59) }
    r(6,5,20,1,0xb28b59); r(8,7,2,1,0xd0ab76); r(22,21,2,1,p.timberDark)
  } else if (tile === 'npc') {
    // Legacy map character artwork is intentionally unchanged.
    r(8,26,18,4,0x639858); r(10,16,14,12,0x8f5970); r(12,8,10,10,0xe4b086)
    r(10,4,14,6,0x674831); r(10,8,4,6,0x674831); r(18,10,2,2,0x344f48)
    r(10,28,6,2,0x344f48); r(20,28,4,2,0x344f48)
  }
}

// All object art is drawn upward from its existing tile's bottom ground line.
// The wider crown is visual only; movement still reads map.tiles.
function tree(r: PixelPainter, variant: number) {
  r(2,25,28,5,p.grassDeep,0.4); r(7,30,21,2,p.grassDeep,0.25)
  r(12,-4,9,33,p.timberDark); r(14,0,3,29,p.timber); r(14,3,1,23,p.timberLight)
  r(9,28,6,2,p.timberDark); r(20,27,5,3,p.timberDark); r(17,23,2,7,0x785235)
  r(8,0,7,3,p.timberDark); r(9,-2,3,5,p.timber); r(20,-6,3,8,p.timberDark)
  const crown = (x:number,y:number,w:number,h:number,c:number) => {
    r(x+6,y,w-12,2,c); r(x+3,y+2,w-6,3,c); r(x+1,y+5,w-2,h-10,c)
    r(x+3,y+h-5,w-6,3,c); r(x+6,y+h-2,w-12,2,c)
  }
  crown(-10,-30,52,43,p.leafDeep); crown(-2,-48,37,47,p.leafDeep)
  crown(-9,-28,29,35,p.leafDark); crown(16,-26,25,35,p.leafDark)
  crown(-1,-46,34,35,p.leaf); crown(-7,-26,30,29,p.leaf); crown(12,-23,25,32,p.leaf)
  crown(2,-44,24,24,p.leafLight); crown(-5,-25,22,20,p.leafLight)
  r(7,-43,10,2,p.leafSun); r(4,-39,7,2,p.leafSun); r(-1,-23,5,2,p.leafSun)
  // Broken leaf contours, with a stable variation for each tree.
  for (const [x,y,w] of [[9,-30,7],[21,-22,6],[4,-9,7],[18,2,7],[-3,-15,4],[28,-9,4],[15,-39,6],[6,-35,4]]) {
    r(x,y,w,1,p.leafDark); r(x+2,y+1,w-2,1,p.leafDeep); r(x,y-1,3,1,p.leafLight)
  }
  for (let i=0;i<12;i++) { const x=1+(variant+i*7)%29,y=-38+(variant*3+i*11)%43; r(x,y,2,1,p.leafLight); r(x+2,y+1,1,1,p.leafDark) }
  r(8,13,8,2,p.leafDeep); r(23,9,5,2,p.leafDeep)
}

export function drawOutdoorObject(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  const r = pixelPainter(g,col*TILE_SIZE,row*TILE_SIZE), tile=map.tiles[row][col]
  if (tile === 'wall') tree(r,environmentVariant(col,row))
  else if (tile === 'sign') {
    r(8,28,20,3,p.grassDeep,0.35); r(14,5,5,25,p.timberDark); r(15,6,2,23,p.timberLight)
    r(2,-9,28,20,p.timberDark); r(3,-8,26,18,p.timber); r(4,-7,24,15,p.sand)
    r(4,-7,24,1,p.sandLight); r(4,7,24,1,p.sandDark); r(5,-5,1,1,p.metalDark); r(26,-5,1,1,p.metalDark)
    r(8,-3,16,1,p.timberDark); r(8,0,11,1,p.timberDark); r(8,3,14,1,p.timber)
    r(16,12,1,6,p.timber); r(13,29,8,1,p.timberDark)
  } else if (tile === 'fence') {
    drawFence(r, fenceConnections(map, col, row))
  } else if (tile === 'rock') {
    r(3,26,27,4,p.grassDeep,0.4); r(3,16,27,11,p.stoneDark); r(6,9,21,17,p.stoneDark); r(10,6,13,18,p.stoneDark)
    r(5,16,23,8,p.stone); r(7,11,18,11,p.stone); r(11,7,11,10,p.stoneLight)
    r(8,13,5,3,p.stoneLight); r(5,20,7,2,0x919d88); r(19,18,8,4,p.stoneDark)
    r(19,10,1,6,p.stoneDark); r(20,16,4,1,p.stoneDark); r(12,8,6,1,0xc6cdb3)
    r(4,25,6,2,p.grassDark); r(6,24,4,1,p.grassLight)
  }
}

// Standalone previews and exports share the exact runtime artwork.
export function drawOutdoorTile(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  drawOutdoorGround(g,map,col,row)
  drawOutdoorObject(g,map,col,row)
  if (map.tiles[row][col] === 'door') drawDoor(pixelPainter(g,col*TILE_SIZE,row*TILE_SIZE))
}

export function drawDecoration(g: Phaser.GameObjects.Graphics, d: Decoration) {
  const r=pixelPainter(g,d.x*TILE_SIZE,d.y*TILE_SIZE)
  if (d.kind === 'flowers') {
    for (const [x,y] of [[6,7],[20,4],[13,20],[25,24]]) {
      r(x,y+3,1,5,p.grassDeep); r(x-2,y+5,2,1,p.grassDark); r(x+1,y+6,2,1,p.grassLight)
      r(x-1,y,3,1,0xf3dcaf); r(x-2,y+1,5,2,0xf3dcaf); r(x-1,y+3,3,1,0xdca477)
      r(x,y+1,1,2,0xb56554)
    }
  } else if (d.kind === 'reeds') {
    for (const [x,y] of [[5,10],[11,3],[20,7],[27,14]]) {
      r(x,y,1,29-y,p.grassDeep); r(x-1,y,2,5,p.timberDark); r(x-1,y,1,4,p.timberLight)
      r(x+1,y+9,1,9,p.grassLight); r(x+2,y+7,1,3,p.grassLight); r(x-2,y+12,1,6,p.grassDark)
    }
  } else if (d.kind === 'bench') {
    r(1,28,30,3,p.grassDeep,0.3); r(4,18,3,12,p.metalDark); r(25,18,3,12,p.metalDark)
    woodGrain(r,2,2,28,4); woodGrain(r,2,7,28,4,8); woodGrain(r,1,18,30,4,4)
    woodGrain(r,1,23,30,3,12); r(2,16,2,6,p.metal); r(28,16,2,6,p.metal)
    r(5,4,1,1,p.metalDark); r(26,9,1,1,p.metalDark)
  } else if (d.kind === 'barrel') {
    r(4,28,25,3,p.grassDeep,0.35); r(7,-2,18,31,p.timberDark); r(5,3,22,23,p.timberDark)
    r(7,2,18,24,p.timber); r(8,2,3,24,p.timberLight); r(12,2,1,24,p.timberDark); r(20,2,1,24,p.timberDark)
    r(8,-3,16,2,p.timberLight); r(9,-1,14,3,p.timberDark); r(10,0,12,1,p.timber)
    for (const y of [7,21]) { r(5,y,22,3,p.metalDark); r(6,y,20,1,p.metalLight); r(8,y+1,1,1,p.creamLight) }
    r(9,26,14,2,p.timberDark)
  } else if (d.kind === 'lamp') {
    r(8,28,19,3,p.grassDeep,0.35); r(14,-1,4,30,p.metalDark); r(14,0,1,27,p.metalLight)
    r(10,27,12,3,p.metalDark); r(11,27,10,1,p.metal)
    r(8,-15,16,3,p.metalDark); r(10,-17,12,2,p.metal); r(15,-19,2,2,p.metalDark)
    r(10,-12,12,13,p.metalDark); r(12,-11,8,9,0xe2c988); r(12,-11,3,7,0xf5e4b5)
    r(15,-11,1,9,p.metal); r(10,0,12,2,p.metal)
  } else if (d.kind === 'chimney') {
    r(9,3,15,25,0x67594d); r(8,1,16,25,0xa99176); r(9,2,4,23,0xc9b99b)
    for (let y=6;y<25;y+=5) { r(8,y,16,1,0x776653); r(16+(y%2)*3,y-4,1,4,0x776653) }
    r(6,-1,20,4,0xcebea0); r(8,-1,16,1,p.creamLight); r(11,0,10,1,p.timberDark)
  } else {
    r(0,4,32,24,p.timberDark); r(1,3,30,22,p.timberLight); r(3,5,26,18,p.cream)
    r(4,5,24,1,p.creamLight); r(5,21,22,1,p.creamDark)
    r(8,11,12,7,p.glass); r(11,9,6,11,p.glass); r(20,12,4,5,p.glass); r(24,10,2,9,p.glass)
    r(9,12,3,2,p.glassLight); r(17,14,1,1,p.creamLight)
  }
}
