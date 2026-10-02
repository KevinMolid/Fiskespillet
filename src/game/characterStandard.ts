import type { Direction } from './world'

export const CHARACTER_STANDARD = {
  version: 1,
  canvas: { width: 48, height: 48 },
  groundAnchor: { x: 24, y: 42 },
  renderScale: 1,
  filter: 'nearest',
  guides: { head: 6, eyes: 14, nose: 16, mouth: 18, chin: 20, shoulders: 22, elbows: 28, hands: 31, hip: 32, knees: 37, shoes: 40, sole: 42 },
} as const
export const CHARACTER_DIRECTIONS: readonly Direction[] = ['down', 'right', 'up', 'left']
export const CHARACTER_GROUND_OFFSET_Y = 14 // Existing tile-center → world ground convention.
export const CHARACTER_STATES = ['idle', 'walk', 'fishCast', 'fishWait', 'fishHook', 'fishFight', 'dig', 'interact'] as const
export type CharacterState = typeof CHARACTER_STATES[number]
export const CHARACTER_FRAME_COUNTS: Partial<Record<CharacterState, number>> = { idle: 1 }
export const FUTURE_WALK_FRAME_COUNT = 4
export const CHARACTER_LAYER_ORDER = ['body', 'hairBack', 'bottom', 'shoes', 'top', 'outerwear', 'hairFront', 'faceDetails', 'headwear', 'accessories'] as const
export type CharacterLayer = typeof CHARACTER_LAYER_ORDER[number]
export type BodyStyle = 'standardAdult' | 'stockyAdult' | 'tallAdult'
export type HairStyle = 'playerHair' | 'shortHair' | 'longHair' | 'bald'
export type Outfit = 'fisher' | 'casual' | 'sport'
export type CharacterAppearance = {
  body: BodyStyle; skinPalette: string; hair?: HairStyle; hairPalette: string;
  top: 'shirt' | 'tshirt' | 'sport' | 'hawaiian'; topPalette: string;
  bottom: 'cargo' | 'jeans'; bottomPalette: string;
  shoes: 'boots' | 'sneakers'; shoesPalette: string;
  outerwear?: 'fishingVest'; headwear?: 'strawHat'; accessories?: readonly ['fishingSatchel'];
  faceDetails?: readonly ('glasses' | 'stubble' | 'beard')[];
}
export type CharacterSprites = Record<Direction, Uint8ClampedArray<ArrayBuffer>>
export type CharacterPose = { direction: Direction; state: CharacterState; frame: number }

// Sheets use direction rows and animation columns. Only idle artwork exists today.
export function characterFrame(pose: CharacterPose) {
  const state = CHARACTER_FRAME_COUNTS[pose.state] ? pose.state : 'idle'
  const count = CHARACTER_FRAME_COUNTS[state]!
  const frame = Math.max(0, Math.min(count - 1, Math.floor(pose.frame)))
  return { state, frame, x: frame * 48, y: CHARACTER_DIRECTIONS.indexOf(pose.direction) * 48, width: 48, height: 48 }
}
