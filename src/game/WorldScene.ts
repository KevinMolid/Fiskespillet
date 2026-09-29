import Phaser from 'phaser'
import { HEIGHT, MAPS, TILE_SIZE, WIDTH, type Direction, type Position, type Tile } from './world'

type Callbacks = {
  onPosition: (position: Position, transitioned: boolean) => void
  onFishing: () => void
}

export class WorldScene extends Phaser.Scene {
  private position: Position
  private callbacks: Callbacks
  private player?: Phaser.GameObjects.Container
  private terrain?: Phaser.GameObjects.Graphics
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private moving = false
  private fishing = false
  private nextMove = 0

  constructor(position: Position, callbacks: Callbacks) {
    super('world')
    this.position = { ...position }
    this.callbacks = callbacks
  }

  create() {
    this.cameras.main.setBackgroundColor('#183a36')
    this.drawMap()
    this.player = this.add.container(this.position.x * TILE_SIZE + 16, this.position.y * TILE_SIZE + 16)
    this.player.setDepth(20)
    this.drawPlayer()
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key> | undefined
    this.input.keyboard?.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE')
    this.input.keyboard?.on('keydown-E', () => this.fish())
    this.input.keyboard?.on('keydown-SPACE', () => this.fish())
  }

  update(time: number) {
    if (!this.keys || this.moving || this.fishing || time < this.nextMove) return
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
    if (this.moving || this.fishing || !this.player) return
    const delta = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }[direction]
    const x = this.position.x + delta[0]
    const y = this.position.y + delta[1]
    this.position = { ...this.position, facing: direction }
    this.drawPlayer()
    const tile = MAPS[this.position.mapId].tiles[y]?.[x]
    if (!tile || tile === 'wall' || tile === 'water') return
    this.moving = true
    this.tweens.add({
      targets: this.player,
      x: x * TILE_SIZE + 16,
      y: y * TILE_SIZE + 16,
      duration: 115,
      ease: 'Linear',
      onComplete: () => {
        this.moving = false
        const target = MAPS[this.position.mapId].portals[`${x},${y}`]
        this.position = target ? { ...target } : { ...this.position, x, y }
        if (target) {
          this.drawMap()
          this.player?.setPosition(this.position.x * TILE_SIZE + 16, this.position.y * TILE_SIZE + 16)
          this.drawPlayer()
        }
        this.callbacks.onPosition({ ...this.position }, Boolean(target))
      },
    })
  }

  fish() {
    if (!this.moving && !this.fishing && MAPS[this.position.mapId].tiles[this.position.y][this.position.x] === 'fish') {
      this.fishing = true
      this.callbacks.onFishing()
    }
  }

  finishFishing() {
    this.fishing = false
  }

  private drawMap() {
    this.terrain?.destroy()
    const graphics = this.add.graphics()
    this.terrain = graphics
    const map = MAPS[this.position.mapId]
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const tile = map.tiles[y][x]
        const left = x * TILE_SIZE
        const top = y * TILE_SIZE
        this.drawTile(graphics, tile, left, top, x, y)
      }
    }
  }

  private drawTile(g: Phaser.GameObjects.Graphics, tile: Tile, x: number, y: number, col: number, row: number) {
    const base = tile === 'water' ? 0x236f88 : tile === 'path' ? 0xc5a56d
      : tile === 'dock' ? 0x95704a : tile === 'fish' ? 0xd5b87b
        : tile === 'portal' ? 0xe4bb54 : tile === 'wall' ? 0x174b38 : 0x4a8a53
    g.fillStyle(base).fillRect(x, y, TILE_SIZE, TILE_SIZE)
    if (tile === 'water') {
      g.fillStyle(0x53a6b6).fillRect(x + 5 + (row % 3) * 2, y + 10, 13, 2)
      g.fillRect(x + 17, y + 23, 10, 2)
    } else if (tile === 'wall') {
      g.fillStyle(0x286945).fillRect(x + 4, y + 3, 24, 25)
      g.fillStyle(0x3b8152).fillRect(x + 8, y + 3, 15, 8)
      g.fillStyle(0x143c31).fillRect(x + 12, y + 27, 8, 5)
    } else if (tile === 'grass') {
      g.fillStyle(0x68a968).fillRect(x + (col * 7 + row * 3) % 21 + 3, y + 8, 3, 5)
      g.fillRect(x + 22, y + 21, 3, 4)
    } else if (tile === 'dock' || tile === 'fish') {
      g.lineStyle(2, 0x594b3c).strokeRect(x + 1, y + 1, 30, 30)
      g.lineBetween(x + 2, y + 15, x + 30, y + 15)
      if (tile === 'fish') g.fillStyle(0xffe28b).fillCircle(x + 16, y + 16, 5)
    } else if (tile === 'portal') {
      g.fillStyle(0x755335).fillRect(x + 14, y + 9, 4, 23)
      g.fillStyle(0xffe28b).fillRect(x + 5, y + 5, 22, 13)
      g.fillStyle(0x755335).fillTriangle(x + 22, y + 9, x + 27, y + 12, x + 22, y + 15)
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
    g.fillStyle(0x152d33).fillEllipse(0, 11, 22, 7)
    g.fillStyle(0x315d89).fillRect(-9, -2, 18, 14)
    g.fillStyle(0x183345).fillRect(-9, 10, 7, 4).fillRect(2, 10, 7, 4)
    g.fillStyle(0xf1bd8c).fillRect(-7, -13, 14, 12)
    g.fillStyle(0xc94943).fillRect(-10, -17, 20, 5).fillRect(-7, -22, 14, 6)
    if (this.position.facing !== 'up') {
      g.fillStyle(0x162833)
      if (this.position.facing === 'left') g.fillRect(-6, -8, 2, 2)
      else if (this.position.facing === 'right') g.fillRect(4, -8, 2, 2)
      else g.fillRect(-4, -8, 2, 2).fillRect(3, -8, 2, 2)
    }
    this.player.add(g)
  }
}

export function createWorld(parent: HTMLElement, position: Position, callbacks: Callbacks) {
  const scene = new WorldScene(position, callbacks)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH * TILE_SIZE,
    height: HEIGHT * TILE_SIZE,
    backgroundColor: '#183a36',
    pixelArt: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  })
  return { game, scene }
}
