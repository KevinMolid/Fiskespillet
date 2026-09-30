import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const bundle = await build({ entryPoints: ['src/game/outdoorTiles.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { drawOutdoorTile, drawDecoration } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const types = ['grass', 'path', 'water', 'wall', 'roof', 'houseWall', 'window', 'door', 'dock', 'soil', 'sign', 'fence', 'rock', 'npc']
const props = ['flowers', 'reeds', 'bench', 'barrel', 'lamp', 'shopSign', 'chimney']
let color = '#000000'
let shapes = ''
const g = {
  fillStyle(c) { color = `#${c.toString(16).padStart(6, '0')}`; return this },
  fillRect(x, y, w, h) { shapes += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`; return this },
}
const tiles = [types]
const map = { tiles }
types.forEach((_, x) => drawOutdoorTile(g, map, x, 0))
props.forEach((kind, x) => drawDecoration(g, { kind, x, y: 1 }))
await mkdir('docs/art', { recursive: true })
await writeFile('docs/art/fiskespillet-tiles.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="448" height="64" viewBox="0 0 448 64" shape-rendering="crispEdges"><title>Fiskespillet – original outdoor tile palette</title>${shapes}</svg>`)
console.log('Exported docs/art/fiskespillet-tiles.svg from the game renderer.')
