import { useEffect, useRef } from 'react'
import { ITEM_BY_ID } from './items'
import type { Inventory } from './persistence'
import type { Appearance } from './world'
import { FisherPortrait } from './FisherPortrait'

type Props = {
  inventory: Inventory
  appearance: Appearance
  caughtSpecies: number
  speciesCount: number
  onBag: () => void
  onBook: () => void
  onClose: () => void
}

export function GameMenu({ inventory, appearance, caughtSpecies, speciesCount, onBag, onBook, onClose }: Props) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = dialog.current!
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    buttons[0]?.focus()
    function keydown(event: KeyboardEvent) {
      if (!['ArrowUp', 'ArrowDown', 'Tab', 'Escape', 'Enter', ' ', 'e', 'E'].includes(event.key)) return
      event.stopPropagation()
      if (event.repeat) { event.preventDefault(); return }
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      const index = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement))
      if (['ArrowUp', 'ArrowDown', 'Tab'].includes(event.key)) {
        event.preventDefault()
        const step = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1
        buttons[(index + step + buttons.length) % buttons.length]?.focus()
      } else {
        event.preventDefault()
        buttons[index]?.click()
      }
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  }, [onClose])

  const bait = inventory.equippedBait
  return <section ref={dialog} role="dialog" aria-modal="true" aria-label="Spillmeny" className="game-menu">
    <header className="game-menu-heading"><span>En pause ved vannet</span><h2>Spillmeny</h2></header>
    <div className="game-menu-columns">
      <aside className="equipment-card" aria-label="Aktivt utstyr">
        <div className="equipment-portrait"><FisherPortrait appearance={appearance} /><span>Aktivt utstyr</span></div>
        <dl>
          <div><dt>Stang</dt><dd>{inventory.bag.rod ? 'Fiskestang' : 'Ingen'}</dd></div>
          <div><dt>Redskap</dt><dd>{inventory.bag.shovel ? 'Spade' : 'Ingen'}</dd></div>
          <div><dt>Agn</dt><dd>{bait ? `${ITEM_BY_ID[bait].name} ×${inventory.bag[bait] ?? 0}` : 'Ingen valgt'}</dd></div>
        </dl>
        <p className="menu-coins">{inventory.coins} <span>mynter</span></p>
      </aside>
      <nav className="game-menu-list" aria-label="Menyvalg">
        <button onClick={onBag}><span className="menu-symbol" aria-hidden="true">🎒</span><span><strong>Sekk</strong><small>Utstyr, agn og funn</small></span><span aria-hidden="true">›</span></button>
        <button onClick={onBook}><span className="menu-symbol" aria-hidden="true">📖</span><span><strong>Fiskebok</strong><small>{caughtSpecies} av {speciesCount} arter fanget</small></span><span aria-hidden="true">›</span></button>
        <button onClick={onClose}><span className="menu-symbol" aria-hidden="true">↩</span><span><strong>Tilbake til spillet</strong><small>Fortsett fisketuren</small></span><span aria-hidden="true">›</span></button>
      </nav>
    </div>
    <p className="game-menu-hint">↑ ↓ Velg · Enter / E Bekreft · Esc Tilbake</p>
  </section>
}
