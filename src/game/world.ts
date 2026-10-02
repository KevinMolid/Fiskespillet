export { FISH, FISH_BY_ID, FISHING_ZONES, rollFish } from './fish'
export type { FishSpecies } from './fish'
import type { Decoration } from './outdoorTiles'

export type MapId = 'havn' | 'skogstjern' | 'hjem' | 'hjem2' | 'butikk'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Position = { mapId: MapId; x: number; y: number; facing: Direction }
export type Tile = 'grass' | 'path' | 'wall' | 'water' | 'dock' | 'exit' | 'sign' | 'door' | 'wardrobe' | 'npc' | 'floor' | 'furniture' | 'bed' | 'table' | 'rug' | 'window' | 'hearth' | 'houseWall' | 'roof' | 'stairs' | 'counter' | 'stove' | 'sofa' | 'soil' | 'chest' | 'shopCounter' | 'fence' | 'rock'

export function isWalkable(tile: Tile | undefined): boolean {
  return tile !== undefined && ['grass', 'path', 'dock', 'exit', 'door', 'floor', 'rug', 'stairs'].includes(tile)
}

export const WIDTH = 48
export const HEIGHT = 32
export const VIEW_WIDTH = 24
export const VIEW_HEIGHT = 16
export const TILE_SIZE = 32
export const START: Position = { mapId: 'havn', x: 12, y: 16, facing: 'down' }

export type WorldMap = {
  id: MapId
  name: string
  description: string
  tiles: Tile[][]
  neighbors: Partial<Record<Direction, MapId>>
  fishingZone?: string
  signs: Record<string, { title: string; text: string }>
  transitions?: Record<string, Position>
  npcs?: Record<string, { name: string; text: string }>
  decorations?: Decoration[]
}

function grid(fill: Tile = 'grass'): Tile[][] {
  return Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1 ? 'wall' : fill))
}

function rect(tiles: Tile[][], x1: number, y1: number, x2: number, y2: number, tile: Tile) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) tiles[y][x] = tile
}

const havn = grid()
rect(havn, 1, 22, 46, 30, 'water')
rect(havn, 22, 20, 26, 25, 'dock')
rect(havn, 5, 7, 13, 11, 'houseWall')
rect(havn, 5, 5, 13, 6, 'roof')
havn[9][6] = 'window'
havn[9][12] = 'window'
rect(havn, 7, 12, 10, 12, 'path')
rect(havn, 18, 7, 29, 9, 'houseWall')
rect(havn, 18, 5, 29, 6, 'roof')
havn[8][20] = 'window'
havn[8][27] = 'window'
havn[9][23] = 'door'
rect(havn, 22, 10, 24, 15, 'path')
rect(havn, 10, 15, 47, 17, 'path')
rect(havn, 23, 17, 25, 20, 'path')
havn[21][16] = 'sign'
havn[11][25] = 'sign'
havn[16][47] = 'exit'

const skogstjern = grid()
rect(skogstjern, 18, 5, 42, 19, 'water')
rect(skogstjern, 1, 15, 17, 17, 'path')
rect(skogstjern, 8, 17, 10, 25, 'path')
rect(skogstjern, 10, 23, 36, 25, 'path')
for (const [x, y] of [[4, 5], [5, 5], [6, 6], [3, 9], [5, 10], [12, 7], [13, 7], [11, 28], [39, 25], [40, 25], [41, 26], [43, 27]] as const) {
  skogstjern[y][x] = 'wall'
}
skogstjern[13][17] = 'sign'
skogstjern[16][0] = 'exit'

havn[11][8] = 'door'
havn[12][14] = 'grass'
havn[17][3] = 'soil'
havn[19][6] = 'soil'
havn[20][15] = 'soil'
skogstjern[20][5] = 'soil'
skogstjern[26][13] = 'soil'
skogstjern[23][44] = 'soil'

// Keep the existing entrances, fishing pier and saved interaction coordinates.
// Larger roof planes and connected lanes give the village readable landmarks.
rect(havn, 5, 5, 13, 8, 'roof')
rect(havn, 18, 4, 29, 6, 'roof')
rect(havn, 7, 13, 9, 16, 'path')
rect(havn, 10, 13, 14, 14, 'path')
rect(havn, 14, 15, 26, 18, 'path')
rect(havn, 14, 19, 26, 19, 'path')
rect(havn, 16, 20, 26, 20, 'path')
rect(havn, 22, 20, 26, 25, 'dock')
rect(havn, 3, 3, 15, 3, 'fence')
rect(havn, 3, 4, 3, 12, 'fence')
rect(havn, 4, 13, 6, 13, 'fence')
rect(havn, 11, 13, 13, 13, 'fence')
rect(havn, 32, 7, 42, 7, 'fence')
rect(havn, 34, 12, 41, 12, 'fence')
for (const [x, y] of [[1, 2], [2, 2], [16, 2], [17, 2], [31, 2], [33, 3], [36, 2], [39, 3], [43, 2], [45, 4], [44, 10], [45, 12], [2, 20], [9, 20], [31, 20], [38, 19], [44, 20]] as const) havn[y][x] = 'wall'
for (const [x, y] of [[4, 21], [11, 21], [34, 21], [42, 21]] as const) havn[y][x] = 'rock'

// A stepped shoreline and groves replace the rectangular pond silhouette.
rect(skogstjern, 18, 5, 21, 6, 'grass')
rect(skogstjern, 39, 5, 42, 7, 'grass')
rect(skogstjern, 41, 17, 42, 19, 'grass')
rect(skogstjern, 18, 18, 20, 19, 'grass')
rect(skogstjern, 24, 20, 35, 21, 'water')
rect(skogstjern, 14, 15, 19, 17, 'dock')
for (const [x, y] of [[3, 3], [4, 3], [7, 3], [10, 3], [13, 4], [15, 5], [3, 7], [7, 8], [10, 8], [14, 10], [3, 12], [6, 12], [44, 4], [45, 7], [45, 10], [44, 14], [44, 18], [4, 24], [5, 27], [8, 28], [16, 28], [20, 28], [24, 28], [29, 29], [34, 28], [38, 28]] as const) skogstjern[y][x] = 'wall'
for (const [x, y] of [[16, 6], [39, 6], [42, 18], [22, 22], [37, 21], [5, 22]] as const) skogstjern[y][x] = 'rock'

function grove(tiles: Tile[][], x: number, y: number, width: number, height: number) {
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    // Step back the corners to soften the grove silhouette.
    if ((dx === 0 || dx === width - 1) && (dy === 0 || dy === height - 1)) continue
    if (tiles[y + dy][x + dx] === 'grass') tiles[y + dy][x + dx] = 'wall'
  }
}
grove(havn, 33, 2, 10, 3)
grove(havn, 43, 7, 4, 6)
grove(skogstjern, 2, 2, 11, 3)
grove(skogstjern, 2, 7, 5, 6)
grove(skogstjern, 43, 3, 4, 9)
grove(skogstjern, 16, 27, 20, 4)

const harborDecorations: Decoration[] = [
  { x: 11, y: 5, kind: 'chimney' }, { x: 25, y: 8, kind: 'shopSign' },
  { x: 18, y: 19, kind: 'bench' }, { x: 20, y: 19, kind: 'lamp' },
  { x: 27, y: 20, kind: 'barrel' }, { x: 28, y: 20, kind: 'barrel' },
  { x: 30, y: 10, kind: 'barrel' }, { x: 17, y: 14, kind: 'lamp' },
]
for (const [x, y] of [[4, 12], [5, 12], [12, 12], [13, 12], [32, 9], [33, 9], [34, 9], [35, 9], [37, 10], [38, 10], [39, 10], [40, 10], [7, 18], [8, 18], [29, 18]] as const) harborDecorations.push({ x, y, kind: 'flowers' })
for (const x of [6, 13, 30, 36, 40]) harborDecorations.push({ x, y: 21, kind: 'reeds' })
const forestDecorations: Decoration[] = [
  { x: 11, y: 21, kind: 'bench' },
  ...([ [22, 6], [18, 8], [40, 7], [43, 15], [39, 19], [23, 20], [36, 21] ] as const).map(([x, y]) => ({ x, y, kind: 'reeds' as const })),
  ...([ [7, 10], [8, 11], [12, 27], [14, 27], [32, 26], [33, 26] ] as const).map(([x, y]) => ({ x, y, kind: 'flowers' as const })),
]
for (const [tiles, decorations] of [[havn, harborDecorations], [skogstjern, forestDecorations]] as const) {
  for (const d of decorations) if (['bench', 'barrel', 'lamp'].includes(d.kind)) {
    d.ground = tiles[d.y][d.x] === 'path' ? 'path' : 'grass'
    tiles[d.y][d.x] = 'furniture'
  }
}

function indoorGrid(): Tile[][] {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 24 }, (_, x): Tile =>
      x === 0 || y === 0 || x === 23 || y === 15 ? 'wall' : 'floor'))
}

const hjem = indoorGrid()
// Kjøkkenet ligger til venstre. Åpningen i deleveggen forbinder det med stuen.
rect(hjem, 11, 2, 11, 12, 'wall')
rect(hjem, 11, 8, 11, 9, 'floor')
rect(hjem, 3, 3, 8, 3, 'counter')
rect(hjem, 2, 5, 2, 7, 'counter')
hjem[3][8] = 'stove'
rect(hjem, 5, 10, 7, 11, 'table')
rect(hjem, 15, 10, 18, 10, 'sofa')
rect(hjem, 14, 7, 18, 9, 'rug')
hjem[3][20] = 'hearth'
hjem[0][5] = 'window'
hjem[0][17] = 'window'
hjem[4][19] = 'stairs'
hjem[15][12] = 'door'

const butikk = indoorGrid()
rect(butikk, 7, 5, 16, 5, 'counter')
butikk[5][12] = 'shopCounter'
butikk[4][12] = 'floor'
rect(butikk, 4, 4, 5, 7, 'furniture')
rect(butikk, 18, 4, 19, 7, 'furniture')
butikk[0][5] = 'window'
butikk[0][18] = 'window'
butikk[15][12] = 'door'

const hjem2 = indoorGrid()
rect(hjem2, 4, 4, 7, 6, 'bed')
rect(hjem2, 11, 7, 15, 9, 'rug')
rect(hjem2, 14, 3, 16, 3, 'table')
hjem2[9][3] = 'wardrobe'
hjem2[4][10] = 'furniture'
hjem2[4][20] = 'chest'
hjem2[0][5] = 'window'
hjem2[0][18] = 'window'
hjem2[11][19] = 'stairs'

export const MAPS: Record<MapId, WorldMap> = {
  havn: {
    id: 'havn',
    name: 'Bryggehavn',
    description: 'Følg stien mot øst for å finne skogstjernet.',
    tiles: havn,
    decorations: harborDecorations,
    neighbors: { right: 'skogstjern' },
    fishingZone: 'havn',
    transitions: { '8,11': { mapId: 'hjem', x: 12, y: 14, facing: 'up' }, '23,9': { mapId: 'butikk', x: 12, y: 14, facing: 'up' } },
    signs: {
      '16,21': { title: 'Bryggehavn', text: 'Kystfiske: prøv sluk etter makrell og sei, eller mark som agn etter torsk. Fiskeboken viser hvor og hvordan du finner artene.' },
      '25,11': { title: 'Mortens FiskShop.', text: 'Helt vanlig fiskeutstyr.' },
    },
  },
  hjem: {
    id: 'hjem', name: 'Hjemme · 1. etasje',
    description: 'Kjøkken og stue.',
    tiles: hjem, neighbors: {}, signs: {},
    transitions: {
      '12,15': { mapId: 'havn', x: 8, y: 12, facing: 'down' },
      '19,4': { mapId: 'hjem2', x: 19, y: 10, facing: 'up' },
    },
  },
  butikk: {
    id: 'butikk', name: 'Agnbutikken',
    description: 'Snakk med ekspeditøren over disken.',
    tiles: butikk, neighbors: {}, signs: {},
    transitions: { '12,15': { mapId: 'havn', x: 23, y: 10, facing: 'down' } },
  },
  hjem2: {
    id: 'hjem2', name: 'Hjemme · 2. etasje',
    description: 'Soverom med garderobe.',
    tiles: hjem2, neighbors: {}, signs: {},
    transitions: { '19,11': { mapId: 'hjem', x: 19, y: 5, facing: 'down' } },
  },
  skogstjern: {
    id: 'skogstjern',
    name: 'Skogstjernet',
    description: 'Vend deg mot vannet og trykk E eller Fisk for å kaste ut.',
    tiles: skogstjern,
    decorations: forestDecorations,
    fishingZone: 'skogstjern',
    signs: { '17,13': { title: 'Skogstjernet', text: 'Innsjøfiske: prøv mark etter abbor, ørret og røye. Brød og mais lokker mort.' } },
    neighbors: { left: 'havn' },
  },
}

export function facingTile(position: Position): Tile | undefined {
  const [dx, dy] = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  }[position.facing]
  return MAPS[position.mapId].tiles[position.y + dy]?.[position.x + dx]
}

export function signAhead(position: Position) {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[position.facing]
  return MAPS[position.mapId].signs[`${position.x + dx},${position.y + dy}`]
}

export function interactionAhead(position: Position) {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[position.facing]
  const map = MAPS[position.mapId]
  const x = position.x + dx, y = position.y + dy
  const key = `${x},${y}`
  return { tile: map.tiles[y]?.[x], npc: map.npcs?.[key], sign: map.signs[key] }
}

export const DIG_SPOTS: Record<string, { mapId: MapId; x: number; y: number }> = {
  havn_3_17: { mapId: 'havn', x: 3, y: 17 },
  havn_6_19: { mapId: 'havn', x: 6, y: 19 },
  havn_15_20: { mapId: 'havn', x: 15, y: 20 },
  skogstjern_5_20: { mapId: 'skogstjern', x: 5, y: 20 },
  skogstjern_13_26: { mapId: 'skogstjern', x: 13, y: 26 },
  skogstjern_44_23: { mapId: 'skogstjern', x: 44, y: 23 },
}

export function digSpotAhead(position: Position): string | null {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[position.facing]
  return Object.keys(DIG_SPOTS).find(id => {
    const spot = DIG_SPOTS[id]
    return spot.mapId === position.mapId && spot.x === position.x + dx && spot.y === position.y + dy
  }) ?? null
}

export function stepTransition(position: Position): Position | null {
  return MAPS[position.mapId].transitions?.[`${position.x},${position.y}`] ?? null
}

export function canFish(position: Position): boolean {
  return Boolean(MAPS[position.mapId].fishingZone && facingTile(position) === 'water')
}

export function edgeTransition(position: Position): Position | null {
  if (MAPS[position.mapId].tiles[position.y]?.[position.x] !== 'exit') return null
  const direction: Direction | null = position.x === 0 ? 'left'
    : position.x === WIDTH - 1 ? 'right'
      : position.y === 0 ? 'up'
        : position.y === HEIGHT - 1 ? 'down' : null
  if (!direction) return null
  const toMap = MAPS[position.mapId].neighbors[direction]
  if (!toMap) return null
  const x = direction === 'right' ? 0 : direction === 'left' ? WIDTH - 1 : position.x
  const y = direction === 'down' ? 0 : direction === 'up' ? HEIGHT - 1 : position.y
  if (MAPS[toMap].tiles[y][x] !== 'exit') return null
  return { mapId: toMap, x, y, facing: direction }
}

export function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<Position>
  return (p.mapId === 'havn' || p.mapId === 'skogstjern' || p.mapId === 'hjem' || p.mapId === 'hjem2' || p.mapId === 'butikk')
    && Number.isInteger(p.x) && Number.isInteger(p.y)
    && (p.x as number) >= 0 && (p.x as number) < MAPS[p.mapId].tiles[0].length
    && (p.y as number) >= 0 && (p.y as number) < MAPS[p.mapId].tiles.length
    && isWalkable(MAPS[p.mapId].tiles[p.y as number][p.x as number])
    && ['up', 'down', 'left', 'right'].includes(String(p.facing))
}

export const SHIRT_COLORS = [0x315d89, 0x4f8b58, 0x9b563f, 0x815a99, 0xb9943e] as const
export const HAIR_COLORS = [0x543925, 0x242d35, 0xb57d37, 0xd4b879, 0xa94735] as const
export const SKIN_COLORS = [0xf1bd8c, 0xc88f66, 0x885c45, 0x5a3a30] as const
export type Appearance = { shirt: number; hair: number; skin: number; outfit?: 'fisher' | 'casual' | 'sport'; hairstyle?: 'playerHair' | 'shortHair' | 'longHair' | 'bald' }
export const DEFAULT_APPEARANCE: Appearance = { shirt: 0, hair: 0, skin: 0 }
export function isAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false
  const look = value as Partial<Appearance>
  return Number.isInteger(look.shirt) && Number.isInteger(look.hair) && Number.isInteger(look.skin)
    && (look.shirt as number) >= 0 && (look.shirt as number) < SHIRT_COLORS.length
    && (look.hair as number) >= 0 && (look.hair as number) < HAIR_COLORS.length
    && (look.skin as number) >= 0 && (look.skin as number) < SKIN_COLORS.length
    && (look.outfit === undefined || ['fisher','casual','sport'].includes(look.outfit))
    && (look.hairstyle === undefined || ['playerHair','shortHair','longHair','bald'].includes(look.hairstyle))
}

export function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace('.', ',')} kg` : `${grams} g`
}
