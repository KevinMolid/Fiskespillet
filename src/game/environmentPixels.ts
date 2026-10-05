import type Phaser from 'phaser'

// Native world pixels. Small, intentional clusters; no scaled 16px art, gradients or AA.
export const ENVIRONMENT_PALETTE = {
  grass: 0x77975b, grassLight: 0x9ab471, grassDark: 0x607c48, grassDeep: 0x466344,
  sand: 0xd1be91, sandLight: 0xe4d4ab, sandDark: 0xb29d74, sandDeep: 0x897c60,
  water: 0x397f95, waterDark: 0x306c83, waterLight: 0x589bab, foam: 0xa3c8c5,
  ink: 0x334642, timber: 0x926443, timberLight: 0xc99b65, timberDark: 0x604632,
  cream: 0xe4d5b0, creamLight: 0xf3e7c9, creamDark: 0xb6a580,
  leafDeep: 0x304e40, leafDark: 0x426849, leaf: 0x5a8250, leafLight: 0x7f9e5e, leafSun: 0xa7b973,
  stone: 0x818d83, stoneLight: 0xacb4a1, stoneDark: 0x5b6b65,
  metal: 0x526565, metalLight: 0x879b94, metalDark: 0x344848,
  glass: 0x497d8b, glassLight: 0xa1c5c7, fabric: 0x476f70, fabricLight: 0x779794,
} as const

export function pixelPainter(g: Phaser.GameObjects.Graphics, left: number, top: number) {
  return (x: number, y: number, width: number, height: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha).fillRect(left + x, top + y, width, height)
  }
}
export type PixelPainter = ReturnType<typeof pixelPainter>

// Stable variation: repainting a map never changes its artwork.
export function environmentVariant(x: number, y: number, salt = 0) {
  return ((Math.imul(x + 97, 73856093) ^ Math.imul(y + 53, 19349663) ^ salt) >>> 0) % 16
}

export function woodGrain(r: PixelPainter, x: number, y: number, width: number, height: number, seed = 0) {
  const p = ENVIRONMENT_PALETTE
  r(x, y, width, height, p.timber)
  r(x, y, width, 1, p.timberLight)
  r(x, y + height - 1, width, 1, p.timberDark)
  if (width > 7 && height > 3) {
    const start = x + 2 + seed % Math.max(1, width - 7)
    r(start, y + 2, 4, 1, p.timberDark)
    r(start + 1, y + 3, 3, 1, p.timberLight)
  }
}
