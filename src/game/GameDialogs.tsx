import { useState, type ReactNode } from 'react'
import { FisherPortrait } from './FisherPortrait'
import { CATEGORIES, ITEMS, ITEM_BY_ID, FISH_SELL_PRICES, SHOP_PRICES, type BaitId, type FishItemId, type ItemCategory, type ItemId } from './items'
import type { Inventory } from './persistence'
import { HAIR_COLORS, SHIRT_COLORS, SKIN_COLORS, type Appearance } from './world'

export function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <section role="dialog" aria-label={title} aria-modal="true" className={`pocket-dialog ${className}`}>
    <header className="dialog-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></header>
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

export function InventoryDialog({ inventory, chest, pending, error, onBait, onTransfer }: {
  inventory: Inventory; chest: boolean; pending: boolean; error: string
  onBait: (id: BaitId | null) => void; onTransfer: (id: ItemId, toStorage: boolean) => void
}) {
  const [category, setCategory] = useState<ItemCategory>('equipment')
  const [location, setLocation] = useState<'bag' | 'storage'>('bag')
  const [page, setPage] = useState(0)
  const entries = ITEMS.filter(item => item.category === category && (inventory[location][item.id] ?? 0) > 0)
  const count = Math.max(1, Math.ceil(entries.length / 2))
  const safePage = Math.min(page, count - 1)
  return <Panel title={chest ? 'Oppbevaringskiste' : 'Sekken'} subtitle={`${inventory.coins} mynter`}>
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
          {chest && item.category !== 'key' && <button disabled={pending} onClick={() => onTransfer(item.id, location === 'bag')}>{location === 'bag' ? 'Legg i kiste' : 'Ta i sekk'}</button>}
        </div>
      </article>)}
    </div>
    <footer className="dialog-footer"><p>Agn: {inventory.equippedBait ? ITEM_BY_ID[inventory.equippedBait].name : 'Ingen'}</p><Pager page={safePage} count={count} onChange={setPage} /></footer>
  </Panel>
}

export function ShopDialog({ inventory, pending, error, onBuy, onSell }: { inventory: Inventory; pending: boolean; error: string; onBuy: (bait: BaitId, amount: number) => void; onSell: (fish: FishItemId, amount: number) => void }) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [page, setPage] = useState(0)
  const baits = Object.keys(SHOP_PRICES) as BaitId[]
  const fish = ITEMS.filter(item => item.category === 'fish' && (inventory.bag[item.id] ?? 0) > 0)
  const count = Math.max(1, Math.ceil((mode === 'buy' ? baits.length : fish.length) / 2))
  const safePage = Math.min(page, count - 1)
  return <Panel title="Agnbutikken" subtitle={`${inventory.coins} mynter`}>
    <div className="dialog-tabs" role="tablist" aria-label="Handel">
      <button role="tab" aria-selected={mode === 'buy'} disabled={pending} onClick={() => { setMode('buy'); setPage(0) }}>Kjøp agn</button>
      <button role="tab" aria-selected={mode === 'sell'} disabled={pending} onClick={() => { setMode('sell'); setPage(0) }}>Selg fisk</button>
    </div>
    {error && <p role="alert" className="dialog-error">{error}</p>}
    <div className="dialog-items">
      {mode === 'buy' ? baits.slice(safePage * 2, safePage * 2 + 2).map(bait => <article className="inventory-item" key={bait}>
        <div><h3>{ITEM_BY_ID[bait].icon} {ITEM_BY_ID[bait].name}</h3><p>{ITEM_BY_ID[bait].description}</p><strong>{SHOP_PRICES[bait]} mynter / stk.</strong></div>
        <div className="item-actions">{[1, 5].map(n => <button key={n} disabled={pending || inventory.coins < SHOP_PRICES[bait] * n} onClick={() => onBuy(bait, n)}>Kjøp {n}</button>)}</div>
      </article>) : !fish.length ? <p className="dialog-empty">Ingen fisk i sekken. Fang fisk eller hent dem fra kisten før du selger.</p>
        : fish.slice(safePage * 2, safePage * 2 + 2).map(item => {
          const id = item.id as FishItemId, owned = inventory.bag[id] ?? 0, price = FISH_SELL_PRICES[id]
          return <article className="inventory-item" key={id}>
            <div><h3>{item.icon} {item.name} <span>×{owned}</span></h3><strong>{price} mynter / stk.</strong></div>
            <div className="item-actions">
              <button disabled={pending || inventory.coins + price > 1000000} onClick={() => onSell(id, 1)}>Selg 1</button>
              {owned > 1 && <button disabled={pending || inventory.coins + price * owned > 1000000} onClick={() => onSell(id, owned)}>Selg alle ({owned})</button>}
            </div>
          </article>
        })}
    </div>
    <footer className="dialog-footer"><span>{mode === 'buy' ? 'Velg agn i sekken etter kjøpet' : 'Selg fangsten for å tjene mynter'}</span><Pager page={safePage} count={count} onChange={setPage} /></footer>
  </Panel>
}

export function WardrobeDialog({ appearance, pending, onPreview, onSave }: { appearance: Appearance; pending: boolean; onPreview: (a: Appearance) => void; onSave: () => void }) {
  return <Panel title="Garderoben">
    <div className="wardrobe-content">
      <div className="wardrobe-preview"><FisherPortrait appearance={appearance} /><FisherPortrait appearance={appearance} direction="right" /><FisherPortrait appearance={appearance} direction="up" /></div>
      <div className="wardrobe-colors">
        {([['Klær og hattebånd', 'shirt', SHIRT_COLORS], ['Hår', 'hair', HAIR_COLORS], ['Hudtone', 'skin', SKIN_COLORS]] as const).map(([label, key, colors]) => <fieldset key={key}>
          <legend>{label}</legend><div className="color-options">{colors.map((color, index) => <button key={index} disabled={pending} aria-label={`${label} ${index + 1}`} aria-pressed={appearance[key] === index} onClick={() => onPreview({ ...appearance, [key]: index })} style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}>{appearance[key] === index && <span aria-hidden="true">✓</span>}</button>)}</div>
        </fieldset>)}
      </div>
    </div>
    <footer className="dialog-footer wardrobe-footer"><span>B / Esc: tilbake</span><button disabled={pending} onClick={onSave}>{pending ? 'Lagrer …' : 'Lagre utseende'}</button></footer>
  </Panel>
}
