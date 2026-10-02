import { DEFAULT_APPEARANCE, isAppearance, type Appearance } from './world'
import type { NpcId } from './npcs'
import { CHARACTER_STANDARD, type CharacterAppearance } from './characterStandard'
export { CHARACTER_DIRECTIONS, CHARACTER_GROUND_OFFSET_Y, CHARACTER_STANDARD } from './characterStandard'
export type { CharacterSprites, CharacterAppearance, CharacterPose } from './characterStandard'

export type StandardCharacter = { id: string; appearance: CharacterAppearance; format: typeof CHARACTER_STANDARD }
const adult: CharacterAppearance = {
  body: 'standardAdult', skinPalette: 'light', hair: 'shortHair', hairPalette: 'brown',
  top: 'tshirt', topPalette: 'green', bottom: 'jeans', bottomPalette: 'charcoal', shoes: 'boots', shoesPalette: 'brown',
}
export function playerCharacter(saved: Appearance = DEFAULT_APPEARANCE): StandardCharacter {
  const look = isAppearance(saved) ? saved : DEFAULT_APPEARANCE
  const outfit = look.outfit ?? 'fisher'
  return { id: 'player', format: CHARACTER_STANDARD, appearance: {
    ...adult, skinPalette: ['light','medium','dark','deepSkin'][look.skin],
    hair: look.hairstyle ?? 'playerHair', hairPalette: ['darkBrown','black','brown','blond','red'][look.hair],
    top: outfit === 'casual' ? 'tshirt' : outfit === 'sport' ? 'sport' : 'shirt',
    topPalette: ['blue','green','rust','purple','gold'][look.shirt],
    bottom: outfit === 'fisher' ? 'cargo' : 'jeans', bottomPalette: outfit === 'fisher' ? 'olive' : 'charcoal',
    shoes: outfit === 'fisher' ? 'boots' : 'sneakers', shoesPalette: outfit === 'fisher' ? 'brown' : 'white',
    ...(outfit === 'fisher' ? { outerwear: 'fishingVest', headwear: 'strawHat', accessories: ['fishingSatchel'] as const } : {}),
  } }
}
export const PLAYER_CHARACTER = playerCharacter()
function npc(id: NpcId, appearance: Partial<CharacterAppearance>): StandardCharacter {
  return { id, appearance: { ...adult, ...appearance }, format: CHARACTER_STANDARD }
}
export const NPC_CHARACTERS: Record<NpcId,StandardCharacter> = {
  kevin: npc('kevin',{ hairPalette:'darkBlond', faceDetails:['glasses','stubble'], shoes:'sneakers', shoesPalette:'white' }),
  mor: npc('mor',{ hair:'longHair', hairPalette:'blond', top:'shirt', topPalette:'rose', faceDetails:['glasses'] }),
  far: npc('far',{ hairPalette:'grey', top:'shirt', topPalette:'olive' }),
  oda: npc('oda',{ hair:'longHair', hairPalette:'black', top:'shirt', topPalette:'purple' }),
  magnus: npc('magnus',{ body:'stockyAdult', hair:'bald', hairPalette:'darkBrown', top:'hawaiian', topPalette:'rust', faceDetails:['beard'] }),
  bendik: npc('bendik',{ body:'tallAdult', hairPalette:'darkBlond', faceDetails:['glasses','beard'] }),
  nils: npc('nils',{ hairPalette:'blond', top:'sport', topPalette:'blue', shoes:'sneakers', shoesPalette:'white' }),
  morten: npc('morten',{ hairPalette:'darkBrown', top:'shirt' }),
}
export const KEVIN_CHARACTER = NPC_CHARACTERS.kevin
export const STANDARD_CHARACTERS = [PLAYER_CHARACTER,...Object.values(NPC_CHARACTERS)]
