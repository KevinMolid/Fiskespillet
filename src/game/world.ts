export type MapId = 'havn' | 'skogstjern' | 'hjem'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Position = { mapId: MapId; x: number; y: number; facing: Direction }
export type Tile = 'grass' | 'path' | 'wall' | 'water' | 'dock' | 'exit' | 'sign' | 'door' | 'wardrobe' | 'npc' | 'floor' | 'furniture'

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
  doors?: Record<string, Position>
  npcs?: Record<string, { name: string; text: string }>
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
rect(havn, 5, 5, 13, 11, 'wall')
rect(havn, 7, 11, 10, 11, 'path')
rect(havn, 18, 5, 29, 9, 'wall')
rect(havn, 10, 15, 47, 17, 'path')
rect(havn, 23, 17, 25, 20, 'path')
havn[21][16] = 'sign'
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
havn[12][14] = 'npc'

const hjem = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 24 }, (_, x): Tile =>
    x === 0 || y === 0 || x === 23 || y === 15 ? 'wall' : 'floor'))
rect(hjem, 4, 3, 7, 4, 'furniture')
rect(hjem, 16, 3, 19, 4, 'furniture')
hjem[5][8] = 'wardrobe'
hjem[14][12] = 'door'

export const MAPS: Record<MapId, WorldMap> = {
  havn: {
    id: 'havn',
    name: 'Bryggehavn',
    description: 'Følg stien mot øst for å finne skogstjernet.',
    tiles: havn,
    neighbors: { right: 'skogstjern' },
    fishingZone: 'havn',
    doors: { '8,11': { mapId: 'hjem', x: 12, y: 13, facing: 'up' } },
    npcs: { '14,12': { name: 'Mira', text: 'Velkommen hjem! Garderoben står inne i huset. Vend deg mot døren og trykk E eller mellomrom.' } },
    signs: { '16,21': { title: 'Bryggehavn', text: 'Her finnes mort og abbor. En sjelden gang biter gjedda på.' } },
  },
  hjem: {
    id: 'hjem', name: 'Hjemme hos deg',
    description: 'Garderoben står langs nordveggen.',
    tiles: hjem, neighbors: {}, signs: {},
    doors: { '12,14': { mapId: 'havn', x: 8, y: 12, facing: 'down' } },
  },
  skogstjern: {
    id: 'skogstjern',
    name: 'Skogstjernet',
    description: 'Vend deg mot vannet og trykk E eller Fisk for å kaste ut.',
    tiles: skogstjern,
    fishingZone: 'skogstjern',
    signs: { '17,13': { title: 'Skogstjernet', text: 'Mort, abbor og gjedde lever her. Noen forteller om den sjeldne gullørreten.' } },
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
  return { tile: map.tiles[y]?.[x], door: map.doors?.[key], npc: map.npcs?.[key], sign: map.signs[key] }
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
  return (p.mapId === 'havn' || p.mapId === 'skogstjern' || p.mapId === 'hjem')
    && Number.isInteger(p.x) && Number.isInteger(p.y)
    && (p.x as number) >= 0 && (p.x as number) < MAPS[p.mapId].tiles[0].length
    && (p.y as number) >= 0 && (p.y as number) < MAPS[p.mapId].tiles.length
    && MAPS[p.mapId].tiles[p.y as number][p.x as number] !== 'wall'
    && MAPS[p.mapId].tiles[p.y as number][p.x as number] !== 'water'
    && !['sign', 'door', 'wardrobe', 'npc', 'furniture'].includes(MAPS[p.mapId].tiles[p.y as number][p.x as number])
    && ['up', 'down', 'left', 'right'].includes(String(p.facing))
}

export const SHIRT_COLORS = [0x315d89, 0x4f8b58, 0x9b563f, 0x815a99, 0xb9943e] as const
export const HAIR_COLORS = [0x543925, 0x242d35, 0xb57d37, 0xd4b879, 0xa94735] as const
export const SKIN_COLORS = [0xf1bd8c, 0xc88f66, 0x885c45, 0x5a3a30] as const
export type Appearance = { shirt: number; hair: number; skin: number }
export const DEFAULT_APPEARANCE: Appearance = { shirt: 0, hair: 0, skin: 0 }
export function isAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false
  const look = value as Partial<Appearance>
  return Number.isInteger(look.shirt) && Number.isInteger(look.hair) && Number.isInteger(look.skin)
    && (look.shirt as number) >= 0 && (look.shirt as number) < SHIRT_COLORS.length
    && (look.hair as number) >= 0 && (look.hair as number) < HAIR_COLORS.length
    && (look.skin as number) >= 0 && (look.skin as number) < SKIN_COLORS.length
}

export type FishSpecies = {
  id: string
  name: string
  icon: string
  description: string
  minGrams: number
  maxGrams: number
}

export const FISH: FishSpecies[] = [
  { id: 'mort', name: 'Mort', icon: '🐟', description: 'En liten, sølvblank stimfisk som trives ved bredden.', minGrams: 80, maxGrams: 650 },
  { id: 'abbor', name: 'Abbor', icon: '🐠', description: 'Stripete jeger med piggete ryggfinne.', minGrams: 150, maxGrams: 2200 },
  { id: 'gjedde', name: 'Gjedde', icon: '🐟', description: 'En rask rovfisk som skjuler seg i sivet.', minGrams: 700, maxGrams: 8500 },
  { id: 'gullorret', name: 'Gullørret', icon: '✨', description: 'En sjelden fisk som glimter i det mørke vannet.', minGrams: 300, maxGrams: 2800 },
]

export const FISH_BY_ID = Object.fromEntries(FISH.map(fish => [fish.id, fish])) as Record<string, FishSpecies>

export const FISHING_ZONES: Record<string, { name: string; catches: { speciesId: string; weight: number }[] }> = {
  havn: {
    name: 'Bryggehavn',
    catches: [
      { speciesId: 'mort', weight: 60 },
      { speciesId: 'abbor', weight: 35 },
      { speciesId: 'gjedde', weight: 5 },
    ],
  },
  skogstjern: {
    name: 'Skogstjernet',
    catches: [
      { speciesId: 'mort', weight: 45 },
      { speciesId: 'abbor', weight: 40 },
      { speciesId: 'gjedde', weight: 12 },
      { speciesId: 'gullorret', weight: 3 },
    ],
  },
}

export function rollFish(zoneId: string) {
  const zone = FISHING_ZONES[zoneId]
  if (!zone) throw new Error('Ukjent fiskeområde.')
  const total = zone.catches.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = Math.random() * total
  const entry = zone.catches.find(entry => (roll -= entry.weight) < 0) ?? zone.catches.at(-1)!
  const species = FISH_BY_ID[entry.speciesId]
  const grams = Math.round(species.minGrams + Math.random() * (species.maxGrams - species.minGrams))
  return { species, grams, caught: Math.random() >= 0.18 }
}

export function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace('.', ',')} kg` : `${grams} g`
}
