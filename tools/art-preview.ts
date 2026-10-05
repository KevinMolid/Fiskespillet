import Phaser from 'phaser'
import { createWorld } from '../src/game/WorldScene'
import { drawDecoration, drawOutdoorGround, drawOutdoorObject, isOutdoorObject, isRaisedDecoration } from '../src/game/outdoorTiles'
import { drawIndoorGround, drawIndoorObject, isIndoorObject } from '../src/game/indoorTiles'
import { indoorObjectDepth } from '../src/game/indoorArchitecture'
import { drawBuildingDoors } from '../src/game/buildingOpenings'
import { MAPS, DEFAULT_APPEARANCE, START, TILE_SIZE, type Direction, type MapId } from '../src/game/world'

let overview: Phaser.Game | undefined
let playable: ReturnType<typeof createWorld> | undefined
const status = (message: string) => { document.querySelector('#status')!.textContent = message }
function show(mapId: MapId) {
  overview?.destroy(true)
  playable?.game.destroy(true)
  const map = MAPS[mapId]
  const outdoor = mapId === 'havn' || mapId === 'skogstjern'
  class Overview extends Phaser.Scene {
    create() {
      const ground = this.add.graphics()
      for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
        if (outdoor) drawOutdoorGround(ground,map,x,y)
        else drawIndoorGround(ground,map,x,y)
        if (outdoor ? isOutdoorObject(map.tiles[y][x]) : isIndoorObject(map.tiles[y][x])) {
          const object=this.add.graphics().setDepth(outdoor ? y*TILE_SIZE+16 : indoorObjectDepth(map.tiles[y][x],y))
          if (outdoor) drawOutdoorObject(object,map,x,y)
          else drawIndoorObject(object,map,x,y)
        }
      }
      drawBuildingDoors(ground,map)
      for (const d of map.decorations ?? []) {
        const layer=isRaisedDecoration(d.kind)?this.add.graphics().setDepth(d.y*TILE_SIZE+16):ground
        drawDecoration(layer,d)
      }
    }
  }
  const overviewEl = document.querySelector<HTMLElement>('#overview')!
  overviewEl.style.aspectRatio = `${map.tiles[0].length} / ${map.tiles.length}`
  overview = new Phaser.Game({ type: Phaser.CANVAS, parent: overviewEl, width: map.tiles[0].length*TILE_SIZE, height: map.tiles.length*TILE_SIZE, pixelArt: true, render:{antialias:false}, scene: Overview, scale: { mode: Phaser.Scale.FIT } })
  const position = mapId === 'havn' ? START : mapId === 'skogstjern' ? { mapId, x: 9, y: 16, facing: 'right' as const } : {mapId,x:12,y:12,facing:'up' as const}
  playable = createWorld(document.querySelector('#play')!, position, DEFAULT_APPEARANCE, {
    onPosition: p => status(`${MAPS[p.mapId].name} · ${p.x}, ${p.y}`),
    onFishing: () => { status('Fiskeplassen er tilgjengelig.'); playable?.scene.finishFishing() },
    onSign: s => { status(`${s.title}: ${s.text}`); playable?.scene.setUiBlocked(false) }, onWardrobe: () => status('Garderoben er tilgjengelig.'),
    onDig: () => status('Gravestedet er tilgjengelig.'), onStorage: () => status('Kisten er tilgjengelig.'), onShop: () => status('Butikkdisken er tilgjengelig.'),
  })
  document.querySelectorAll<HTMLButtonElement>('[data-map]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.map===mapId)))
  document.querySelector('#map-title')!.textContent=map.name
  status(`Velkommen til ${map.name}.`)
}

document.querySelectorAll<HTMLButtonElement>('[data-map]').forEach(button => button.addEventListener('click',()=>show(button.dataset.map as MapId)))
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => button.addEventListener('click', () => playable?.scene.move(button.dataset.direction as Direction)))
const requestedMap = new URLSearchParams(location.search).get('map') as MapId | null
show(requestedMap && Object.hasOwn(MAPS, requestedMap) ? requestedMap : 'havn')
if (import.meta.hot) import.meta.hot.dispose(()=>{ overview?.destroy(true); playable?.game.destroy(true) })
