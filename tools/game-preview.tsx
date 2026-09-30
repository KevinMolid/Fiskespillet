import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import GamePage, { type GameServices } from '../src/game/GamePage'
import { DEFAULT_APPEARANCE, START, type Position } from '../src/game/world'
import type { Inventory } from '../src/game/persistence'
import '../src/style.css'

// This entry is served only by the dev server and uses in-memory services.
// The actual GamePage, dialogs and Phaser scene are exercised without account writes.
let savedPosition = { ...START }
let savedAppearance = { ...DEFAULT_APPEARANCE }
let inventory: Inventory = { bag: { rod: 1, shovel: 1, bread: 3, worm: 5 }, storage: {}, equippedBait: 'bread', coins: 60 }
const snapshot = () => structuredClone(inventory)
const services: GameServices = {
  loadPosition: async () => ({ ...savedPosition }),
  loadAppearance: async () => ({ ...savedAppearance }),
  loadFishBook: async () => [], loadInventory: async () => snapshot(),
  savePosition: async (_uid, p) => {
    const output = document.querySelector('#preview-position')
    if (output) output.textContent = `${p.mapId}: ${p.x}, ${p.y} (${p.facing})`
  },
  saveAppearance: async (_uid, a) => { savedAppearance = { ...a } },
  setEquippedBait: async (_uid, bait) => { inventory = { ...inventory, equippedBait: bait }; return snapshot() },
  transferItem: async () => { throw new Error('Oppbevaring testes i det ordinære spillet.') },
  buyBait: async () => { throw new Error('Kjøp testes i det ordinære spillet.') },
  digForWorms: async () => ({ inventory: snapshot(), amount: 2 }),
  recordEncounter: async () => snapshot(),
}

function Preview() {
  const [revision, setRevision] = useState(0)
  function go(position: Position) {
    savedPosition = { ...position }
    setRevision(current => current + 1)
  }
  return <main className="mx-auto max-w-4xl px-4 py-5 text-white">
    <h1 className="text-xl font-bold">Fiskespillet · meny og fisker</h1>
    <p className="mt-1 text-xs text-slate-300">Lokal forhåndsvisning. Prøv Enter, Sekk, Fiskebok og garderoben. Ingen endringer lagres til kontoen.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="game-hud-button" onClick={() => go(START)}>Bryggehavn</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'havn', x: 46, y: 16, facing: 'right' })}>Ved kartgrensen</button>
      <button className="game-hud-button" onClick={() => go({ mapId: 'hjem2', x: 4, y: 9, facing: 'left' })}>Ved garderoben</button>
    </div>
    <GamePage key={revision} user={{ uid: 'local-preview' }} services={services} />
    <p className="text-xs text-slate-400">Testposisjon: <output id="preview-position">{savedPosition.mapId}: {savedPosition.x}, {savedPosition.y}</output></p>
  </main>
}
document.body.style.background = '#172e30'
const root = createRoot(document.querySelector('#root')!)
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
