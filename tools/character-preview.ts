import { MARITA_CHARACTER, STANDARD_CHARACTERS, type StandardCharacter } from '../src/game/characters'
import type { Direction } from '../src/game/world'
import { playerMovementTiming } from '../src/game/playerMovement'
const names: Record<string, string> = { player: 'Spiller', kevin: 'Kevin', mor: 'Mor', far: 'Far', oda: 'Oda', magnus: 'Magnus – kraftig og helt skallet', bendik: 'Bendik', nils: 'Nils', morten: 'Morten', marita: 'Marita' }
const reviewCharacters = [MARITA_CHARACTER, ...STANDARD_CHARACTERS.filter(character => character.id !== 'marita')]
const grid = document.querySelector<HTMLDivElement>('#grid')!
const direction = document.querySelector<HTMLSelectElement>('#direction')!
const play = document.querySelector<HTMLButtonElement>('#play')!
const requestedDirection = new URLSearchParams(window.location.search).get('direction')
if (requestedDirection && ['down', 'right', 'up', 'left'].includes(requestedDirection)) direction.value = requestedDirection
let playing = true
let elapsed = 0
let lastTick = performance.now()
function previewFrame(character: StandardCharacter) {
  const facing = direction.value as Direction
  const passing = character.walkPassingFrame?.[facing]
  const phase = Math.floor(elapsed / (passing === undefined ? 220 : playerMovementTiming(false).keyboardRepeat))
  const index = passing === undefined ? phase % 2 : [0, passing - 1, 1, passing - 1][phase % 4]
  return character.walk?.[facing][index] ?? character.sprites[facing]
}
function image(character: StandardCharacter, source: string) {
  const frame = document.createElement('div'); frame.className = 'frame'
  const img = document.createElement('img'); img.src = source; img.alt = names[character.id]
  const { canvas, groundAnchor, renderScale } = character.format
  const factor = renderScale * 2
  img.style.width = `${canvas.width * factor}px`
  img.style.height = `${canvas.height * factor}px`
  img.style.left = `calc(50% - ${groundAnchor.x * factor}px)`
  img.style.top = `${144 - groundAnchor.y * factor}px`
  frame.append(img); return frame
}
function draw() {
  grid.replaceChildren()
  const facing = direction.value as Direction
  for (const character of reviewCharacters) {
    const card = document.createElement('article'); card.className = 'card'
    const title = document.createElement('h2'); title.textContent = names[character.id]; card.append(title)
    const poses = document.createElement('div'); poses.className = 'poses'
    const sources = [character.sprites[facing], ...(character.walk?.[facing] ?? [])]
    poses.style.gridTemplateColumns = `repeat(${sources.length}, 1fr)`
    sources.forEach((source, index) => {
      const column = document.createElement('div'); column.append(image(character, source))
      const label = document.createElement('div'); label.className = 'label'; label.textContent = ['Idle', 'Steg A', 'Steg B', 'Mellom C'][index]
      column.append(label); poses.append(column)
    })
    card.append(poses)
    const live = image(character, previewFrame(character)); live.classList.add('live'); live.dataset.character = character.id
    card.append(live); grid.append(card)
  }
}
direction.addEventListener('change', draw)
play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Spill av' })
setInterval(() => {
  const now = performance.now()
  const delta = now - lastTick
  lastTick = now
  if (!playing) return
  elapsed += delta
  for (const frame of document.querySelectorAll<HTMLElement>('.live')) {
    const character = reviewCharacters.find(c => c.id === frame.dataset.character)!
    const img = frame.querySelector('img')!
    const source = previewFrame(character)
    if (img.getAttribute('src') !== source) img.src = source
  }
}, 25)
draw()
