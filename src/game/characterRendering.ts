import Phaser from 'phaser'
import { CHARACTER_DIRECTIONS, CHARACTER_GROUND_OFFSET_Y, characterTextureKey, type CharacterPose, type StandardCharacter } from './characters'
import type { Direction } from './world'

export function preloadCharacter(scene: Phaser.Scene, character: StandardCharacter) {
  for (const direction of CHARACTER_DIRECTIONS) {
    scene.load.image(characterTextureKey(character, direction), character.sprites[direction])
    character.walk?.[direction].forEach((url, index) => {
      scene.load.image(characterTextureKey(character, direction, index + 1), url)
    })
    for (const pose of Object.keys(character.poses ?? {}) as CharacterPose[]) {
      scene.load.image(characterTextureKey(character, direction, 0, pose), character.poses![pose]!.sprites[direction])
    }
  }
}

export function createCharacterImage(scene: Phaser.Scene, character: StandardCharacter, facing: Direction) {
  const { canvas, groundAnchor, renderScale, filter } = character.format
  for (const direction of CHARACTER_DIRECTIONS) {
    for (const step of character.walk ? [0, 1, 2] : [0]) {
      const texture = scene.textures.get(characterTextureKey(character, direction, step))
      const source = texture.getSourceImage()
      if (source.width !== canvas.width || source.height !== canvas.height) {
        throw new Error(`${character.id}/${direction}: expected ${canvas.width} × ${canvas.height}`)
      }
      texture.setFilter(filter === 'nearest' ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR)
    }
    for (const pose of Object.keys(character.poses ?? {}) as CharacterPose[]) {
      const format = character.poses![pose]!.format
      const texture = scene.textures.get(characterTextureKey(character, direction, 0, pose))
      const source = texture.getSourceImage()
      if (source.width !== format.canvas.width || source.height !== format.canvas.height) {
        throw new Error(`${character.id}/${direction}/${pose}: unexpected pose canvas`)
      }
      texture.setFilter(format.filter === 'nearest' ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR)
    }
  }
  // Tile-center to legacy ground-line conversion stays shared and unchanged.
  return scene.add.image(0, CHARACTER_GROUND_OFFSET_Y, characterTextureKey(character, facing))
    .setOrigin(groundAnchor.x / canvas.width, groundAnchor.y / canvas.height)
    .setScale(renderScale)
}

export function setCharacterDirection(image: Phaser.GameObjects.Image, character: StandardCharacter, facing: Direction, step = 0, pose?: CharacterPose) {
  const activePose = pose && character.poses?.[pose] ? pose : undefined
  const format = activePose ? character.poses![activePose]!.format : character.format
  const key = characterTextureKey(character, facing, character.walk ? step : 0, activePose)
  if (image.texture.key !== key) {
    image.setTexture(key)
      .setOrigin(format.groundAnchor.x / format.canvas.width, format.groundAnchor.y / format.canvas.height)
      .setScale(format.renderScale)
  }
}
