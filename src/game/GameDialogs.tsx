import { useState, type ReactNode } from 'react'
import { FisherPortrait } from './FisherPortrait'
import { CATEGORIES, ITEMS, ITEM_BY_ID, SHOP_PRICES, type BaitId, type ItemCategory, type ItemId } from './items'
import type { FishBookEntry, Inventory } from './persistence'
import { availableZones, compatibleBaits, weightRange } from './fish'
import { FISH, formatWeight, HAIR_COLORS, SHIRT_COLORS, SKIN_COLORS, type Appearance } from './world'

function Panel({ title, subtitle, onClose, disabled, children, className = '' }: { title: string; subtitle?: string; onClose: () => void; disabled?: boolean; children: ReactNode; className?: string }) {
  return <section role="dialog" aria-label={title} aria-modal="true" className={`pocket-dialog ${className}`}>
    <header className="dialog-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button disabled={disabled} onClick={onClose}>Tilbake</button></header>
    {children}
  </section>
}

function Pager({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  return <nav className="dialog-pager" aria-label="Sider">
    <button aria-label="Forrige side" disabled={page <= 0} onClick={() => onChange(page - 1)}>◀</button>
    <span aria-live="polite">{page + 1} / {Math.max(1, count)}</span>
    <button aria-label="Neste side" disabled={page >= count - 1} onClick={() => onChange(page + 1)}>▶</button>
  </nav>
}

export function InventoryDialog({ inventory, chest, pending, error, onClose, onBait, onTransfer }: {
  inventory: Inventory; chest: boolean; pending: boolean; error: string; onClose: () => void
  onBait: (id: BaitId | null) => void; onTransfer: (id: ItemId, toStorage: boolean) => void
}) {
  const [category, setCategory] = useState<ItemCategory>('equipment')
  const [location, setLocation] = useState<'bag' | 'storage'>('bag')
  const [page, setPage] = useState(0)
  const entries = ITEMS.filter(item => item.category === category && (inventory[location][item.id] ?? 0) > 0)
  const count = Math.max(1, Math.ceil(entries.length / 2))
  const safePage = Math.min(page, count - 1)
  return <Panel title={chest ? 'Oppbevaringskiste' : 'Sekken'} subtitle={`${inventory.coins} mynter`} onClose={onClose} disabled={pending}>
    <div className="inventory-filters">
      {chest && <div className="dialog-tabs" role="tablist" aria-label="Oppbevaring">
        <button role="tab" aria-selected={location === 'bag'} onClick={() => { setLocation('bag'); setPage(0) }}>Sekk</button>
        <button role="tab" aria-selected={location === 'storage'} onClick={() => { setLocation('storage'); setPage(0) }}>Kiste</button>
      </div>}
      <div className="dialog-tabs category-tabs" role="tablist" aria-label="Gjenstandskategori">
        {CATEGORIES.map(c => <button key={c.id} role="tab" aria-label={c.name} aria-selected={category === c.id} onClick={() => { setCategory(c.id); setPage(0) }}>{c.id === 'consumable' ? 'Forbruk' : c.id === 'key' ? 'Nøkler' : c.name}</button>)}
      </div>
    </div>
    {error && <p role="alert" className="dialog-error">{error}</p>}
    <div className="dialog-items">
      {!entries.length && <p className="dialog-empty">Ingen gjenstander her ennå.</p>}
      {entries.slice(safePage * 2, safePage * 2 + 2).map(item => <article key={item.id} className="inventory-item">
        <div><h3>{item.icon} {item.name} <span>×{inventory[location][item.id]}</span></h3><p>{item.description}</p></div>
        <div className="item-actions">
          {location === 'bag' && item.bait && <button disabled={pending} onClick={() => onBait(inventory.equippedBait === item.id ? null : item.id as BaitId)}>{inventory.equippedBait === item.id ? 'Ta av agn' : 'Velg agn'}</button>}
          {chest && <button disabled={pending} onClick={() => onTransfer(item.id, location === 'bag')}>{location === 'bag' ? 'Legg i kiste' : 'Ta i sekk'}</button>}
        </div>
      </article>)}
    </div>
    <footer className="dialog-footer"><p>Agn: {inventory.equippedBait ? ITEM_BY_ID[inventory.equippedBait].name : 'Ingen'}</p><Pager page={safePage} count={count} onChange={setPage} /></footer>
  </Panel>
}

export function ShopDialog({ inventory, pending, error, onClose, onBuy }: { inventory: Inventory; pending: boolean; error: string; onClose: () => void; onBuy: (bait: BaitId, amount: number) => void }) {
  const [page, setPage] = useState(0)
  const baits = Object.keys(SHOP_PRICES) as BaitId[]
  return <Panel title="Agnbutikken" subtitle={`${inventory.coins} mynter · Velg agn i sekken etter kjøpet`} onClose={onClose} disabled={pending}>
    {error && <p role="alert" className="dialog-error">{error}</p>}
    <div className="dialog-items">
      {baits.slice(page * 2, page * 2 + 2).map(bait => <article className="inventory-item" key={bait}>
        <div><h3>{ITEM_BY_ID[bait].icon} {ITEM_BY_ID[bait].name}</h3><p>{ITEM_BY_ID[bait].description}</p><strong>{SHOP_PRICES[bait]} mynter / stk.</strong></div>
        <div className="item-actions">{[1, 5].map(n => <button key={n} disabled={pending || inventory.coins < SHOP_PRICES[bait] * n} onClick={() => onBuy(bait, n)}>Kjøp {n}</button>)}</div>
      </article>)}
    </div>
    <footer className="dialog-footer"><span>Fang fisk for å tjene mynter</span><Pager page={page} count={Math.ceil(baits.length / 2)} onChange={setPage} /></footer>
  </Panel>
}

export function WardrobeDialog({ appearance, pending, onPreview, onSave, onClose }: { appearance: Appearance; pending: boolean; onPreview: (a: Appearance) => void; onSave: () => void; onClose: () => void }) {
  return <Panel title="Garderoben" onClose={onClose} disabled={pending}>
    <div className="wardrobe-content">
      <div className="wardrobe-preview"><FisherPortrait appearance={appearance} /><FisherPortrait appearance={appearance} direction="right" /><FisherPortrait appearance={appearance} direction="up" /></div>
      <div className="wardrobe-colors">
        {([['Klær og hattebånd', 'shirt', SHIRT_COLORS], ['Hår', 'hair', HAIR_COLORS], ['Hudtone', 'skin', SKIN_COLORS]] as const).map(([label, key, colors]) => <fieldset key={key}>
          <legend>{label}</legend><div className="color-options">{colors.map((color, index) => <button key={index} disabled={pending} aria-label={`${label} ${index + 1}`} aria-pressed={appearance[key] === index} onClick={() => onPreview({ ...appearance, [key]: index })} style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}>{appearance[key] === index && <span aria-hidden="true">✓</span>}</button>)}</div>
        </fieldset>)}
      </div>
    </div>
    <footer className="dialog-footer wardrobe-footer"><button disabled={pending} onClick={onClose}>Avbryt</button><button disabled={pending} onClick={onSave}>{pending ? 'Lagrer …' : 'Lagre utseende'}</button></footer>
  </Panel>
}

export function FishBookDialog({ book, onClose }: { book: FishBookEntry[]; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const species = FISH[page]
  const entry = book.find(e => e.speciesId === species.id)
  const zones = availableZones(species)
  const baits = compatibleBaits(species)
  return <Panel className="fish-book-dialog" title="Fiskeboken" subtitle={'Oppdaget '+book.length+' av '+FISH.length+' arter'} onClose={onClose}>
    <div className="fish-book-layout">
      <article className="fish-details" aria-label={species.name}>
        <header className="fish-details-heading"><span className="fish-picture" role="img" aria-label={species.name}>{species.icon}</span><div><h3>{species.name}</h3><p>{species.rarity}</p><p>{weightRange(species)}</p></div></header>
        <dl className="fish-facts">
          <div><dt>Levested</dt><dd>{species.habitats.join(', ')}</dd></div>
          <div><dt>Metoder</dt><dd>{species.methods.join(', ')}</dd></div>
          <div><dt>I spillet</dt><dd>{zones.length ? zones.join(', ') : 'Ingen av dagens områder'}</dd></div>
          <div><dt>Bruk nå</dt><dd>{!zones.length ? 'Ikke tilgjengelig her ennå.' : baits.length ? baits.map(id => ITEM_BY_ID[id].name).join(', ') : 'Krever fremtidig utstyr.'}</dd></div>
        </dl>
        <div className="fish-records">{entry ? <><p>Sett {entry.seenCount} · Fanget {entry.caughtCount}</p>{entry.caughtCount > 0 && <p>Minst {formatWeight(entry.smallestGrams!)} · Størst {formatWeight(entry.largestGrams!)}</p>}</> : <p>Ikke oppdaget ennå</p>}</div>
      </article>
      <div className="fish-list" role="listbox" aria-label="Fiskearter" data-nav-list>
        {FISH.map((fish,index) => <button key={fish.id} role="option" aria-selected={index === page} tabIndex={index === page ? 0 : -1} data-autofocus={index === page ? '' : undefined}
          onFocus={event => { setPage(index); event.currentTarget.scrollIntoView({ block: 'nearest' }) }} onClick={() => setPage(index)}>
          <span>{fish.name}</span><small>{book.some(e => e.speciesId === fish.id) ? '●' : '○'}</small>
        </button>)}
      </div>
    </div>
    <footer className="fish-book-footer">↑ ↓ Velg fisk <span>{page+1} / {FISH.length}</span></footer>
  </Panel>
}
