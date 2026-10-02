import { appearanceModules } from './characterArt'
import { characterPalette } from './characterPalettes'
import { CHARACTER_DIRECTIONS, characterFrame, type CharacterAppearance, type CharacterSprites, type CharacterState } from './characterStandard'
import type { Direction } from './world'

export function appearanceKey(appearance: CharacterAppearance) {
  // Canonical property ordering means equivalent definitions share the same cache.
  return JSON.stringify([appearance.body,appearance.skinPalette,appearance.hair ?? 'bald',appearance.hairPalette,
    appearance.top,appearance.topPalette,appearance.bottom,appearance.bottomPalette,appearance.shoes,appearance.shoesPalette,
    appearance.outerwear ?? '',appearance.headwear ?? '',[...(appearance.faceDetails ?? [])].sort(),[...(appearance.accessories ?? [])].sort()])
}
export function composeCharacter(appearance: CharacterAppearance, direction: Direction, state: CharacterState='idle', frame=0) {
  const rgba = new Uint8ClampedArray(48*48*4)
  const pose=characterFrame({direction,state,frame})
  for (const module of appearanceModules(appearance,direction,pose.state,pose.frame)) {
    const basePalette = characterPalette(module.palette)
    const palette = module.id.endsWith('/strawHat') ? [...basePalette.slice(0,6),characterPalette(appearance.topPalette)[3],basePalette[7]] : basePalette
    for (let pixel=0;pixel<module.pixels.length;pixel++) {
      const slot = module.pixels[pixel]
      if (!slot) continue
      if (slot >= palette.length) throw new Error(`${module.id}: invalid palette slot ${slot}`)
      const color = palette[slot], offset = pixel*4
      rgba[offset]=(color>>16)&255; rgba[offset+1]=(color>>8)&255; rgba[offset+2]=color&255; rgba[offset+3]=255
    }
  }
  return rgba
}
const cache = new Map<string, CharacterSprites>()
export const CHARACTER_COMPOSITE_CACHE_LIMIT = 32
export function composedCharacter(appearance: CharacterAppearance, state: CharacterState='idle', frame=0): CharacterSprites {
  const pose=characterFrame({direction:'down',state,frame})
  const key = appearanceKey(appearance)+`/${pose.state}/${pose.frame}`
  const existing = cache.get(key)
  if (existing) { cache.delete(key); cache.set(key,existing); return existing }
  const sprites = Object.fromEntries(CHARACTER_DIRECTIONS.map(d => [d,composeCharacter(appearance,d,pose.state,pose.frame)])) as CharacterSprites
  cache.set(key,sprites)
  while (cache.size > CHARACTER_COMPOSITE_CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return sprites
}
export function characterCompositeCacheSize() { return cache.size }
