import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppHeader } from '../src/AppHeader'
import { AppFooter } from '../src/AppFooter'
import { StartMenu } from '../src/game/StartMenu'
import { GameMenu } from '../src/game/GameMenu'
import { InventoryDialog, ShopDialog, WardrobeDialog } from '../src/game/GameDialogs'
import { FishBookDialog } from '../src/game/FishBookDialog'
import { MobileControls } from '../src/game/MobileControls'
import { DEFAULT_APPEARANCE } from '../src/game/world'
import type { Inventory } from '../src/game/persistence'
import '../src/style.css'

// The real menu components with local fixtures only. No account writes or reset.
const views = { start: 'Startmeny', pause: 'Spillmeny', bag: 'Sekk', book: 'Fiskebok', shop: 'Butikk', wardrobe: 'Garderobe' }
type View = keyof typeof views
const params = new URLSearchParams(location.search), requested = params.get('view') as View
const inventory: Inventory = { bag: { rod: 1, shovel: 1, bread: 3, worm: 5 }, storage: { bread: 5 }, equippedBait: 'bread', coins: 60 }
function Preview() {
  const [view, setView] = useState<View>(Object.hasOwn(views, requested) ? requested : 'start')
  const [hasSave, setHasSave] = useState(params.get('saved') !== '0')
  const [look, setLook] = useState(DEFAULT_APPEARANCE)
  const [accountVisible, setAccountVisible] = useState(true)
  const [navigation, setNavigation] = useState('')
  const close = () => setView('pause')
  return <main className="brand-app"><div className={`app-shell${view !== 'start' ? ' game-active' : ''}`}>
    <AppHeader account={accountVisible ? { name: 'Spiller' } : undefined} page={navigation === 'Spillere' ? 'players' : 'home'} onHome={() => { setView('start'); setNavigation('') }} onProfile={() => setNavigation('Min profil')} onPlayers={() => setNavigation('Spillere')} onLogout={() => { setAccountVisible(false); setNavigation('Logget ut i lokal test') }} />
    <details className="menu-preview-tools"><summary>Vis menyer · lokal test</summary><nav>{Object.entries(views).map(([id, name]) => <button key={id} onClick={() => setView(id as View)}>{name}</button>)}</nav></details>
    {navigation && <p role="status" className="text-sm py-2">{navigation}</p>}
    <div className="flex-1">
      {view === 'start' ? <StartMenu hasSave={hasSave} ready onContinue={close} onNewGame={() => { setHasSave(false); close() }} onRetry={() => {}} />
      : <div className="game-shell"><div className="game-frame relative aspect-[3/2] w-full overflow-hidden rounded-xl">
        {view === 'pause' && <GameMenu inventory={inventory} appearance={look} caughtSpecies={4} speciesCount={21} onBag={() => setView('bag')} onBook={() => setView('book')} onClose={() => setView('start')} />}
        {view === 'bag' && <InventoryDialog inventory={inventory} chest={false} pending={false} error="" onClose={close} onBait={() => {}} onTransfer={() => {}} />}
        {view === 'book' && <FishBookDialog book={[]} onClose={close} />}
        {view === 'shop' && <ShopDialog inventory={inventory} pending={false} error="" onClose={close} onBuy={() => {}} />}
        {view === 'wardrobe' && <WardrobeDialog appearance={look} pending={false} onPreview={setLook} onSave={close} onClose={close} />}
      </div><MobileControls context={view} onDirection={() => {}} onAction={() => { if (document.activeElement instanceof HTMLButtonElement) document.activeElement.click() }} onMenu={close} actionLabel="Velg" disabled={false} actionDisabled={false} /></div>}
    </div>
    <AppFooter />
  </div></main>
}
const root = createRoot(document.querySelector('#root')!)
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
