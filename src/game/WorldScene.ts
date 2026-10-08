import { NPCS, type NpcDefinition } from './npcs'
import { CHARACTER_GROUND_OFFSET_Y, NPC_CHARACTERS, PLAYER_CHARACTERS, STANDARD_CHARACTERS, type StandardCharacter } from './characters'
import { createCharacterImage, preloadCharacter, setCharacterDirection } from './characterRendering'
import { nextCharacterWalkPhase, characterWalkTextureStep, CHARACTER_WALK_SETTLE_MS } from './characterAnimation'
import { playerMovementTiming } from './playerMovement'
import { NPC_MOVE_DURATION_MS, NPC_ROUTE_PAUSE_MS } from './npcMovement'
import { CAST_SPLASH_DURATION_MS, RETRIEVE_SHORE_DISTANCE, castFlightDuration, castTargets } from './fishing'
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
  onNpcTalk?: (npc: NpcDefinition, line: string) => void
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
  private playerCharacter: StandardCharacter
  private viewportZoom = 1
  private terrain?: Phaser.GameObjects.Graphics
  private environmentObjects?: Phaser.GameObjects.Group
  private waterSigns?: Phaser.GameObjects.Group
  private nextWaterSignAt = 0
  private castSplash?: Phaser.GameObjects.Graphics
  private castSplashTween?: Phaser.Tweens.Tween
  private castFlight?: Phaser.GameObjects.Graphics
  private castFlightTween?: Phaser.Tweens.Tween
  private lureShadow?: Phaser.GameObjects.Graphics
  private castDone?: (finished: boolean) => void
  private castSequenceId = 0
  private castCameraShifted = false
  private castCameraZoom?: number
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private moving = false
  private playerStep?: { fromX: number; fromY: number; x: number; y: number; started: number; duration: number }
  private playerWalkPhase = -1
  private playerWalkFrame = 1
  private playerWalkUntil = 0
  private fishing = false
  private aimingCast = false
  private castingForward = false
  private fishingRelaxed = false
  private uiBlocked = false
  private utilityHeld = false
  private canRun = false
  private touchDirection: Direction | null = null
  private nextMove = 0
  private residents: { definition: NpcDefinition; x: number; y: number; fromX: number; fromY: number; facing: Direction; index: number; moving: boolean; next: number; nextLook: number; lookingAside: boolean; sprite: Phaser.GameObjects.Container; image?: Phaser.GameObjects.Image; walkStarted?: number; walkPhase: number; walkFrame: number; walkUntil: number }[] = []
  private conversations = new Map<string, number>()

  constructor(position: Position, appearance: Appearance, callbacks: Callbacks) {
    super('world')
    this.position = { ...position }
    this.playerCharacter = PLAYER_CHARACTERS[appearance.playerVariant ?? 'male']
    this.callbacks = callbacks
  }

  preload() {
    for (const character of STANDARD_CHARACTERS) preloadCharacter(this, character)
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.clearCastSequence(); this.restoreCastCamera() })
    this.cameras.main.setZoom(this.viewportZoom)
    this.game.canvas.style.imageRendering = 'pixelated'
    this.cameras.main.setBackgroundColor('#183a36')
    this.drawMap()
    this.player = this.add.container(this.position.x * TILE_SIZE + 16, this.position.y * TILE_SIZE + 16)
    this.player.setDepth(this.player.y)
    const shadow = this.add.graphics()
    shadow.fillStyle(0x213e39, 0.24).fillEllipse(0, CHARACTER_GROUND_OFFSET_Y, 21, 5)
    this.player.add(shadow)
    this.playerImage = createCharacterImage(this, this.playerCharacter, this.position.facing)
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
    // Sort by feet every frame, including between tile endpoints and after map changes.
    this.player?.setDepth(this.player.y)
    for (const n of this.residents) n.sprite.setDepth(n.sprite.y)
    this.updateResidents(time)
    this.drawPlayer()
    for (const n of this.residents) this.drawResident(n)
    this.updateWaterSigns(time)
    const key = this.keys
    let direction: Direction | null = null
    let pressed = false
    for (const [facing, arrow, letter] of key ? [
      ['up', key.UP, key.W], ['down', key.DOWN, key.S],
      ['left', key.LEFT, key.A], ['right', key.RIGHT, key.D],
    ] as const : []) {
      // Consume every press, including when movement/UI blocks input. Fresh
      // taps need not wait for the hold-repeat timer and can last one frame.
      const arrowPressed = Phaser.Input.Keyboard.JustDown(arrow)
      const letterPressed = Phaser.Input.Keyboard.JustDown(letter)
      if (!direction && (arrow.isDown || letter.isDown || arrowPressed || letterPressed)) {
        direction = facing
        pressed = arrowPressed || letterPressed
      }
    }
    const keyboardDirection = Boolean(direction)
    direction ??= this.touchDirection
    const wasMoving = this.moving
    this.advancePlayerMovement(time, direction, !keyboardDirection)
    this.player?.setDepth(this.player.y)
    this.drawPlayer()
    if (this.moving || this.fishing || this.uiBlocked || (time < this.nextMove && (!pressed || wasMoving))) return
    if (direction) {
      const turned = this.move(direction, !keyboardDirection)
      const timing = playerMovementTiming(this.utilityHeld)
      this.nextMove = time + (turned ? timing.turnDelay : keyboardDirection ? timing.keyboardRepeat : timing.touchRepeat)
    }
  }

  move(direction: Direction, touch = false, started = this.time.now) {
    if (this.moving || this.fishing || this.uiBlocked || !this.player) return
    if (direction !== this.position.facing) {
      this.position = { ...this.position, facing: direction }
      this.playerWalkUntil = 0
      this.drawPlayer()
      this.callbacks.onPosition({ ...this.position }, false)
      // Walking can turn without stepping; running steps in the same input.
      if (playerMovementTiming(this.utilityHeld).turnDelay > 0) return true
    }
    const delta = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }[direction]
    const x = this.position.x + delta[0]
    const y = this.position.y + delta[1]
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
    const passingFrame = this.playerCharacter.walkPassingFrame?.[direction]
    this.playerWalkPhase = nextCharacterWalkPhase(this.playerWalkPhase, passingFrame)
    this.playerWalkFrame = characterWalkTextureStep(this.playerWalkPhase, passingFrame)
    this.playerWalkUntil = 0
    this.drawPlayer()
    this.playerStep = { fromX: this.player.x, fromY: this.player.y, x, y, started,
      duration: playerMovementTiming(this.utilityHeld, touch).duration }
  }

  private advancePlayerMovement(time: number, direction: Direction | null, touch: boolean) {
    // Carry frame overshoot into the next tile instead of restarting a tween
    // next frame. Logical positions/collision still advance one tile at a time.
    while (this.playerStep && this.player) {
      const step = this.playerStep
      const progress = Math.min(1, Math.max(0, (time - step.started) / step.duration))
      this.player.setPosition(step.fromX + (step.x * TILE_SIZE + 16 - step.fromX) * progress,
        step.fromY + (step.y * TILE_SIZE + 16 - step.fromY) * progress)
      if (progress < 1) return
      const arrived = step.started + step.duration
      this.playerStep = undefined
      this.moving = false
      this.playerWalkUntil = time + CHARACTER_WALK_SETTLE_MS
      this.position = { ...this.position, x: step.x, y: step.y }
      this.nextMove = arrived
      const target = stepTransition(this.position) ?? edgeTransition(this.position)
      if (target) {
        this.enterMap(target)
        // A transition ends this step; do not carry elapsed travel into a new map.
        this.nextMove = time + playerMovementTiming(this.utilityHeld, touch).duration
        return
      }
      this.callbacks.onPosition({ ...this.position }, false)
      if (!direction || this.fishing || this.uiBlocked) return
      // Long background stalls must not queue a burst of invisible tile steps.
      const started = time - arrived > step.duration ? time : arrived
      const turned = this.move(direction, touch, started)
      const timing = playerMovementTiming(this.utilityHeld, touch)
      this.nextMove = turned ? time + timing.turnDelay : started + timing.duration
    }
  }

  action() {
    if (this.moving || this.fishing || this.uiBlocked || !this.player) return
    const target = interactionAhead(this.position)
    const resident = this.npcAhead()
    if (resident) {
      resident.facing = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[this.position.facing]
      resident.walkUntil = 0
      this.drawResident(resident)
      const index = this.conversations.get(resident.definition.id) ?? 0
      this.conversations.set(resident.definition.id, index + 1)
      this.setUiBlocked(true)
      const line = resident.definition.lines[index % resident.definition.lines.length]
      if (this.callbacks.onNpcTalk) this.callbacks.onNpcTalk(resident.definition, line)
      else this.callbacks.onSign({ title: resident.definition.name, text: line })
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
      this.utilityHeld = false
      this.touchDirection = null
      this.callbacks.onFishing()
    }
  }

  getPosition(): Position { return { ...this.position } }

  setAppearance(appearance: Appearance) {
    this.playerCharacter = PLAYER_CHARACTERS[appearance.playerVariant ?? 'male']
    this.drawPlayer()
  }

  setViewportZoom(zoom: number) {
    this.viewportZoom = zoom
    this.cameras?.main?.setZoom(zoom)
  }

  finishFishing() {
    this.fishing = false
    this.aimingCast = false
    this.castingForward = false
    this.fishingRelaxed = false
    this.playerWalkUntil = 0
    this.drawPlayer()
    this.clearCastSequence()
    this.restoreCastCamera()
  }

  setCastAim(active: boolean) {
    this.aimingCast = active && this.fishing
    if (this.aimingCast) this.playerWalkUntil = 0
    this.drawPlayer()
  }

  playCast(steps: number): Promise<boolean> {
    if (!this.fishing || !this.player || !castTargets(this.position).some(target => target.steps === steps)) return Promise.resolve(false)
    this.clearCastSequence()
    const sequence = this.castSequenceId
    this.aimingCast = false
    this.castingForward = true
    this.drawPlayer()
    const target = castTargets(this.position).find(value => value.steps === steps)!
    const x = target.x * TILE_SIZE + TILE_SIZE / 2
    const y = target.y * TILE_SIZE + TILE_SIZE / 2
    this.frameCast(x, y)
    const pose = this.playerCharacter.poses!.castForward!
    const tip = pose.rodTip![this.position.facing]
    // Attachment pixels belong to the artwork, never to collision/world position.
    const startX = this.player.x + (tip.x - pose.format.groundAnchor.x) * pose.format.renderScale
    const startY = this.player.y + CHARACTER_GROUND_OFFSET_Y + (tip.y - pose.format.groundAnchor.y) * pose.format.renderScale
    const flight = this.add.graphics().setDepth(this.player.y + 1).setName('cast-flight')
      .setData({ startX, startY, targetX: x, targetY: y, steps })
    this.castFlight = flight
    const draw = (progress: number) => {
      const lureX = Phaser.Math.Linear(startX, x, progress)
      const lureY = Phaser.Math.Linear(startY, y, progress) - Math.sin(progress * Math.PI) * (24 + steps * 5)
      flight.setData({ progress, lureX, lureY }).clear()
      flight.lineStyle(1, 0xf1e7c8, .9)
      flight.beginPath().moveTo(startX, startY)
      for (let i = 1; i <= 12; i++) {
        const t = i / 12
        flight.lineTo(Math.round(Phaser.Math.Linear(startX, lureX, t)),
          Math.round(Phaser.Math.Linear(startY, lureY, t) + Math.sin(t * Math.PI) * 5 * progress))
      }
      flight.strokePath()
      flight.fillStyle(0xf8f2d8).fillRect(Math.round(lureX) - 1, Math.round(lureY) - 2, 3, 3)
      flight.fillStyle(0xc95439).fillRect(Math.round(lureX) - 1, Math.round(lureY) + 1, 3, 2)
    }
    draw(0)
    return new Promise(resolve => {
      this.castDone = resolve
      this.castFlightTween = this.tweens.addCounter({ from: 0, to: 1, duration: castFlightDuration(steps), ease: 'Sine.easeOut',
        onUpdate: tween => draw(tween.getValue() ?? 0),
        onComplete: () => {
          flight.destroy()
          this.castFlight = undefined
          this.castFlightTween = undefined
          if (sequence !== this.castSequenceId) return
          this.showCastSplash(steps, () => {
            if (sequence !== this.castSequenceId) return
            this.castingForward = false
            this.drawPlayer()
            this.castDone = undefined
            resolve(true)
          })
        },
      })
    })
  }

  showCastSplash(steps: number, onComplete?: () => void) {
    if (!this.fishing || !this.player) return
    const target = castTargets(this.position).find(value => value.steps === steps)
    if (!target) return
    // Landing is the pose boundary; retain this stance through every fish phase.
    this.castingForward = false
    this.aimingCast = false
    this.fishingRelaxed = true
    this.drawPlayer()
    this.clearCastSplash()
    const x = target.x * TILE_SIZE + TILE_SIZE / 2
    const y = target.y * TILE_SIZE + TILE_SIZE / 2
    this.frameCast(x, y)
    const splash = this.add.graphics().setPosition(x, y).setDepth(y + 1).setName('cast-splash')
      .setData({ tileX: target.x, tileY: target.y, steps })
    this.castSplash = splash
    const draw = (progress: number) => {
      splash.clear()
      splash.lineStyle(2, 0xe3f7ee, .9 * (1 - progress))
      splash.strokeEllipse(0, 0, 10 + progress * 24, 5 + progress * 11)
      splash.lineStyle(1, 0xa5dce8, .65 * (1 - progress))
      splash.strokeEllipse(0, 1, 5 + progress * 17, 3 + progress * 7)
      splash.fillStyle(0xf2fff4, 1 - progress)
      for (const side of [-1, 1]) {
        splash.fillRect(Math.round(side * (3 + progress * 9)), Math.round(-2 - Math.sin(progress * Math.PI) * 10), 2, 3)
        splash.fillRect(Math.round(side * (1 + progress * 5)), Math.round(-5 - Math.sin(progress * Math.PI) * 6), 2, 2)
      }
    }
    draw(0)
    this.castSplashTween = this.tweens.addCounter({ from: 0, to: 1, duration: CAST_SPLASH_DURATION_MS, ease: 'Sine.easeOut',
      onUpdate: tween => draw(tween.getValue() ?? 0),
      onComplete: () => {
        splash.destroy()
        if (this.castSplash === splash) { this.castSplash = undefined; this.castSplashTween = undefined }
        onComplete?.()
      },
    })
  }

  private frameCast(x: number, y: number) {
    if (!this.player || !this.playerImage || this.castCameraShifted) return
    const camera = this.cameras.main
    const view = camera.worldView
    const margin = 20
    if (x < view.left + margin || x > view.right - margin || y < view.top + margin || y > view.bottom - margin) {
      // Frame both the forward pose and landing point, including short landscape
      // screens. A temporary zoom changes only the view, never world coordinates.
      const bounds = this.playerImage.getBounds()
      const left = Math.min(bounds.left, x - 16) - margin, right = Math.max(bounds.right, x + 16) + margin
      const top = Math.min(bounds.top, y - 16) - margin, bottom = Math.max(bounds.bottom, y + 16) + margin
      const fit = Math.min(1, view.width / (right - left), view.height / (bottom - top))
      camera.stopFollow()
      if (fit < 1) { this.castCameraZoom = this.viewportZoom; camera.zoomTo(camera.zoom * fit, 180, 'Sine.easeOut', true) }
      camera.pan((left + right) / 2, (top + bottom) / 2, 180, 'Sine.easeOut', true)
      this.castCameraShifted = true
    }
  }

  private clearCastSequence() {
    this.castSequenceId++
    this.castFlightTween?.stop()
    this.castFlightTween = undefined
    this.castFlight?.destroy()
    this.castFlight = undefined
    this.clearCastSplash()
    this.lureShadow?.destroy()
    this.lureShadow = undefined
    this.castingForward = false
    this.fishingRelaxed = false
    const resolve = this.castDone
    this.castDone = undefined
    resolve?.(false)
  }

  setRetrieveProgress(steps: number, progress: number) {
    if (!this.fishing || !this.player) return
    const target = castTargets(this.position).find(value => value.steps === steps)
    if (!target) return
    const fraction = Phaser.Math.Clamp(progress, 0, 1)
    const distance = Phaser.Math.Linear(steps, RETRIEVE_SHORE_DISTANCE, fraction)
    const x = this.player.x + (target.x - this.position.x) / steps * distance * TILE_SIZE
    const y = this.player.y + (target.y - this.position.y) / steps * distance * TILE_SIZE
    if (!this.lureShadow) {
      this.lureShadow = this.add.graphics().setName('lure-shadow')
      this.lureShadow.fillStyle(0x103944, .6).fillEllipse(0, 0, 10, 5)
      this.lureShadow.fillStyle(0x082731, .45).fillEllipse(0, 0, 4, 2)
    }
    this.lureShadow.setPosition(x, y).setDepth(y + .1).setData({ steps, progress: fraction, distanceTiles: distance })
  }

  private clearCastSplash() {
    this.castSplashTween?.stop()
    this.castSplashTween = undefined
    this.castSplash?.destroy()
    this.castSplash = undefined
  }

  private restoreCastCamera() {
    if (!this.castCameraShifted) return
    const camera = this.cameras?.main
    if (camera && this.player) {
      camera.panEffect.reset()
      camera.zoomEffect.reset()
      if (this.castCameraZoom !== undefined) camera.setZoom(this.viewportZoom)
      camera.startFollow(this.player, true, .18, .18)
    }
    this.castCameraShifted = false
    this.castCameraZoom = undefined
  }

  setUiBlocked(blocked: boolean) {
    this.uiBlocked = blocked
    if (blocked) { this.utilityHeld = false; this.touchDirection = null }
  }

  setTouchDirection(direction: Direction | null) {
    this.touchDirection = direction && !this.uiBlocked && !this.fishing ? direction : null
    if (!this.touchDirection) return
    const turned = this.move(this.touchDirection, true)
    const timing = playerMovementTiming(this.utilityHeld)
    this.nextMove = (this.time?.now ?? 0) + (turned ? timing.turnDelay : timing.touchRepeat)
  }

  setCanRun(enabled: boolean) {
    this.canRun = enabled
    if (!enabled) this.setUtilityHeld(false)
  }

  setUtilityHeld(active: boolean) {
    const wasHeld = this.utilityHeld
    this.utilityHeld = active && this.canRun && !this.uiBlocked && !this.fishing
    // Switching speed while a direction remains held must take effect promptly.
    const timing = playerMovementTiming(this.utilityHeld)
    const now = this.time?.now ?? 0
    this.nextMove = this.utilityHeld && !wasHeld ? now : Math.min(this.nextMove, now + (this.touchDirection ? timing.touchRepeat : timing.keyboardRepeat))
  }

  private enterMap(destination: Position) {
    this.playerStep = undefined
    this.moving = false
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
    this.clearCastSequence()
    this.restoreCastCamera()
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
      const resident = { definition, x, y, fromX: x, fromY: y, facing: definition.facing, index: Math.max(0, definition.route.indexOf(start)), moving: false, next: this.time.now + 1800, nextLook: this.time.now + 5000 + this.residents.length * 1300, lookingAside: false, sprite: this.add.container(x*TILE_SIZE+16,y*TILE_SIZE+16).setDepth(y*TILE_SIZE+16), walkPhase: -1, walkFrame: 1, walkUntil: 0 }
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
    setCharacterDirection(n.image, character, n.facing,
      n.moving || this.time.now < n.walkUntil ? n.walkFrame : 0)
  }

  private updateResidents(time: number) {
    for (const n of this.residents) {
      let arrived: number | undefined
      if (n.moving) {
        const started = n.walkStarted ?? time
        const progress = Math.min(1, Math.max(0, (time-started)/NPC_MOVE_DURATION_MS))
        n.sprite.setPosition((n.fromX+(n.x-n.fromX)*progress)*TILE_SIZE+16,
          (n.fromY+(n.y-n.fromY)*progress)*TILE_SIZE+16)
        n.sprite.setDepth(n.sprite.y)
        if (progress < 1) continue
        arrived = started+NPC_MOVE_DURATION_MS
        n.moving=false
        n.walkUntil=time+CHARACTER_WALK_SETTLE_MS
        const [nx,ny]=n.definition.route[(n.index+1)%n.definition.route.length]
        const direction = nx>n.x ? 'right' : nx<n.x ? 'left' : ny>n.y ? 'down' : 'up'
        // Continue straight route sections immediately; the existing stroll
        // pause remains at a direction change.
        n.next=direction===n.facing ? arrived : time+NPC_ROUTE_PAUSE_MS
        this.callbacks.onInteractionChange?.()
      }
      if (this.uiBlocked || this.fishing) continue
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
      if (!isWalkable(MAPS[this.position.mapId].tiles[y]?.[x]) || (x === this.position.x && y === this.position.y)
        || (x === this.playerStep?.x && y === this.playerStep.y)
        || this.residents.some(other => other !== n && ((other.x === x && other.y === y) || (other.moving && other.fromX === x && other.fromY === y)))) continue
      n.facing = x > n.x ? 'right' : x < n.x ? 'left' : y > n.y ? 'down' : 'up'
      n.fromX=n.x; n.fromY=n.y; n.x=x; n.y=y; n.index=index; n.moving=true
      n.walkStarted = arrived !== undefined && time-arrived<NPC_MOVE_DURATION_MS ? arrived : time
      const character = NPC_CHARACTERS[n.definition.id]
      const passingFrame = character.walkPassingFrame?.[n.facing]
      n.walkPhase=nextCharacterWalkPhase(n.walkPhase,passingFrame)
      n.walkFrame=characterWalkTextureStep(n.walkPhase,passingFrame)
      n.walkUntil=0
      // Carry this frame's overshoot into the next tile, as for the player.
      const progress = Math.min(1, Math.max(0, (time-n.walkStarted)/NPC_MOVE_DURATION_MS))
      n.sprite.setPosition((n.fromX+(n.x-n.fromX)*progress)*TILE_SIZE+16,
        (n.fromY+(n.y-n.fromY)*progress)*TILE_SIZE+16)
      n.sprite.setDepth(n.sprite.y)
      this.drawResident(n)
      this.callbacks.onInteractionChange?.()
    }
  }

  private drawPlayer() {
    // Facing persists in Position, even after stopping or a blocked move.
    // Every direction within the character format shares origin/scale.
    if (!this.playerImage) return
    const walking = !this.uiBlocked && !this.fishing && (this.moving || this.time.now < this.playerWalkUntil)
    setCharacterDirection(this.playerImage, this.playerCharacter, this.position.facing,
      walking ? this.playerWalkFrame : 0, this.castingForward ? 'castForward' : this.aimingCast ? 'castAim' : this.fishingRelaxed ? 'fishingIdle' : undefined)
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
