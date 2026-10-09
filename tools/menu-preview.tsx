import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppHeader } from '../src/AppHeader'
import { AppFooter } from '../src/AppFooter'
import { StartMenu } from '../src/game/StartMenu'
import { GameMenu } from '../src/game/GameMenu'
import { InventoryDialog, ShopDialog, WardrobeDialog } from '../src/game/GameDialogs'
import { FishBookDialog } from '../src/game/FishBookDialog'
import { MobileControls } from '../src/game/MobileControls'
import { useGameInput } from '../src/game/useGameInput'
import { DEFAULT_APPEARANCE } from '../src/game/world'
import type { Inventory } from '../src/game/persistence'
import { FISH_SELL_PRICES, SHOP_PRICES, type ItemId } from '../src/game/items'
import '../src/style.css'

// The real menu components with local fixtures only. No account writes or reset.
const views = { start: 'Startmeny', pause: 'Spillmeny', bag: 'Sekk', book: 'Fiskebok', shop: 'Butikk', wardrobe: 'Garderobe' }
type View = keyof typeof views | 'world'
const params = new URLSearchParams(location.search), requested = params.get('view') as View
const initialInventory: Inventory = { bag: { rod: 1, shovel: 1, bread: 3, worm: 5, fish_makrell: 3, fish_torsk: 2, fish_mort: 1 }, storage: { bread: 5 }, equippedBait: 'bread', coins: 60 }
function Preview() {
  const [inventory, setInventory] = useState<Inventory>(() => structuredClone(initialInventory))
  const [view, setView] = useState<View>(Object.hasOwn(views, requested) ? requested : 'start')
  const [hasSave, setHasSave] = useState(params.get('saved') !== '0')
  const [look, setLook] = useState(DEFAULT_APPEARANCE)
  const [accountVisible, setAccountVisible] = useState(true)
  const [navigation, setNavigation] = useState('')
  const frame = useRef<HTMLDivElement>(null)
  const bookBack = useRef<(() => void) | null>(null)
  const close = () => setView('pause')
  function trade(id: ItemId, amount: number, coinChange: number) {
    setInventory(current => {
      const bag = { ...current.bag }, nextCount = (bag[id] ?? 0) + amount
      if (nextCount < 0 || current.coins + coinChange < 0) return current
      if (nextCount) bag[id] = nextCount
      else delete bag[id]
      return { ...current, bag, coins: current.coins + coinChange }
    })
  }
  const back = () => { if (view === 'book' && bookBack.current) bookBack.current(); else if (view === 'pause') setView('world'); else if (view !== 'world' && view !== 'start') close() }
  const input = useGameInput({ frame, context: view, modal: view !== 'start' && view !== 'world', locked: false,
    move: () => {}, moveHold: () => {}, action: () => {}, menu: () => setView(view === 'world' ? 'pause' : 'world'), back,
    utilityAllowed: false, utility: () => {} })
  return <main className="brand-app"><div className={`app-shell${view !== 'start' ? ' game-active' : ''}`}>
    <AppHeader account={accountVisible ? { name: 'Spiller' } : undefined} page={navigation === 'Spillere' ? 'players' : 'home'} onHome={() => { setView('start'); setNavigation('') }} onProfile={() => setNavigation('Min profil')} onPlayers={() => setNavigation('Spillere')} onLogout={() => { setAccountVisible(false); setNavigation('Logget ut i lokal test') }} />
    <details className="menu-preview-tools"><summary>Vis menyer · lokal test</summary><nav>{Object.entries(views).map(([id, name]) => <button key={id} onClick={() => setView(id as View)}>{name}</button>)}</nav></details>
    {navigation && <p role="status" className="text-sm py-2">{navigation}</p>}
    <div className="flex-1">
      {view === 'start' ? <StartMenu hasSave={hasSave} ready onContinue={close} onNewGame={playerVariant => { setLook({ ...DEFAULT_APPEARANCE, playerVariant }); setHasSave(false); close() }} onRetry={() => {}} />
      : <div className="game-shell"><div ref={frame} tabIndex={-1} className="game-frame relative aspect-[3/2] w-full overflow-hidden rounded-xl">
        {view === 'world' && <p className="p-5">Spillmenyen er lukket. Trykk Meny for å åpne den igjen.</p>}
        {view === 'pause' && <GameMenu inventory={inventory} appearance={look} caughtSpecies={4} speciesCount={21} onBag={() => setView('bag')} onBook={() => setView('book')} onExit={() => setView('start')} />}
        {view === 'bag' && <InventoryDialog inventory={inventory} chest={false} pending={false} error="" onBait={() => {}} onTransfer={() => {}} />}
        {view === 'book' && <FishBookDialog book={[]} onClose={close} registerBack={handler => { bookBack.current = handler }} />}
        {view === 'shop' && <ShopDialog inventory={inventory} pending={false} error="" onBuy={(id, amount) => trade(id, amount, -SHOP_PRICES[id] * amount)} onSell={(id, amount) => trade(id, -amount, FISH_SELL_PRICES[id] * amount)} />}
        {view === 'wardrobe' && <WardrobeDialog appearance={look} pending={false} onPreview={setLook} onSave={close} />}
      </div><MobileControls context={view === 'world' ? 'world' : view} onDirection={input.direction} onAction={input.action} onMenu={input.menu} onBack={input.back} actionLabel="Velg" disabled={false} actionDisabled={false} /></div>}
    </div>
    <AppFooter />
  </div></main>
}
const root = createRoot(document.querySelector('#root')!)
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
