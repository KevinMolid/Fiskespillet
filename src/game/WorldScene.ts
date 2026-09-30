import Phaser from 'phaser'
import { drawDecoration, drawOutdoorTile } from './outdoorTiles'
import { isWalkable } from './world'
import { fisherPixels } from './fisherSprite'
import { canFish, digSpotAhead, edgeTransition, interactionAhead, MAPS, stepTransition, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH, type Appearance, type Direction, type Position, type Tile } from './world'

type Callbacks = {
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
  private appearance: Appearance
  private callbacks: Callbacks
  private player?: Phaser.GameObjects.Container
  private terrain?: Phaser.GameObjects.Graphics
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private moving = false
  private fishing = false
  private uiBlocked = false
  private nextMove = 0
  private stride = 0
  private nextStride = 1

  constructor(position: Position, appearance: Appearance, callbacks: Callbacks) {
    super('world')
    this.position = { ...position }
    this.appearance = appearance
    this.callbacks = callbacks
  }

  create() {
    this.cameras.main.setBackgroundColor('#183a36')
    this.drawMap()
    this.player = this.add.container(this.position.x * TILE_SIZE + 16, this.position.y * TILE_SIZE + 16)
    this.player.setDepth(20)
    this.drawPlayer()
    this.setCameraBounds()
    this.cameras.main.roundPixels = true
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18)
    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key> | undefined
    this.input.keyboard?.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE')
    this.input.keyboard?.on('keydown-E', () => this.action())
    this.input.keyboard?.on('keydown-SPACE', () => this.action())
  }

  update(time: number) {
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
    if (!isWalkable(tile)) {
      this.callbacks.onPosition({ ...this.position }, false)
      return
    }
    this.moving = true
    this.stride = this.nextStride
    this.nextStride = this.nextStride === 1 ? 2 : 1
    this.drawPlayer()
    this.tweens.add({
      targets: this.player,
      x: x * TILE_SIZE + 16,
      y: y * TILE_SIZE + 16,
      duration: 115,
      ease: 'Linear',
      onComplete: () => {
        this.moving = false
        this.stride = 0
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
    if (target.npc) this.callbacks.onSign({ title: target.npc.name, text: target.npc.text })
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

  setAppearance(appearance: Appearance) {
    this.appearance = appearance
    this.drawPlayer()
  }

  finishFishing() {
    this.fishing = false
  }

  setUiBlocked(blocked: boolean) {
    this.uiBlocked = blocked
  }

  private enterMap(destination: Position) {
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
    this.terrain?.destroy()
    const graphics = this.add.graphics()
    this.terrain = graphics
    const map = MAPS[this.position.mapId]
    for (let y = 0; y < map.tiles.length; y++) {
      for (let x = 0; x < map.tiles[y].length; x++) {
        const tile = map.tiles[y][x]
        const left = x * TILE_SIZE
        const top = y * TILE_SIZE
        if (map.id === 'havn' || map.id === 'skogstjern') drawOutdoorTile(graphics, map, x, y)
        else this.drawTile(graphics, tile, left, top, x, y, true)
      }
    }
    for (const decoration of map.decorations ?? []) drawDecoration(graphics, decoration)
  }

  private drawTile(g: Phaser.GameObjects.Graphics, tile: Tile, x: number, y: number, col: number, row: number, indoor: boolean) {
    const base = indoor ? (tile === 'wall' || tile === 'window' ? 0x675442
      : tile === 'rug' ? 0x815553 : tile === 'door' ? 0xb49a76 : tile === 'stairs' ? 0x8e6948 : 0xc5a883)
      : tile === 'water' ? 0x236f88 : tile === 'path' || tile === 'exit' ? 0xc5a56d
        : tile === 'dock' ? 0x95704a : tile === 'soil' ? 0x805f43 : tile === 'roof' ? 0x814c3d : tile === 'houseWall' || tile === 'window' ? 0xc8a47b : tile === 'door' ? 0x7b4b31 : tile === 'npc' || tile === 'sign' ? 0x4a8a53
          : tile === 'wall' ? 0x174b38 : 0x4a8a53
    g.fillStyle(base).fillRect(x, y, TILE_SIZE, TILE_SIZE)
    if (indoor && (tile === 'wall' || tile === 'window')) {
      g.fillStyle(0x80684d).fillRect(x + 1, y + 2, 30, 7)
      g.fillStyle(0x493a31).fillRect(x + 1, y + 11, 30, 3)
      g.fillStyle(0x94795b).fillRect(x + 2, y + 18, 28, 11)
      if (tile === 'window') {
        g.fillStyle(0x354f67).fillRect(x + 5, y + 4, 22, 20)
        g.lineStyle(2, 0xe5c28c).strokeRect(x + 5, y + 4, 22, 20)
        g.lineBetween(x + 16, y + 5, x + 16, y + 23)
      }
    } else if (indoor && tile === 'floor') {
      g.lineStyle(1, 0xa4896d).lineBetween(x, y + 8, x + 32, y + 8)
      g.lineBetween(x, y + 24, x + 32, y + 24)
      if (row % 2 === 0) g.lineBetween(x + 16, y + 8, x + 16, y + 24)
    } else if (tile === 'roof') {
      g.fillStyle(0x995a47).fillRect(x + 2, y + 3, 28, 25)
      g.lineStyle(2, 0x61372f).lineBetween(x + 1, y + 14, x + 31, y + 14)
      g.lineBetween(x + 1, y + 27, x + 31, y + 27)
    } else if (tile === 'houseWall' || tile === 'window') {
      g.fillStyle(0xe1bb8d).fillRect(x + 2, y + 2, 28, 27)
      g.fillStyle(0x76573f).fillRect(x + 1, y + 1, 3, 30)
      if (tile === 'window') {
        g.fillStyle(0x456a7b).fillRect(x + 7, y + 5, 18, 19)
        g.lineStyle(2, 0x5e412d).strokeRect(x + 7, y + 5, 18, 19)
        g.lineBetween(x + 16, y + 6, x + 16, y + 23)
      }
    } else if (tile === 'stairs') {
      g.fillStyle(0x60432f).fillRect(x + 2, y + 2, 28, 28)
      for (let step = 0; step < 4; step++) {
        g.fillStyle(0xb48655).fillRect(x + 4, y + 4 + step * 7, 24, 5)
      }
      g.fillStyle(0xe8d3a2).fillTriangle(x + 16, y + 2, x + 10, y + 9, x + 22, y + 9)
    } else if (tile === 'counter') {
      g.fillStyle(0x745337).fillRect(x + 2, y + 3, 28, 27)
      g.fillStyle(0xd5bd98).fillRect(x + 2, y + 3, 28, 9)
      g.lineStyle(2, 0x564333).strokeRect(x + 2, y + 3, 28, 27)
    } else if (tile === 'stove') {
      g.fillStyle(0x52504a).fillRect(x + 2, y + 3, 28, 27)
      g.fillStyle(0x252f33).fillCircle(x + 11, y + 12, 5).fillCircle(x + 22, y + 12, 5)
      g.fillStyle(0xd5bd98).fillRect(x + 7, y + 24, 18, 2)
    } else if (tile === 'sofa') {
      g.fillStyle(0x64412f).fillRect(x + 2, y + 3, 28, 27)
      g.fillStyle(0x4d7469).fillRect(x + 5, y + 8, 22, 19)
      g.fillStyle(0x789585).fillRect(x + 5, y + 8, 22, 6)
    } else if (tile === 'soil') {
      g.fillStyle(0x957150).fillRect(x + 2, y + 2, 28, 28)
      g.fillStyle(0x584533).fillRect(x + 5, y + 8, 4, 3).fillRect(x + 19, y + 16, 6, 3)
      g.fillRect(x + 12, y + 24, 5, 2)
    } else if (tile === 'shopCounter') {
      g.fillStyle(0x64472f).fillRect(x + 1, y + 5, 30, 24)
      g.fillStyle(0xc59862).fillRect(x + 2, y + 3, 28, 11)
      g.fillStyle(0xe4bf66).fillCircle(x + 16, y + 9, 5)
    } else if (tile === 'chest') {
      g.fillStyle(0x63452d).fillRect(x + 2, y + 7, 28, 22)
      g.fillStyle(0xa97845).fillRect(x + 4, y + 4, 24, 9)
      g.lineStyle(2, 0x382c24).strokeRect(x + 2, y + 7, 28, 22)
      g.fillStyle(0xe1c16e).fillRect(x + 14, y + 13, 5, 7)
    } else if (tile === 'bed') {
      g.fillStyle(0x64452f).fillRect(x + 2, y + 1, 28, 30)
      g.fillStyle(0xe9dfc6).fillRect(x + 5, y + 4, 22, 9)
      g.fillStyle(0x47706a).fillRect(x + 5, y + 15, 22, 14)
    } else if (tile === 'table') {
      g.fillStyle(0x60412e).fillRect(x + 1, y + 4, 30, 25)
      g.fillStyle(0xa8754b).fillRect(x + 3, y + 4, 26, 19)
      g.lineStyle(2, 0xd0a375).strokeRect(x + 3, y + 4, 26, 19)
    } else if (tile === 'rug') {
      g.fillStyle(0xb77c65).fillRect(x + 2, y + 2, 28, 28)
      g.lineStyle(2, 0xe6bd88).strokeRect(x + 5, y + 5, 22, 22)
    } else if (tile === 'hearth') {
      g.fillStyle(0x47413d).fillRect(x + 2, y + 2, 28, 29)
      g.fillStyle(0xe7a044).fillTriangle(x + 8, y + 26, x + 16, y + 7, x + 24, y + 26)
      g.fillStyle(0xf2cf6a).fillTriangle(x + 12, y + 27, x + 17, y + 15, x + 21, y + 27)
    } else if (tile === 'water') {
      g.fillStyle(0x53a6b6).fillRect(x + 5 + (row % 3) * 2, y + 10, 13, 2)
      g.fillRect(x + 17, y + 23, 10, 2)
    } else if (tile === 'wall') {
      g.fillStyle(0x286945).fillRect(x + 4, y + 3, 24, 25)
      g.fillStyle(0x3b8152).fillRect(x + 8, y + 3, 15, 8)
      g.fillStyle(0x143c31).fillRect(x + 12, y + 27, 8, 5)
    } else if (tile === 'sign') {
      g.fillStyle(0x543d29).fillRect(x + 14, y + 13, 4, 18)
      g.fillStyle(0xe8cf94).fillRect(x + 4, y + 5, 24, 14)
      g.lineStyle(2, 0x543d29).strokeRect(x + 4, y + 5, 24, 14)
      g.fillStyle(0x543d29).fillRect(x + 9, y + 10, 14, 2)
    } else if (tile === 'door') {
      g.fillStyle(0x60422e).fillRect(x + 5, y + 2, 22, 29)
      g.fillStyle(0xd8b87d).fillRect(x + 21, y + 16, 3, 3)
    } else if (tile === 'wardrobe') {
      g.fillStyle(0x664029).fillRect(x + 3, y + 2, 26, 29)
      g.lineStyle(2, 0xd7af74).strokeRect(x + 4, y + 3, 24, 26)
      g.fillStyle(0xe8cb91).fillRect(x + 14, y + 15, 3, 3)
    } else if (tile === 'furniture') {
      g.fillStyle(0xd7ae7d).fillRect(x + 3, y + 5, 26, 22)
      g.lineStyle(2, 0x5d402a).strokeRect(x + 3, y + 5, 26, 22)
    } else if (tile === 'npc') {
      g.fillStyle(0x342d3f).fillRect(x + 9, y + 15, 14, 13)
      g.fillStyle(0xc88f66).fillRect(x + 10, y + 7, 12, 11)
      g.fillStyle(0x5a3628).fillRect(x + 9, y + 3, 14, 7)
    } else if (tile === 'grass') {
      g.fillStyle(0x68a968).fillRect(x + (col * 7 + row * 3) % 21 + 3, y + 8, 3, 5)
      g.fillRect(x + 22, y + 21, 3, 4)
    } else if (tile === 'dock') {
      g.lineStyle(2, 0x594b3c).strokeRect(x + 1, y + 1, 30, 30)
      g.lineBetween(x + 2, y + 15, x + 30, y + 15)
    } else {
      g.fillStyle(0xe0bd83).fillRect(x + 5, y + 8, 5, 4)
      g.fillRect(x + 22, y + 23, 4, 3)
    }
    g.lineStyle(1, 0x102b28, 0.14).strokeRect(x, y, TILE_SIZE, TILE_SIZE)
  }

  private drawPlayer() {
    if (!this.player) return
    this.player.removeAll(true)
    const g = this.add.graphics()
    g.fillStyle(0x213e39, 0.3).fillRect(-12, 10, 24, 4)
    for (const pixel of fisherPixels(this.appearance, this.position.facing, this.stride)) {
      g.fillStyle(pixel.color).fillRect(pixel.x * 2 - 18, pixel.y * 2 - 30, 2, 2)
    }
    this.player.add(g)
  }
}

export function createWorld(parent: HTMLElement, position: Position, appearance: Appearance, callbacks: Callbacks) {
  const scene = new WorldScene(position, appearance, callbacks)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH * TILE_SIZE,
    height: VIEW_HEIGHT * TILE_SIZE,
    backgroundColor: '#183a36',
    pixelArt: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  })
  return { game, scene }
}
