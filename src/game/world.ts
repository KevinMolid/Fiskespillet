export type MapId = 'havn' | 'skogstjern'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Position = { mapId: MapId; x: number; y: number; facing: Direction }
export type Tile = 'grass' | 'path' | 'wall' | 'water' | 'dock' | 'exit'

export const WIDTH = 24
export const HEIGHT = 16
export const TILE_SIZE = 32
export const START: Position = { mapId: 'havn', x: 11, y: 6, facing: 'down' }

export type WorldMap = {
  id: MapId
  name: string
  description: string
  tiles: Tile[][]
  neighbors: Partial<Record<Direction, MapId>>
  fishingZone?: string
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
rect(havn, 1, 11, 22, 14, 'water')
rect(havn, 10, 9, 13, 12, 'dock')
rect(havn, 3, 2, 8, 5, 'wall')
rect(havn, 5, 5, 6, 5, 'path')
rect(havn, 9, 5, 21, 7, 'path')
rect(havn, 11, 7, 12, 9, 'path')
rect(havn, 16, 2, 20, 3, 'wall')
havn[6][23] = 'exit'

const skogstjern = grid()
rect(skogstjern, 8, 2, 21, 8, 'water')
rect(skogstjern, 2, 11, 15, 13, 'path')
rect(skogstjern, 13, 9, 15, 11, 'path')
rect(skogstjern, 1, 6, 7, 6, 'path')
skogstjern[6][0] = 'exit'
for (const [x, y] of [[3, 3], [4, 3], [5, 4], [2, 7], [4, 8], [19, 11], [20, 11], [21, 12], [17, 13], [5, 13], [6, 2], [7, 4]] as const) {
  skogstjern[y][x] = 'wall'
}

export const MAPS: Record<MapId, WorldMap> = {
  havn: {
    id: 'havn',
    name: 'Bryggehavn',
    description: 'Følg stien mot øst for å finne skogstjernet.',
    tiles: havn,
    neighbors: { right: 'skogstjern' },
    fishingZone: 'havn',
  },
  skogstjern: {
    id: 'skogstjern',
    name: 'Skogstjernet',
    description: 'Vend deg mot vannet og trykk E eller Fisk for å kaste ut.',
    tiles: skogstjern,
    fishingZone: 'skogstjern',
    neighbors: { left: 'havn' },
  },
}

export function facingTile(position: Position): Tile | undefined {
  const [dx, dy] = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  }[position.facing]
  return MAPS[position.mapId].tiles[position.y + dy]?.[position.x + dx]
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
