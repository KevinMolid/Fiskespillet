import Phaser from 'phaser'
import { CHARACTER_DIRECTIONS, CHARACTER_GROUND_OFFSET_Y, characterTextureKey, type StandardCharacter } from './characters'
import type { Direction } from './world'

export function preloadCharacter(scene: Phaser.Scene, character: StandardCharacter) {
  for (const direction of CHARACTER_DIRECTIONS) {
    scene.load.image(characterTextureKey(character, direction), character.sprites[direction])
    character.walk?.[direction].forEach((url, index) => {
      scene.load.image(characterTextureKey(character, direction, index + 1), url)
    })
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
  }
  // Tile-center to legacy ground-line conversion stays shared and unchanged.
  return scene.add.image(0, CHARACTER_GROUND_OFFSET_Y, characterTextureKey(character, facing))
    .setOrigin(groundAnchor.x / canvas.width, groundAnchor.y / canvas.height)
    .setScale(renderScale)
}

export function setCharacterDirection(image: Phaser.GameObjects.Image, character: StandardCharacter, facing: Direction, step = 0) {
  const key = characterTextureKey(character, facing, character.walk ? step : 0)
  if (image.texture.key !== key) image.setTexture(key)
}
