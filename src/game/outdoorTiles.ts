import type Phaser from 'phaser'
import type { Tile, WorldMap } from './world'

// Original 16px pixel artwork, drawn at 2× to match the world's 32px cells.
// Neighbour-aware edges keep paths, roofs and shorelines continuous.
export const OUTDOOR_PALETTE = {
  grass: 0x88bd72, grassLight: 0xa3ce83, grassDark: 0x639858,
  sand: 0xe6d4a0, sandLight: 0xf2e2b7, sandDark: 0xbba976,
  water: 0x529eae, waterDark: 0x398496, foam: 0xb5dace,
  ink: 0x344f48, timber: 0x89664b, cream: 0xf1e3bb,
}

export function drawOutdoorTile(g: Phaser.GameObjects.Graphics, map: WorldMap, col: number, row: number) {
  const cell = map.tiles[row][col]
  const tile = cell === 'furniture' ? map.decorations?.find(d => d.x === col && d.y === row)?.ground ?? 'grass' : cell
  const p = OUTDOOR_PALETTE
  const r = (x: number, y: number, w: number, h: number, color: number) => {
    g.fillStyle(color).fillRect(col * 32 + x * 2, row * 32 + y * 2, w * 2, h * 2)
  }
  const at = (dx: number, dy: number): Tile | undefined => {
    const neighbor = map.tiles[row + dy]?.[col + dx]
    return neighbor === 'furniture' ? map.decorations?.find(d => d.x === col + dx && d.y === row + dy)?.ground ?? 'grass' : neighbor
  }
  const variant = (col * 13 + row * 7) % 11
  const grass = () => {
    r(0, 0, 16, 16, p.grass)
    if (variant < 5) {
      r(3 + variant, 5, 1, 2, p.grassDark); r(4 + variant, 6, 2, 1, p.grassDark)
      r(11, 12, 2, 1, p.grassLight)
    }
  }
  grass()
  if (tile === 'path' || tile === 'exit') {
    r(0, 0, 16, 16, p.sand)
    const connects = (t?: Tile) => ['path', 'exit', 'door', 'dock'].includes(t ?? '')
    if (!connects(at(0, -1))) { r(0, 0, 16, 1, p.grassDark); r(0, 1, 16, 1, p.sandLight) }
    if (!connects(at(0, 1))) { r(0, 15, 16, 1, p.grassDark); r(0, 14, 16, 1, p.sandDark) }
    if (!connects(at(-1, 0))) { r(0, 0, 1, 16, p.grassDark); r(1, 1, 1, 14, p.sandLight) }
    if (!connects(at(1, 0))) { r(15, 0, 1, 16, p.grassDark); r(14, 1, 1, 14, p.sandDark) }
    if (variant < 4) { r(4 + variant, 6, 2, 1, p.sandDark); r(11, 11, 1, 1, p.sandLight) }
  } else if (tile === 'water') {
    r(0, 0, 16, 16, p.water)
    r(2 + variant % 3, 4, 5, 1, 0x70b5be); r(7 + variant % 3, 5, 2, 1, 0x70b5be)
    r(2, 12, 3, 1, p.waterDark); r(5, 13, 5, 1, p.waterDark)
    const land = (t?: Tile) => t !== undefined && t !== 'water' && t !== 'dock'
    if (land(at(0, -1))) { r(0, 0, 16, 2, p.grassDark); r(0, 2, 16, 2, p.sand); r(0, 4, 16, 1, p.foam) }
    if (land(at(0, 1))) { r(0, 14, 16, 2, p.sand); r(0, 13, 16, 1, p.foam) }
    if (land(at(-1, 0))) { r(0, 0, 2, 16, p.sand); r(2, 2, 1, 12, p.foam) }
    if (land(at(1, 0))) { r(14, 0, 2, 16, p.sand); r(13, 2, 1, 12, p.foam) }
  } else if (tile === 'wall') {
    // Rounded, stepped crown with a consistent upper-left light source.
    r(3, 12, 11, 3, p.grassDark); r(7, 11, 3, 5, 0x66543c); r(7, 12, 1, 3, 0xa38754)
    r(3, 3, 10, 10, 0x365f48); r(1, 5, 14, 5, 0x365f48); r(5, 1, 6, 13, 0x365f48)
    r(3, 4, 10, 7, 0x4c8751); r(2, 6, 12, 3, 0x4c8751)
    r(5, 2, 6, 9, 0x6aa658); r(4, 4, 8, 4, 0x6aa658)
    r(6, 2, 4, 2, 0xa6cf77); r(4, 5, 4, 2, 0x91c26c)
    r(3, 9, 3, 1, 0x91c26c); r(9, 8, 3, 2, 0x80b661)
    r(5, 11, 3, 1, 0x365f48); r(11, 5, 1, 2, 0x365f48)
  } else if (tile === 'roof') {
    const shop = col >= 18
    const dark = shop ? 0x395d65 : 0x834b45
    const mid = shop ? 0x567f86 : 0xbd7059
    const light = shop ? 0x87abb0 : 0xe49c75
    r(0, 0, 16, 16, mid)
    for (let y = 2; y < 16; y += 4) {
      r(0, y, 16, 1, light); r(0, y + 3, 16, 1, dark)
      r((y + col * 3) % 12, y, 1, 3, dark)
    }
    if (at(0, -1) !== 'roof') { r(0, 0, 16, 2, dark); r(1, 1, 14, 1, light) }
    if (at(-1, 0) !== 'roof') { r(0, 0, 2, 16, dark); r(2, 0, 1, 16, light) }
    if (at(1, 0) !== 'roof') r(14, 0, 2, 16, dark)
    if (at(0, 1) !== 'roof') { r(0, 13, 16, 3, dark); r(0, 13, 16, 1, light) }
  } else if (['houseWall', 'window', 'door'].includes(tile)) {
    r(0, 0, 16, 16, p.cream)
    for (let y = 3; y < 16; y += 4) r(0, y, 16, 1, 0xd3c598)
    const facade = (t?: Tile) => ['houseWall', 'window', 'door'].includes(t ?? '')
    if (at(0, -1) === 'roof') r(0, 0, 16, 4, 0xa6967a)
    if (!facade(at(-1, 0))) { r(0, 0, 2, 16, p.timber); r(2, 0, 1, 16, 0xffedc5) }
    if (!facade(at(1, 0))) r(14, 0, 2, 16, p.timber)
    if (!facade(at(0, 1))) { r(0, 13, 16, 3, 0x887e68); r(0, 13, 16, 1, 0xb9ae8a) }
    if (tile === 'window') {
      r(2, 2, 12, 11, p.timber); r(3, 3, 10, 8, 0x4b8094)
      r(4, 3, 8, 3, 0xa7d7db); r(4, 6, 3, 2, 0x72b4c3)
      r(7, 3, 1, 8, p.cream); r(3, 7, 10, 1, p.cream)
      r(1, 12, 14, 2, 0xffefc9)
    }
    if (tile === 'door') {
      r(3, 1, 10, 14, 0x514b40); r(4, 2, 8, 12, 0x987052)
      r(5, 3, 6, 5, 0x487789); r(5, 3, 6, 1, 0x9dced0)
      r(10, 10, 1, 1, 0xf5d080); r(2, 14, 12, 2, 0xd3c6a4)
    }
  } else if (tile === 'dock') {
    r(0, 0, 16, 16, 0x775b43)
    for (let y = 0; y < 16; y += 4) {
      r(0, y, 16, 3, 0xbe9768); r(0, y, 16, 1, 0xdbc08b)
      r((col * 3 + y) % 11, y + 2, 4, 1, 0xa17c55)
    }
    if (at(-1, 0) !== 'dock') { r(0, 0, 2, 16, 0x614e3e); r(0, 1, 3, 3, 0xe0c494) }
    if (at(1, 0) !== 'dock') { r(14, 0, 2, 16, 0x614e3e); r(13, 1, 3, 3, 0xe0c494) }
  } else if (tile === 'soil') {
    r(2, 3, 12, 11, 0x628d52); r(1, 4, 14, 8, 0x967450); r(3, 2, 10, 12, 0x967450)
    for (let y = 4; y < 13; y += 3) { r(3, y, 10, 1, 0x654f3c); r(4, y + 1, 8, 1, 0xb18d60) }
  } else if (tile === 'sign') {
    r(7, 8, 2, 7, p.timber); r(1, 2, 14, 9, 0x67553f)
    r(2, 3, 12, 6, 0xead6a0); r(4, 5, 8, 1, 0x89724f); r(4, 7, 5, 1, 0x89724f)
  } else if (tile === 'fence') {
    r(0, 7, 16, 2, 0x8b8567); r(0, 6, 16, 1, 0xf1e6c0); r(0, 11, 16, 2, 0x8b8567)
    for (const x of [2, 10]) { r(x, 3, 4, 12, 0x8b8567); r(x, 2, 3, 11, 0xe7dfb7); r(x, 3, 1, 9, 0xfff1cf) }
  } else if (tile === 'rock') {
    r(2, 12, 12, 3, p.grassDark); r(2, 6, 12, 7, 0x697c72); r(4, 3, 8, 11, 0x697c72)
    r(3, 6, 9, 5, 0x9ca995); r(5, 4, 6, 3, 0xc3c9aa); r(4, 7, 2, 3, 0xb7c1a3)
  } else if (tile === 'npc') {
    r(4, 13, 9, 2, p.grassDark); r(5, 8, 7, 6, 0x8f5970); r(6, 4, 5, 5, 0xe4b086)
    r(5, 2, 7, 3, 0x674831); r(5, 4, 2, 3, 0x674831); r(9, 5, 1, 1, p.ink)
    r(5, 14, 3, 1, p.ink); r(10, 14, 2, 1, p.ink)
  }
}

export type Decoration = { x: number; y: number; kind: 'flowers' | 'reeds' | 'bench' | 'barrel' | 'lamp' | 'shopSign' | 'chimney'; ground?: 'grass' | 'path' }

export function drawDecoration(g: Phaser.GameObjects.Graphics, d: Decoration) {
  const r = (x: number, y: number, w: number, h: number, c: number) => {
    g.fillStyle(c).fillRect(d.x * 32 + x * 2, d.y * 32 + y * 2, w * 2, h * 2)
  }
  if (d.kind === 'flowers') {
    for (const [x, y] of [[3, 4], [10, 3], [6, 10], [12, 11]]) {
      r(x, y + 2, 1, 3, 0x507d4d); r(x - 1, y, 3, 3, 0xf1cf9b)
      r(x, y + 1, 1, 1, 0xcb7974); r(x + 1, y + 3, 2, 1, 0x639858)
    }
  } else if (d.kind === 'reeds') {
    for (const [x, y] of [[3, 5], [6, 2], [10, 4], [13, 7]]) {
      r(x, y, 1, 14 - y, 0x547e52); r(x - 1, y, 2, 3, 0x98774c); r(x + 1, y + 5, 1, 3, 0xaac07b)
    }
  } else if (d.kind === 'bench') {
    r(2, 12, 2, 3, 0x555443); r(12, 12, 2, 3, 0x555443)
    r(1, 4, 14, 4, 0x9c7853); r(1, 4, 14, 1, 0xe3c18b)
    r(0, 10, 16, 3, 0xbb9768); r(0, 10, 16, 1, 0xe3c18b)
  } else if (d.kind === 'barrel') {
    r(4, 2, 8, 13, 0x75583f); r(3, 4, 10, 9, 0xa88559); r(5, 4, 1, 9, 0xd1af77)
    r(3, 5, 10, 2, 0x52615b); r(3, 11, 10, 2, 0x52615b); r(5, 2, 6, 1, 0xe4c790)
  } else if (d.kind === 'lamp') {
    r(7, 5, 2, 11, 0x4d655c); r(5, 14, 6, 2, 0x4d655c)
    r(4, 1, 8, 6, 0x4d655c); r(5, 2, 6, 4, 0xffe4a0); r(3, 0, 10, 1, 0x4d655c)
  } else if (d.kind === 'chimney') {
    r(4, 2, 7, 12, 0x796955); r(3, 1, 9, 3, 0xe0c49c); r(5, 1, 5, 1, 0x574e46)
    r(5, 5, 5, 2, 0xae8d6c); r(5, 9, 5, 2, 0xae8d6c)
  } else {
    r(0, 2, 16, 11, 0x456c70); r(1, 3, 14, 9, 0xe9d9aa)
    r(4, 6, 7, 4, 0x568995); r(6, 5, 3, 6, 0x568995); r(11, 5, 2, 6, 0x568995)
    r(5, 7, 1, 1, 0xf7edc9)
  }
}
