export type MapId = 'havn' | 'skogstjern'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Position = { mapId: MapId; x: number; y: number; facing: Direction }
export type Tile = 'grass' | 'path' | 'wall' | 'water' | 'dock' | 'exit' | 'sign'

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

export const MAPS: Record<MapId, WorldMap> = {
  havn: {
    id: 'havn',
    name: 'Bryggehavn',
    description: 'Følg stien mot øst for å finne skogstjernet.',
    tiles: havn,
    neighbors: { right: 'skogstjern' },
    fishingZone: 'havn',
    signs: { '16,21': { title: 'Bryggehavn', text: 'Her finnes mort og abbor. En sjelden gang biter gjedda på.' } },
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
  return (p.mapId === 'havn' || p.mapId === 'skogstjern')
    && Number.isInteger(p.x) && Number.isInteger(p.y)
    && (p.x as number) >= 0 && (p.x as number) < WIDTH
    && (p.y as number) >= 0 && (p.y as number) < HEIGHT
    && MAPS[p.mapId].tiles[p.y as number][p.x as number] !== 'wall'
    && MAPS[p.mapId].tiles[p.y as number][p.x as number] !== 'water'
    && MAPS[p.mapId].tiles[p.y as number][p.x as number] !== 'sign'
    && ['up', 'down', 'left', 'right'].includes(String(p.facing))
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
