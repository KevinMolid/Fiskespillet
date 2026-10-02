import { STANDARD_CHARACTERS, type StandardCharacter } from '../src/game/characters'
import type { Direction } from '../src/game/world'
const names: Record<string, string> = { player: 'Spiller', kevin: 'Kevin', mor: 'Mor', far: 'Far', oda: 'Oda', magnus: 'Magnus – kraftig og helt skallet', bendik: 'Bendik', nils: 'Nils', morten: 'Morten' }
const grid = document.querySelector<HTMLDivElement>('#grid')!
const direction = document.querySelector<HTMLSelectElement>('#direction')!
const play = document.querySelector<HTMLButtonElement>('#play')!
let playing = true
let phase = 0
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
  for (const character of STANDARD_CHARACTERS) {
    const card = document.createElement('article'); card.className = 'card'
    const title = document.createElement('h2'); title.textContent = names[character.id]; card.append(title)
    const poses = document.createElement('div'); poses.className = 'poses'
    const sources = [character.sprites[facing], ...character.walk![facing]]
    sources.forEach((source, index) => {
      const column = document.createElement('div'); column.append(image(character, source))
      const label = document.createElement('div'); label.className = 'label'; label.textContent = ['Idle', 'Steg A', 'Steg B'][index]
      column.append(label); poses.append(column)
    })
    card.append(poses)
    const live = image(character, sources[phase + 1]); live.classList.add('live'); live.dataset.character = character.id
    card.append(live); grid.append(card)
  }
}
direction.addEventListener('change', draw)
play.addEventListener('click', () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Spill av' })
setInterval(() => {
  if (!playing) return
  phase = 1 - phase
  for (const frame of document.querySelectorAll<HTMLElement>('.live')) {
    const character = STANDARD_CHARACTERS.find(c => c.id === frame.dataset.character)!
    frame.querySelector('img')!.src = character.walk![direction.value as Direction][phase]
  }
}, 220)
draw()
