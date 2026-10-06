import pixelPlayerStandard from './pixel-player-standard.json'
import playerCastAimStandard from './player-cast-aim-standard.json'
import playerCastForwardStandard from './player-cast-forward-standard.json'
import playerDown from '../assets/characters/player/down.png'
import playerUp from '../assets/characters/player/up.png'
import playerLeft from '../assets/characters/player/left.png'
import playerRight from '../assets/characters/player/right.png'
import npcStandard from './pixel-npc-standard.json'
import type { NpcId } from './npcs'
import type { Direction } from './world'

export type CharacterSprites = { down: string; up: string; left: string; right: string }
export type CharacterPose = 'castAim' | 'castForward'
// Formats carry shared canvas/anchor/scale rules, never per-direction offsets.
export type CharacterFormat = {
  canvas: { width: number; height: number }
  groundAnchor: { x: number; y: number }
  renderScale: number
  filter: 'nearest' | 'linear'
}
export type StandardCharacter = {
  id: string
  sprites: CharacterSprites
  walk?: Record<Direction, readonly [string, string]>
  poses?: Partial<Record<CharacterPose, { sprites: CharacterSprites; format: CharacterFormat; rodTip?: Record<Direction, { x: number; y: number }> }>>
  format: CharacterFormat
}
// Existing tile-center to ground-line conversion; shared by every character.
export const CHARACTER_GROUND_OFFSET_Y = 14
export const PIXEL_PLAYER_STANDARD = pixelPlayerStandard
export const CHARACTER_DIRECTIONS: readonly Direction[] = ['down', 'up', 'left', 'right']
// Eager URL imports keep Vite's hashed production asset handling.
const idleAssets = import.meta.glob<string>('../assets/characters/*/{down,up,left,right}.png', { eager: true, query: '?url', import: 'default' })
const walkAssets = import.meta.glob<string>('../assets/characters/*/*-walk-*.png', { eager: true, query: '?url', import: 'default' })
const castAimAssets = import.meta.glob<string>('../assets/characters/player/*-cast-aim.png', { eager: true, query: '?url', import: 'default' })
const castForwardAssets = import.meta.glob<string>('../assets/characters/player/*-cast-forward.png', { eager: true, query: '?url', import: 'default' })

function castAimSprite(direction: Direction) {
  const url = castAimAssets[`../assets/characters/player/${direction}-cast-aim.png`]
  if (!url) throw new Error(`Missing player casting pose: ${direction}`)
  return url
}

function castForwardSprite(direction: Direction) {
  const url = castForwardAssets[`../assets/characters/player/${direction}-cast-forward.png`]
  if (!url) throw new Error(`Missing player forward cast: ${direction}`)
  return url
}

function asset(character: string, file: string, walking = false) {
  const url = (walking ? walkAssets : idleAssets)[`../assets/characters/${character}/${file}.png`]
  if (!url) throw new Error(`Missing character asset: ${character}/${file}`)
  return url
}

function directionalWalk(id: string): NonNullable<StandardCharacter['walk']> {
  const frames = (direction: Direction): readonly [string, string] =>
    [asset(id, `${direction}-walk-1`, true), asset(id, `${direction}-walk-2`, true)]
  return { down: frames('down'), up: frames('up'), left: frames('left'), right: frames('right') }
}

export const PLAYER_CHARACTER: StandardCharacter = {
  id: 'player', sprites: { down: playerDown, up: playerUp, left: playerLeft, right: playerRight },
  format: { ...pixelPlayerStandard, filter: 'nearest' },
  walk: directionalWalk('player'),
  poses: { castAim: {
    sprites: { down: castAimSprite('down'), up: castAimSprite('up'), left: castAimSprite('left'), right: castAimSprite('right') },
    // Extra transparent canvas contains the rod. Body scale stays shared with idle.
    format: { ...pixelPlayerStandard, ...playerCastAimStandard, filter: 'nearest' },
  }, castForward: {
    sprites: { down: castForwardSprite('down'), up: castForwardSprite('up'), left: castForwardSprite('left'), right: castForwardSprite('right') },
    format: { ...pixelPlayerStandard, canvas: playerCastForwardStandard.canvas, groundAnchor: playerCastForwardStandard.groundAnchor, filter: 'nearest' },
    rodTip: playerCastForwardStandard.rodTip,
  } },
}

function npcCharacter(id: NpcId): StandardCharacter {
  return {
    id,
    sprites: Object.fromEntries(CHARACTER_DIRECTIONS.map(direction => [direction, asset(id, direction)])) as CharacterSprites,
    walk: directionalWalk(id),
    format: { ...npcStandard, filter: 'nearest' },
  }
}
export const NPC_CHARACTERS: Record<NpcId, StandardCharacter> = {
  mor: npcCharacter('mor'), far: npcCharacter('far'), kevin: npcCharacter('kevin'),
  oda: npcCharacter('oda'), magnus: npcCharacter('magnus'), bendik: npcCharacter('bendik'),
  nils: npcCharacter('nils'), morten: npcCharacter('morten'),
}
export const KEVIN_CHARACTER = NPC_CHARACTERS.kevin
export const STANDARD_CHARACTERS = [PLAYER_CHARACTER, ...Object.values(NPC_CHARACTERS)]
export function characterTextureKey(character: StandardCharacter, direction: Direction, step = 0, pose?: CharacterPose) {
  return `${character.id}-${direction}${pose === 'castAim' ? '-cast-aim' : pose === 'castForward' ? '-cast-forward' : step ? `-walk-${step}` : ''}`
}
