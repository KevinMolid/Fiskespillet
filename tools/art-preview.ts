import Phaser from 'phaser'
import { createWorld } from '../src/game/WorldScene'
import { drawDecoration, drawOutdoorTile } from '../src/game/outdoorTiles'
import { MAPS, DEFAULT_APPEARANCE, START, type Direction, type MapId } from '../src/game/world'

let overview: Phaser.Game | undefined
let playable: ReturnType<typeof createWorld> | undefined
const status = (message: string) => { document.querySelector('#status')!.textContent = message }
function show(mapId: 'havn' | 'skogstjern') {
  overview?.destroy(true)
  playable?.game.destroy(true)
  class Overview extends Phaser.Scene {
    create() {
      const g = this.add.graphics()
      const map = MAPS[mapId]
      for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) drawOutdoorTile(g, map, x, y)
      for (const d of map.decorations ?? []) drawDecoration(g, d)
    }
  }
  overview = new Phaser.Game({ type: Phaser.CANVAS, parent: 'overview', width: 1536, height: 1024, pixelArt: true, scene: Overview, scale: { mode: Phaser.Scale.FIT } })
  const position = mapId === 'havn' ? START : { mapId: 'skogstjern' as MapId, x: 9, y: 16, facing: 'right' as const }
  playable = createWorld(document.querySelector('#play')!, position, DEFAULT_APPEARANCE, {
    onPosition: p => status(`${MAPS[p.mapId].name} · ${p.x}, ${p.y}`),
    onFishing: () => { status('Fiskeplassen er tilgjengelig.'); playable?.scene.finishFishing() },
    onSign: s => status(`${s.title}: ${s.text}`), onWardrobe: () => status('Garderoben er tilgjengelig.'),
    onDig: () => status('Gravestedet er tilgjengelig.'), onStorage: () => status('Kisten er tilgjengelig.'), onShop: () => status('Butikkdisken er tilgjengelig.'),
  })
  document.querySelector('#harbor')!.setAttribute('aria-pressed', String(mapId === 'havn'))
  document.querySelector('#forest')!.setAttribute('aria-pressed', String(mapId === 'skogstjern'))
  status(`Velkommen til ${MAPS[mapId].name}.`)
}
document.querySelector('#harbor')!.addEventListener('click', () => show('havn'))
document.querySelector('#forest')!.addEventListener('click', () => show('skogstjern'))
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
  button.addEventListener('click', () => playable?.scene.move(button.dataset.direction as Direction))
})
show('havn')
