import { ITEM_BY_ID } from './items'
import type { Inventory } from './persistence'
import type { Appearance } from './world'
import { FisherPortrait } from './FisherPortrait'
import { GameLogo } from '../GameLogo'
import { MenuIcon } from '../MenuIcon'

type Props = {
  inventory: Inventory
  appearance: Appearance
  caughtSpecies: number
  speciesCount: number
  onBag: () => void
  onBook: () => void
  onClose: () => void
  onExit: () => void
  pending?: boolean
  error?: string
}

export function GameMenu({ inventory, appearance, caughtSpecies, speciesCount, onBag, onBook, onClose, onExit, pending = false, error = '' }: Props) {
  const bait = inventory.equippedBait
  return <section role="dialog" aria-modal="true" aria-label="Spillmeny" className="game-menu">
    <header className="game-menu-heading"><div><span>En pause ved vannet</span><h2>Spillmeny</h2></div><GameLogo className="pause-logo" /></header>
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
        <button data-autofocus disabled={pending} onClick={onBag}><span className="menu-symbol"><MenuIcon name="bag" /></span><span><strong>Sekk</strong><small>Utstyr, agn og funn</small></span><span aria-hidden="true">›</span></button>
        <button disabled={pending} onClick={onBook}><span className="menu-symbol"><MenuIcon name="book" /></span><span><strong>Fiskebok</strong><small>{caughtSpecies} av {speciesCount} arter fanget</small></span><span aria-hidden="true">›</span></button>
        <button disabled={pending} onClick={onClose}><span className="menu-symbol"><MenuIcon name="arrow" /></span><span><strong>Tilbake til spillet</strong><small>Fortsett fisketuren</small></span><span aria-hidden="true">›</span></button>
        <button disabled={pending} onClick={onExit}><span className="menu-symbol"><MenuIcon name="arrow" /></span><span><strong>Gå ut av spillet</strong><small>Til startmenyen</small></span><span aria-hidden="true">›</span></button>
      </nav>
    </div>
    {error ? <p role="alert" className="game-menu-error">{error}</p> : pending ? <p role="status" className="game-menu-hint">Lagrer spillet …</p> : <p className="game-menu-hint">↑ ↓ Velg · Enter / E Bekreft · Esc Tilbake</p>}
  </section>
}
