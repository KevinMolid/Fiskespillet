import { HAIR_COLORS, SHIRT_COLORS, SKIN_COLORS, type Appearance, type Direction } from './world'

// Palette-based 18 × 22 portraits for the menu and wardrobe SVG previews.
// World characters use the PNG registry in characters.ts instead.
const FRONT = [
  '      ######      ',
  '     #hhhhhh#     ',
  '    #hHHHHHHh#    ',
  '    #hHHHHHHH#    ',
  '    #cccccccC#    ',
  '  ##hhhhhhhhhh##  ',
  ' #HHHHHHHHHHHHHH# ',
  '  ###rrrrrrrr###  ',
  '    #rsSssSsr#    ',
  '    #ss#ss#ss#    ',
  '     #ssssss#     ',
  '    ##SssssS##    ',
  '   #ccvsssvcc#    ',
  '   #cVvcccvVc#    ',
  '   #sVhv#vhVs#    ',
  '   #sVvv#vvVs#    ',
  '    #Vhv#vhV#T#   ',
  '    #VVV#VVV#t#   ',
  '     #ll#ll#Tt#   ',
  '     #bb#bb###    ',
  '    #bbb#bbb#     ',
  '    #########     ',
]
const BACK = [
  '      ######      ',
  '     #hhhhhh#     ',
  '    #hHHHHHHh#    ',
  '    #hHHHHHHH#    ',
  '    #cccccccC#    ',
  '  ##hhhhhhhhhh##  ',
  ' #HHHHHHHHHHHHHH# ',
  '  ###rrrrrrrr###  ',
  '    #rrrrrrrr#    ',
  '    #rrrrrrrr#    ',
  '     #rrSSrr#     ',
  '    ##VSSSV##     ',
  '   #ccVVVVVcc#    ',
  '   #cVvTTTvvC#    ',
  '   #sVvttTvvS#    ',
  '   #sVTTTTvvS#    ',
  '    #TtttTVV#T#   ',
  '    #TTTTTVV#t#   ',
  '     #ll#ll#Tt#   ',
  '     #bb#bb###    ',
  '    #bbb#bbb#     ',
  '    #########     ',
]
const SIDE = [
  '     ######       ',
  '    #hhhhhh#      ',
  '   #hHHHHHHh#     ',
  '   #hHHHHHHH#     ',
  '   #cccccccC##    ',
  '   #hhhhhhhhhh##  ',
  '   #HHHHHHHHHHHH# ',
  '    #rrrrsss###   ',
  '    #rrrrssss#    ',
  '    #rrSss#ss#    ',
  '     #rSsssssS#   ',
  '     #VVsssss#    ',
  '    #TVVccV##     ',
  '    #TVVccCV#     ',
  '    #TtVccCv#     ',
  '    #TtVssSv#     ',
  '    #TTTssSV#     ',
  '     #ttVVVV#     ',
  '     #TTllll#     ',
  '      #bb#bb#     ',
  '      #bbb#bbb#   ',
  '      #########   ',
]

function tint(color: number, amount: number) {
  const channel = (shift: number) => Math.max(0, Math.min(255, ((color >> shift) & 255) + amount))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

export type SpritePixel = { x: number; y: number; color: number }
export function fisherPixels(appearance: Appearance, direction: Direction = 'down', stride = 0): SpritePixel[] {
  const shirt = SHIRT_COLORS[appearance.shirt]
  const skin = SKIN_COLORS[appearance.skin]
  const palette: Record<string, number> = {
    '#': 0x293e3e, h: 0xf4dfab, H: 0xc7ad77,
    c: shirt, C: tint(shirt, -28), r: HAIR_COLORS[appearance.hair],
    s: skin, S: tint(skin, -28), v: 0xc2b07a, V: 0x8a8059,
    l: 0x51666a, b: 0x344c52, T: 0x765a40, t: 0xb28b56,
  }
  const pattern = direction === 'up' ? BACK : direction === 'down' ? FRONT : SIDE
  const pixels: SpritePixel[] = []
  pattern.forEach((line, y) => [...line].forEach((symbol, x) => {
    if (symbol === ' ') return
    const dx = direction === 'left' ? 17 - x : x
    // Alternating boots and a one-pixel body bob make each step readable.
    const step = stride === 0 ? 0 : y >= 18 ? ((x < 9) === (stride === 1) ? -1 : 0) : -1
    pixels.push({ x: dx, y: y + step, color: palette[symbol] })
  }))
  return pixels
}
