import Phaser from 'phaser'
import { CHARACTER_DIRECTIONS, CHARACTER_GROUND_OFFSET_Y, CHARACTER_STANDARD, CHARACTER_FRAME_COUNTS, characterFrame, type CharacterPose, type CharacterState } from './characterStandard'
import { appearanceKey, composedCharacter } from './characterCompositor'
import type { StandardCharacter } from './characters'
import type { Direction } from './world'

type Entry = { keys: Partial<Record<CharacterState,Record<Direction,string[]>>>; users: number; age: number }
type SceneCache = { entries: Map<string,Entry>; serial: number }
const caches = new WeakMap<Phaser.Scene,SceneCache>()
let textureSequence = 0
const images = new WeakMap<Phaser.GameObjects.Image,{ entry: Entry; character: StandardCharacter }>()
export const CHARACTER_TEXTURE_CACHE_LIMIT = 32
function sceneCache(scene: Phaser.Scene) {
  let cache = caches.get(scene)
  if (!cache) {
    cache={ entries:new Map(), serial:0 }; caches.set(scene,cache)
    const owned = cache
    scene.events.once('shutdown',()=>{
      for (const entry of owned.entries.values()) for (const directions of Object.values(entry.keys)) for (const keys of Object.values(directions)) for (const key of keys) if (scene.textures.exists(key)) scene.textures.remove(key)
      owned.entries.clear(); caches.delete(scene)
    })
  }
  return cache
}
function prune(scene: Phaser.Scene, cache: SceneCache) {
  for (const [key,entry] of [...cache.entries].sort((a,b)=>a[1].age-b[1].age)) {
    if (cache.entries.size <= CHARACTER_TEXTURE_CACHE_LIMIT) break
    if (!entry.users) { for (const directions of Object.values(entry.keys)) for (const keys of Object.values(directions)) for (const texture of keys) scene.textures.remove(texture); cache.entries.delete(key) }
  }
}
function acquire(scene: Phaser.Scene, character: StandardCharacter): Entry {
  const cache=sceneCache(scene), key=appearanceKey(character.appearance)
  let entry=cache.entries.get(key)
  if (!entry) {
    const sequence=++textureSequence, keys: Entry['keys']={}
    for (const [state,count] of Object.entries(CHARACTER_FRAME_COUNTS) as [CharacterState,number][]) {
      const directions={} as Record<Direction,string[]>; keys[state]=directions
      for (const direction of CHARACTER_DIRECTIONS) directions[direction]=[]
      for (let frame=0;frame<count;frame++) for (const direction of CHARACTER_DIRECTIONS) {
        const sprites=composedCharacter(character.appearance,state,frame)
        const textureKey=`character-${sequence}-${state}-${frame}-${direction}`, texture=scene.textures.createCanvas(textureKey,48,48)
        if (!texture) throw new Error(`Cannot create ${textureKey}`)
        texture.context.imageSmoothingEnabled=false
        texture.context.putImageData(new ImageData(sprites[direction],48,48),0,0)
        texture.refresh(); texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
        directions[direction].push(textureKey)
      }
    }
    entry={ keys,users:0,age:sequence }; cache.entries.set(key,entry)
  }
  entry.users++; entry.age=++cache.serial; prune(scene,cache); return entry
}
export function createCharacterImage(scene: Phaser.Scene, character: StandardCharacter, facing: Direction) {
  const entry=acquire(scene,character), { groundAnchor,canvas,renderScale }=CHARACTER_STANDARD
  const image=scene.add.image(0,CHARACTER_GROUND_OFFSET_Y,entry.keys.idle![facing][0])
    .setOrigin(groundAnchor.x/canvas.width,groundAnchor.y/canvas.height).setScale(renderScale)
  images.set(image,{entry,character})
  image.once('destroy',()=>{ const current=images.get(image); if (current) { current.entry.users--; images.delete(image); const cache=caches.get(scene); if (cache) prune(scene,cache) } })
  return image
}
export function updateCharacterAppearance(image: Phaser.GameObjects.Image, character: StandardCharacter, direction: Direction) {
  const current=images.get(image)
  if (!current) throw new Error('Unregistered character image')
  if (appearanceKey(current.character.appearance) !== appearanceKey(character.appearance)) {
    const next=acquire(image.scene,character)
    image.setTexture(next.keys.idle![direction][0]); current.entry.users--
    images.set(image,{entry:next,character}); prune(image.scene,sceneCache(image.scene))
  }
}
export function setCharacterPose(image: Phaser.GameObjects.Image, pose: CharacterPose) {
  const entry=images.get(image)?.entry
  if (!entry) throw new Error('Unregistered character image')
  const resolved=characterFrame(pose), key=entry.keys[resolved.state]![pose.direction][resolved.frame]
  if (image.texture.key !== key) image.setTexture(key)
}
export function characterTextureCacheSize(scene: Phaser.Scene) { return sceneCache(scene).entries.size }
