import { NPCS, type NpcDefinition } from './npcs'
import { CHARACTER_GROUND_OFFSET_Y, NPC_CHARACTERS, PLAYER_CHARACTER, STANDARD_CHARACTERS } from './characters'
import { createCharacterImage, preloadCharacter, setCharacterDirection } from './characterRendering'
import { characterWalkStep, nextPlayerWalkStep, PLAYER_WALK_SETTLE_MS } from './characterAnimation'
import Phaser from 'phaser'
import { drawDecoration, drawOutdoorGround, drawOutdoorObject, isOutdoorObject, isRaisedDecoration } from './outdoorTiles'
import { drawIndoorGround, drawIndoorObject, isIndoorObject } from './indoorTiles'
import { indoorObjectDepth } from './indoorArchitecture'
import { drawBuildingDoors } from './buildingOpenings'
import { isWalkable } from './world'
import { canFish, digSpotAhead, edgeTransition, interactionAhead, MAPS, stepTransition, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH, type Appearance, type Direction, type Position } from './world'

type Callbacks = {
  onInteractionChange?: () => void
  onPosition: (position: Position, transitioned: boolean) => void
  onFishing: () => void
  onSign: (sign: { title: string; text: string }) => void
  onWardrobe: () => void
  onDig: (spotId: string) => void
  onStorage: () => void
  onShop: () => void
}

export class WorldScene extends Phaser.Scene {
  private position: Position
  private callbacks: Callbacks
  private player?: Phaser.GameObjects.Container
  private playerImage?: Phaser.GameObjects.Image
  private viewportZoom = 1
  private terrain?: Phaser.GameObjects.Graphics
  private environmentObjects?: Phaser.GameObjects.Group
  private waterSigns?: Phaser.GameObjects.Group
  private nextWaterSignAt = 0
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private moving = false
  private playerWalkFrame: 1 | 2 = 2
  private playerWalkUntil = 0
  private fishing = false
  private uiBlocked = false
  private nextMove = 0
  private residents: { definition: NpcDefinition; x: number; y: number; fromX: number; fromY: number; facing: Direction; index: number; moving: boolean; next: number; nextLook: number; lookingAside: boolean; sprite: Phaser.GameObjects.Container; image?: Phaser.GameObjects.Image; walkStarted?: number }[] = []
  private conversations = new Map<string, number>()

  constructor(position: Position, _appearance: Appearance, callbacks: Callbacks) {
    super('world')
    this.position = { ...position }
    this.callbacks = callbacks
  }

  preload() {
    for (const character of STANDARD_CHARACTERS) preloadCharacter(this, character)
  }

  create() {
    this.cameras.main.setZoom(this.viewportZoom)
    this.game.canvas.style.imageRendering = 'pixelated'
    this.cameras.main.setBackgroundColor('#183a36')
    this.drawMap()
    this.player = this.add.container(this.position.x * TILE_SIZE + 16, this.position.y * TILE_SIZE + 16)
    this.player.setDepth(this.player.y)
    const shadow = this.add.graphics()
    shadow.fillStyle(0x213e39, 0.24).fillEllipse(0, CHARACTER_GROUND_OFFSET_Y, 21, 5)
    this.player.add(shadow)
    this.playerImage = createCharacterImage(this, PLAYER_CHARACTER, this.position.facing)
    this.player.add(this.playerImage)
    this.drawPlayer()
    this.setCameraBounds()
    this.cameras.main.roundPixels = true
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18)
    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key> | undefined
    this.input.keyboard?.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE')
    this.input.keyboard?.on('keydown-E', () => this.action())
    this.input.keyboard?.on('keydown-SPACE', () => this.action())
    this.callbacks.onInteractionChange?.()
  }

  update(time: number) {
    // Sort by feet every frame, including between tween endpoints and after map changes.
    this.player?.setDepth(this.player.y)
    for (const n of this.residents) n.sprite.setDepth(n.sprite.y)
    this.updateResidents(time)
    this.drawPlayer()
    for (const n of this.residents) this.drawResident(n)
    this.updateWaterSigns(time)
    if (!this.keys || this.moving || this.fishing || this.uiBlocked || time < this.nextMove) return
    const key = this.keys
    const direction: Direction | null =
      key.UP.isDown || key.W.isDown ? 'up'
        : key.DOWN.isDown || key.S.isDown ? 'down'
          : key.LEFT.isDown || key.A.isDown ? 'left'
            : key.RIGHT.isDown || key.D.isDown ? 'right' : null
    if (direction) {
      this.move(direction)
      this.nextMove = time + 145
    }
  }

  move(direction: Direction) {
    if (this.moving || this.fishing || this.uiBlocked || !this.player) return
    const delta = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }[direction]
    const x = this.position.x + delta[0]
    const y = this.position.y + delta[1]
    this.position = { ...this.position, facing: direction }
    this.drawPlayer()
    const tile = MAPS[this.position.mapId].tiles[y]?.[x]
    if (!tile) {
      const map = MAPS[this.position.mapId]
      const exitDirection = this.position.x === 0 ? 'left' : this.position.x === map.tiles[0].length - 1 ? 'right'
        : this.position.y === 0 ? 'up' : this.position.y === map.tiles.length - 1 ? 'down' : null
      if (exitDirection === direction) {
        const destination = edgeTransition(this.position)
        if (destination) this.enterMap(destination)
      } else this.callbacks.onPosition({ ...this.position }, false)
      return
    }
    if (!isWalkable(tile) || this.residents.some(n => (n.x === x && n.y === y) || (n.moving && n.fromX === x && n.fromY === y))) {
      this.callbacks.onPosition({ ...this.position }, false)
      return
    }
    this.moving = true
    this.playerWalkFrame = nextPlayerWalkStep(this.playerWalkFrame)
    this.playerWalkUntil = 0
    this.drawPlayer()
    this.tweens.add({
      targets: this.player,
      x: x * TILE_SIZE + 16,
      y: y * TILE_SIZE + 16,
      duration: 115,
      ease: 'Linear',
      onComplete: () => {
        this.moving = false
        this.playerWalkUntil = this.time.now + PLAYER_WALK_SETTLE_MS
        this.position = { ...this.position, x, y }
        this.drawPlayer()
        const target = stepTransition(this.position) ?? edgeTransition(this.position)
        if (target) this.enterMap(target)
        else this.callbacks.onPosition({ ...this.position }, false)
      },
    })
  }

  action() {
    if (this.moving || this.fishing || this.uiBlocked) return
    const target = interactionAhead(this.position)
    const resident = this.npcAhead()
    if (resident) {
      resident.facing = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[this.position.facing]
      this.drawResident(resident)
      const index = this.conversations.get(resident.definition.id) ?? 0
      this.conversations.set(resident.definition.id, index + 1)
      this.setUiBlocked(true)
      this.callbacks.onSign({ title: resident.definition.name, text: resident.definition.lines[index % resident.definition.lines.length] })
    }
    else if (target.npc) this.callbacks.onSign({ title: target.npc.name, text: target.npc.text })
    else if (target.tile === 'wardrobe') this.callbacks.onWardrobe()
    else if (target.tile === 'chest') this.callbacks.onStorage()
    else if (target.tile === 'shopCounter') this.callbacks.onShop()
    else if (target.tile === 'soil') {
      const spotId = digSpotAhead(this.position)
      if (spotId) this.callbacks.onDig(spotId)
    }
    else if (target.sign) this.callbacks.onSign(target.sign)
    else if (canFish(this.position)) {
      this.fishing = true
      this.callbacks.onFishing()
    }
  }

  setAppearance(_appearance: Appearance) {
    // Preserve the wardrobe API/saved appearance; the POC uses the fixed reference art.
    this.drawPlayer()
  }

  setViewportZoom(zoom: number) {
    this.viewportZoom = zoom
    this.cameras?.main?.setZoom(zoom)
  }

  finishFishing() {
    this.fishing = false
  }

  setUiBlocked(blocked: boolean) {
    this.uiBlocked = blocked
  }

  private enterMap(destination: Position) {
    this.playerWalkUntil = 0
    this.position = destination
    this.drawMap()
    this.setCameraBounds()
    this.player?.setPosition(destination.x * TILE_SIZE + 16, destination.y * TILE_SIZE + 16)
    this.drawPlayer()
    this.cameras.main.centerOn(this.player!.x, this.player!.y)
    this.callbacks.onPosition({ ...destination }, true)
  }

  private setCameraBounds() {
    const map = MAPS[this.position.mapId]
    this.cameras.main.setBounds(0, 0, map.tiles[0].length * TILE_SIZE, map.tiles.length * TILE_SIZE)
  }

  private drawMap() {
    this.waterSigns?.clear(true, true)
    this.waterSigns?.destroy(true)
    this.waterSigns = undefined
    for (const resident of this.residents) {
      this.tweens.killTweensOf(resident.sprite)
      resident.sprite.destroy()
    }
    this.residents = []
    this.terrain?.destroy()
    this.environmentObjects?.clear(true, true)
    this.environmentObjects?.destroy(true)
    this.environmentObjects = this.add.group()
    const graphics = this.add.graphics()
    this.terrain = graphics
    const map = MAPS[this.position.mapId]
    this.waterSigns = this.add.group()
    this.nextWaterSignAt = this.time.now + 2500 + Math.random() * 3500
    for (let y = 0; y < map.tiles.length; y++) {
      for (let x = 0; x < map.tiles[y].length; x++) {
        const tile = map.tiles[y][x]
        const outdoor = map.id === 'havn' || map.id === 'skogstjern'
        if (outdoor) drawOutdoorGround(graphics, map, x, y)
        else drawIndoorGround(graphics, map, x, y)
        if (outdoor ? isOutdoorObject(tile) : isIndoorObject(tile)) {
          const object = this.add.graphics().setDepth(outdoor ? y * TILE_SIZE + 16 : indoorObjectDepth(tile, y)).setName(`environment-${tile}:${x},${y}`)
          if (outdoor) drawOutdoorObject(object, map, x, y)
          else drawIndoorObject(object, map, x, y)
          this.environmentObjects.add(object)
        }
      }
    }
    drawBuildingDoors(graphics, map)
    for (const decoration of map.decorations ?? []) {
      if (isRaisedDecoration(decoration.kind)) {
        const object = this.add.graphics().setDepth(decoration.y * TILE_SIZE + 16)
        drawDecoration(object, decoration)
        this.environmentObjects.add(object)
      } else drawDecoration(graphics, decoration)
    }
    for (const definition of NPCS.filter(n => n.mapId === this.position.mapId)) {
      // A saved player may be standing on a route's start; choose a free route tile or wait off-route.
      const start = definition.route.find(([x,y]) => x !== this.position.x || y !== this.position.y)
        ?? [[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy]) => [definition.route[0][0]+dx,definition.route[0][1]+dy] as const).find(([x,y]) => isWalkable(map.tiles[y]?.[x]) && (x !== this.position.x || y !== this.position.y))
      if (!start) continue
      const [x,y] = start
      const resident = { definition, x, y, fromX: x, fromY: y, facing: definition.facing, index: Math.max(0, definition.route.indexOf(start)), moving: false, next: this.time.now + 1800, nextLook: this.time.now + 5000 + this.residents.length * 1300, lookingAside: false, sprite: this.add.container(x*TILE_SIZE+16,y*TILE_SIZE+16).setDepth(y*TILE_SIZE+16) }
      this.residents.push(resident)
      this.drawResident(resident)
    }
  }

  /** Occasional small rings hint that fish are active without cluttering the water. */
  private updateWaterSigns(time: number) {
    if (time < this.nextWaterSignAt || this.fishing || this.uiBlocked) return
    const map = MAPS[this.position.mapId]
    if (!map.fishingZone || !this.waterSigns) return
    const visible = map.tiles.flatMap((row, y) => row.flatMap((tile, x) => {
      const px = x * TILE_SIZE + TILE_SIZE / 2
      const py = y * TILE_SIZE + TILE_SIZE / 2
      return tile === 'water' && this.cameras.main.worldView.contains(px, py) ? [{ x: px, y: py }] : []
    }))
    this.nextWaterSignAt = time + 7000 + Math.random() * 9000
    if (!visible.length) return
    const { x, y } = visible[Math.floor(Math.random() * visible.length)]
    const ring = this.add.ellipse(x, y, 9, 4, 0x53a6b6, 0).setStrokeStyle(1, 0xa9dbe0, 0.85).setDepth(y - 2)
    this.waterSigns.add(ring)
    this.tweens.add({ targets: ring, scaleX: 2.4, scaleY: 2.2, alpha: 0, duration: 850, ease: 'Sine.easeOut', onComplete: () => {
      this.waterSigns?.remove(ring)
      ring.destroy()
    } })
  }

  npcAhead() {
    const [dx,dy] = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[this.position.facing]
    return this.residents.find(n => !n.moving && n.x === this.position.x+dx && n.y === this.position.y+dy)
  }

  private drawResident(n: WorldScene['residents'][number]) {
    const character = NPC_CHARACTERS[n.definition.id]
    if (!n.image) {
      const shadow = this.add.graphics()
      shadow.fillStyle(0x213e39, 0.3).fillRect(-12,10,24,4)
      n.image = createCharacterImage(this, character, n.facing)
      n.sprite.add([shadow, n.image])
    }
    const progress = (this.time.now - (n.walkStarted ?? this.time.now)) / 300
    setCharacterDirection(n.image, character, n.facing, characterWalkStep(n.moving, progress))
  }

  private updateResidents(time: number) {
    if (this.uiBlocked || this.fishing || this.moving) return
    for (const n of this.residents) {
      if (n.definition.route.length < 2) {
        if (time >= n.nextLook) {
          n.lookingAside = !n.lookingAside
          n.facing = n.lookingAside ? (Math.floor(time / 1000) % 2 ? 'left' : 'right') : 'down'
          n.nextLook = time + (n.lookingAside ? 1400 : 6500)
          this.drawResident(n)
        }
        continue
      }
      if (n.moving || time < n.next) continue
      // Let the player read the action prompt and start a conversation without chasing.
      if (Math.abs(n.x-this.position.x)+Math.abs(n.y-this.position.y) <= 1) continue
      const index = (n.index+1)%n.definition.route.length
      const [x,y] = n.definition.route[index]
      if (!isWalkable(MAPS[this.position.mapId].tiles[y]?.[x]) || (x === this.position.x && y === this.position.y) || this.residents.some(other => other !== n && ((other.x === x && other.y === y) || (other.moving && other.fromX === x && other.fromY === y)))) continue
      n.facing = x > n.x ? 'right' : x < n.x ? 'left' : y > n.y ? 'down' : 'up'
      n.fromX=n.x; n.fromY=n.y; n.x=x; n.y=y; n.index=index; n.moving=true
      n.walkStarted = this.time.now
      this.drawResident(n)
      this.tweens.add({ targets:n.sprite, x:x*TILE_SIZE+16, y:y*TILE_SIZE+16, duration:300, onComplete:()=>{
        n.moving=false; n.next=this.time.now+1600; this.drawResident(n)
        this.callbacks.onInteractionChange?.()
      } })
      this.callbacks.onInteractionChange?.()
    }
  }

  private drawPlayer() {
    // Facing persists in Position, even after stopping or a blocked move.
    // Every direction within the character format shares origin/scale.
    if (!this.playerImage) return
    const walking = !this.uiBlocked && !this.fishing && (this.moving || this.time.now < this.playerWalkUntil)
    setCharacterDirection(this.playerImage, PLAYER_CHARACTER, this.position.facing,
      walking ? this.playerWalkFrame : 0)
  }
}

export function createWorld(parent: HTMLElement, position: Position, appearance: Appearance, callbacks: Callbacks) {
  const scene = new WorldScene(position, appearance, callbacks)
  const dimensions = () => {
    const mobile = window.matchMedia('(max-width: 767px), (max-width: 1023px) and (max-height: 500px)').matches
    const width = mobile ? 12 * TILE_SIZE : VIEW_WIDTH * TILE_SIZE
    const height = mobile ? Math.round(width * parent.clientHeight / Math.max(1, parent.clientWidth)) : VIEW_HEIGHT * TILE_SIZE
    // Render at display density, then compensate with camera zoom. The visible world
    // and all world coordinates stay unchanged; the sprite retains high-DPI detail.
    const zoom = Math.max(1, parent.clientWidth * window.devicePixelRatio / width)
    return { width: Math.round(width * zoom), height: Math.round(height * zoom), zoom }
  }
  const initial = dimensions()
  scene.setViewportZoom(initial.zoom)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: initial.width,
    height: initial.height,
    backgroundColor: '#183a36',
    pixelArt: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  })
  const observer = new ResizeObserver(() => {
    const size = dimensions()
    if (game.scale.width !== size.width || game.scale.height !== size.height) game.scale.resize(size.width, size.height)
    scene.setViewportZoom(size.zoom)
  })
  observer.observe(parent)
  game.events.once('destroy', () => observer.disconnect())
  return { game, scene }
}
