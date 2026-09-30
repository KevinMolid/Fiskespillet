import { useCallback, useEffect, useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import { createWorld, type WorldScene } from './WorldScene'
import * as persistence from './persistence'
import { type FishBookEntry, type Inventory } from './persistence'
import { GameMenu } from './GameMenu'
import { PlaceNotice } from './PlaceNotice'
import { FisherPortrait } from './FisherPortrait'
import { CATEGORIES, FISH_REWARDS, ITEMS, ITEM_BY_ID, SHOP_PRICES, type BaitId, type ItemCategory, type ItemId } from './items'
import { canFish, DEFAULT_APPEARANCE, FISH, formatWeight, HAIR_COLORS, interactionAhead, MAPS, rollFish, SHIRT_COLORS, SKIN_COLORS, type Appearance, type Direction, type Position } from './world'

type Result = { name: string; icon: string; grams: number; caught: boolean; coins: number }

export type GameServices = Pick<typeof persistence, 'buyBait' | 'digForWorms' | 'loadAppearance' | 'loadFishBook' | 'loadInventory' | 'loadPosition' | 'recordEncounter' | 'saveAppearance' | 'savePosition' | 'setEquippedBait' | 'transferItem'>

export default function GamePage({ user, services = persistence }: { user: Pick<User, 'uid'>; services?: GameServices }) {
  const { buyBait, digForWorms, loadAppearance, loadFishBook, loadInventory, loadPosition, recordEncounter, saveAppearance, savePosition, setEquippedBait, transferItem } = services
  const canvasParent = useRef<HTMLDivElement>(null)
  const gameFrame = useRef<HTMLDivElement>(null)
  const scene = useRef<WorldScene | null>(null)
  const saveTimer = useRef<number | null>(null)
  const castTimer = useRef<number | null>(null)
  const casting = useRef(false)
  const interacting = useRef(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [book, setBook] = useState<FishBookEntry[]>([])
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [inventoryView, setInventoryView] = useState<'bag' | 'chest' | null>(null)
  const [showShop, setShowShop] = useState(false)
  const [itemCategory, setItemCategory] = useState<ItemCategory>('equipment')
  const [inventoryPending, setInventoryPending] = useState(false)
  const [inventoryError, setInventoryError] = useState('')
  const [appearance, setAppearance] = useState<Appearance | null>(null)
  const [draftLook, setDraftLook] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [showWardrobe, setShowWardrobe] = useState(false)
  const [wardrobeCursor, setWardrobeCursor] = useState({ row: 0, column: 0 })
  const [savingLook, setSavingLook] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyText, setBusyText] = useState('Du kastet ut snøret … Vent på napp!')
  const [result, setResult] = useState<Result | null>(null)
  const [showBook, setShowBook] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const closeMenu = useCallback(() => {
    setShowMenu(false)
    window.requestAnimationFrame(() => gameFrame.current?.focus({ preventScroll: true }))
  }, [])
  const [signMessage, setSignMessage] = useState<{ title: string; text: string } | null>(null)
  const uiBlocked = showMenu || showBook || showWardrobe || Boolean(inventoryView) || showShop || inventoryPending || savingLook || Boolean(result) || Boolean(error) || Boolean(signMessage) || busy

  useEffect(() => {
    scene.current?.setUiBlocked(uiBlocked)
  }, [uiBlocked, position])

  useEffect(() => {
    if (!inventoryView && !showBook && !showShop && !showWardrobe) return
    const dialog = gameFrame.current?.querySelector<HTMLElement>('[role="dialog"]')
    dialog?.querySelector<HTMLButtonElement>(showWardrobe ? 'button[aria-pressed="true"]' : 'button:not(:disabled)')?.focus()
    function trapTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog) return
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      if (!buttons.length) return
      event.preventDefault()
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
    }
    window.addEventListener('keydown', trapTab, true)
    return () => window.removeEventListener('keydown', trapTab, true)
  }, [inventoryView, showBook, showShop, showWardrobe])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (event.repeat && ['Enter', 'Escape', 'e', 'E', ' '].includes(event.key)) { event.preventDefault(); return }
      if (showMenu && !showBook && !inventoryView) return // The menu owns focus and selection.
      if (showBook && event.key === 'Escape') setShowBook(false)
      else if (inventoryView && event.key === 'Escape' && !inventoryPending) setInventoryView(null)
      else if (showShop && event.key === 'Escape' && !inventoryPending) setShowShop(false)
      else if (showWardrobe) {
        if (!['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'e', 'E', ' ', 'Enter'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        if (savingLook) return
        if (event.key === 'Escape') closeWardrobe()
        else if (event.key.startsWith('Arrow')) {
          setWardrobeCursor(current => {
            const row = event.key === 'ArrowUp' ? Math.max(0, current.row - 1)
              : event.key === 'ArrowDown' ? Math.min(3, current.row + 1) : current.row
            const maxColumn = row === 2 ? SKIN_COLORS.length - 1 : row === 3 ? 1 : 4
            const column = event.key === 'ArrowLeft' ? Math.max(0, current.column - 1)
              : event.key === 'ArrowRight' ? Math.min(maxColumn, current.column + 1)
                : Math.min(current.column, maxColumn)
            return { row, column }
          })
        } else if (!event.repeat) {
          if (wardrobeCursor.row === 3) {
            if (wardrobeCursor.column === 0) void confirmLook()
            else closeWardrobe()
          } else {
            const key = (['shirt', 'hair', 'skin'] as const)[wardrobeCursor.row]
            previewLook({ ...draftLook, [key]: wardrobeCursor.column })
          }
        }
      }
      else if ((result || error || signMessage) && ['Enter', ' ', 'e', 'E'].includes(event.key)) {
        event.preventDefault()
        setResult(null)
        setError('')
        setSignMessage(null)
      }
      else if (event.key === 'Enter' && !showBook && !inventoryView && !showShop && !busy && position && inventory) {
        // Let unrelated page buttons retain their normal Enter action.
        if (event.target instanceof HTMLElement && event.target.closest('button, a') && !gameFrame.current?.contains(event.target)) return
        event.preventDefault()
        scene.current?.setUiBlocked(true)
        setShowMenu(true)
      }
      else return
      if (['Escape', 'Enter', 'e', 'E', ' '].includes(event.key)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [showMenu, showBook, showWardrobe, inventoryView, showShop, inventoryPending, savingLook, wardrobeCursor, draftLook, result, error, signMessage, appearance, busy, position, inventory])

  useEffect(() => {
    let active = true
    Promise.all([loadPosition(user.uid), loadFishBook(user.uid), loadAppearance(user.uid), loadInventory(user.uid)]).then(([saved, entries, look, items]) => {
      if (!active) return
      setPosition(saved)
      setBook(entries)
      setAppearance(look)
      setDraftLook(look)
      setInventory(items)
    }).catch(() => {
      if (active) setError('Kunne ikke laste spillet. Kontroller Firestore-tilgangen og prøv å laste siden på nytt.')
    })
    return () => { active = false }
  }, [user.uid])

  useEffect(() => {
    if (!canvasParent.current || !position || !appearance || !inventory || scene.current) return
    const { game, scene: world } = createWorld(canvasParent.current, position, appearance, {
      onPosition(next, transitioned) {
        setPosition(next)
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          void savePosition(user.uid, next).catch(() => setError('Kunne ikke lagre posisjonen. Sjekk tilkoblingen.'))
          saveTimer.current = null
        }, transitioned ? 0 : 1200)
      },
      onShop() {
        setInventoryError('')
        setShowShop(true)
      },
      onStorage() {
        setInventoryError('')
        setItemCategory('equipment')
        setInventoryView('chest')
      },
      onDig(spotId) {
        if (interacting.current) return
        interacting.current = true
        setBusyText('Du graver i jorden …')
        setBusy(true)
        void digForWorms(user.uid, spotId)
          .then(({ inventory: next, amount }) => {
            setInventory(next)
            setSignMessage({ title: 'Du gravde i jorden', text: `Du fant ${amount} mark! De ligger nå i sekken.` })
          })
          .catch(cause => setError(cause instanceof Error ? cause.message : 'Kunne ikke grave nå.'))
          .finally(() => { interacting.current = false; setBusy(false) })
      },
      onWardrobe() {
        setDraftLook(currentLook.current)
        setWardrobeCursor({ row: 0, column: currentLook.current.shirt })
        setShowWardrobe(true)
      },
      onSign(sign) {
        setSignMessage(sign)
      },
      onFishing() {
        if (casting.current) return
        if (!(currentInventory.current?.bag.rod ?? 0)) {
          setError('Du trenger en fiskestang i sekken for å fiske.')
          world.finishFishing()
          return
        }
        const activeBait = currentInventory.current?.equippedBait
        if (!activeBait || !(currentInventory.current?.bag[activeBait] ?? 0)) {
          setError('Du må velge et agn i sekken før du kan fiske.')
          world.finishFishing()
          return
        }
        casting.current = true
        setBusyText('Du kastet ut snøret … Vent på napp!')
        setBusy(true)
        setResult(null)
        setError('')
        castTimer.current = window.setTimeout(() => {
          const nextZone = worldPosition.current?.mapId
          const zoneId = nextZone && MAPS[nextZone].fishingZone
          if (!zoneId) {
            casting.current = false
            setBusy(false)
            world.finishFishing()
            return
          }
          const fish = rollFish(zoneId, activeBait)
          void recordEncounter(user.uid, fish.species.id, fish.grams, fish.caught, activeBait)
            .then(nextInventory => {
              setInventory(nextInventory)
              setResult({ name: fish.species.name, icon: fish.species.icon, grams: fish.grams, caught: fish.caught, coins: fish.caught ? FISH_REWARDS[fish.species.id] ?? 0 : 0 })
              return loadFishBook(user.uid).then(setBook).catch(() => {
                setError('Fangsten er lagret, men fiskeboken kunne ikke lastes på nytt.')
              })
            })
            .catch(cause => setError(cause instanceof Error ? cause.message : 'Fisketuren kunne ikke lagres. Prøv igjen.'))
            .finally(() => {
              casting.current = false
              setBusy(false)
              world.finishFishing()
            })
        }, 850)
      },
    })
    scene.current = world
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        if (worldPosition.current) void savePosition(user.uid, worldPosition.current).catch(() => {})
      }
      if (castTimer.current !== null) window.clearTimeout(castTimer.current)
      casting.current = false
      interacting.current = false
      scene.current = null
      game.destroy(true)
    }
  // The Phaser scene must be created once after the saved position loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(position), Boolean(appearance), Boolean(inventory), user.uid])

  const currentInventory = useRef(inventory)
  currentInventory.current = inventory
  const currentLook = useRef(appearance ?? DEFAULT_APPEARANCE)
  currentLook.current = appearance ?? DEFAULT_APPEARANCE

  function closeWardrobe() {
    scene.current?.setAppearance(currentLook.current)
    setShowWardrobe(false)
  }

  function previewLook(next: Appearance) {
    setDraftLook(next)
    scene.current?.setAppearance(next)
  }

  async function confirmLook() {
    setSavingLook(true)
    try {
      await saveAppearance(user.uid, draftLook)
      setAppearance(draftLook)
      setShowWardrobe(false)
    } catch {
      setError('Kunne ikke lagre figurens utseende. Prøv igjen.')
      scene.current?.setAppearance(currentLook.current)
      setShowWardrobe(false)
    } finally {
      setSavingLook(false)
    }
  }

  async function updateInventory(operation: () => Promise<Inventory>) {
    setInventoryPending(true)
    setInventoryError('')
    try {
      setInventory(await operation())
    } catch (cause) {
      setInventoryError(cause instanceof Error ? cause.message : 'Kunne ikke oppdatere inventaret.')
    } finally {
      setInventoryPending(false)
    }
  }

  const worldPosition = useRef(position)
  worldPosition.current = position
  const map = position ? MAPS[position.mapId] : null
  const canFishNow = Boolean(inventory?.bag.rod && inventory.equippedBait && inventory.bag[inventory.equippedBait])
  const target = position ? interactionAhead(position) : null
  const actionLabel = !position || uiBlocked ? null
    : target?.npc ? 'Snakk'
      : target?.tile === 'wardrobe' ? 'Skift klær'
        : target?.tile === 'chest' ? 'Åpne kiste'
          : target?.tile === 'shopCounter' ? 'Handle'
            : target?.tile === 'soil' && inventory?.bag.shovel ? 'Grav'
              : target?.sign ? 'Les'
                : canFish(position) && canFishNow ? 'Fisk' : null
  const caughtSpecies = book.filter(entry => entry.caughtCount > 0).length

  return <div className="py-6">
    <div ref={gameFrame} tabIndex={-1} className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border-4 border-[#27474a] bg-[#183a36] shadow-2xl">
      <div ref={canvasParent} className="absolute inset-0 [&_canvas]:block" aria-label="Spillkart" />

      {map && <PlaceNotice key={map.id} name={map.name} />}

      {!showMenu && !showBook && !showWardrobe && !inventoryView && !showShop && <>
        {!position && <p role="status" className="absolute left-4 top-4 text-white">Laster kart …</p>}
        {actionLabel && <button onClick={() => scene.current?.action()} className="context-action">{actionLabel}</button>}

        {(error || busy || result || signMessage) && <div role={error ? 'alert' : 'status'} className="absolute inset-x-2 bottom-2 min-h-16 border-4 border-[#405e59] bg-[#f7f4df] p-2 text-sm font-semibold text-[#233b3a] shadow-[0_4px_0_#122b29] sm:inset-x-5 sm:bottom-5 sm:min-h-24 sm:p-4 sm:text-lg">
          {error ? <p>{error}</p>
            : busy ? <p>{busyText}</p>
              : result ? <p>{result.icon} {result.caught
                ? `Du fanget en ${result.name}! Den veier ${formatWeight(result.grams)}. +${result.coins} mynter.`
                : `En ${result.name} bet på, men slapp unna!`}</p>
                : signMessage && <p><strong>{signMessage.title}</strong><br />{signMessage.text}</p>}
          {(error || result || signMessage) && <button onClick={() => { setError(''); setResult(null); setSignMessage(null) }} className="absolute bottom-1 right-2 text-xs font-bold sm:bottom-2 sm:right-4 sm:text-sm">Videre ▼</button>}
        </div>}
      </>}

      {showMenu && !inventoryView && !showBook && inventory && appearance && <GameMenu
        inventory={inventory} appearance={appearance} caughtSpecies={caughtSpecies} speciesCount={FISH.length}
        onBag={() => { setInventoryError(''); setItemCategory('equipment'); setInventoryView('bag') }}
        onBook={() => setShowBook(true)} onClose={closeMenu}
      />}

      {inventoryView && inventory && <section role="dialog" aria-label={inventoryView === 'chest' ? 'Oppbevaringskiste' : 'Inventar'} aria-modal="true" className="absolute inset-0 overflow-y-auto bg-[#e5e5c9] p-3 text-[#233b3a] sm:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest">{inventoryView === 'chest' ? 'Soverommet' : 'Figuren din'}</p><h2 className="text-2xl font-black">{inventoryView === 'chest' ? 'Oppbevaringskiste' : 'Sekken'}</h2></div>
            <button onClick={() => setInventoryView(null)} disabled={inventoryPending} className="rounded-md border-2 border-[#38564d] bg-[#f7f4df] px-3 py-2 text-sm font-bold disabled:opacity-50">{showMenu ? '← Spillmeny' : 'Lukk ✕'}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Gjenstandskategori">
            {CATEGORIES.map(category => <button key={category.id} role="tab" aria-selected={itemCategory === category.id} onClick={() => setItemCategory(category.id)} className={`rounded border-2 px-2 py-1 text-xs font-bold sm:text-sm ${itemCategory === category.id ? 'border-[#38564d] bg-[#225c66] text-white' : 'border-[#73897a] bg-[#f7f4df]'}`}>{category.name}</button>)}
          </div>
          {inventoryError && <p role="alert" className="mt-3 rounded bg-red-100 p-2 text-sm text-red-900">{inventoryError}</p>}
          <div className={`mt-3 grid gap-3 ${inventoryView === 'chest' ? 'sm:grid-cols-2' : ''}`}>
            {(['bag', ...(inventoryView === 'chest' ? ['storage'] as const : [])] as const).map(location => {
              const entries = ITEMS.filter(item => item.category === itemCategory && (inventory[location][item.id] ?? 0) > 0)
              return <div key={location} className="border-2 border-[#73897a] bg-[#f7f4df] p-3">
                <h3 className="mb-2 font-black">{location === 'bag' ? 'Sekk' : 'Kiste'}</h3>
                {entries.length === 0 && <p className="text-sm">Ingen gjenstander i denne kategorien.</p>}
                {entries.map(item => <div key={item.id} className="flex items-center justify-between gap-2 border-t border-[#adbca9] py-2 text-sm">
                  <div><p className="font-bold">{item.icon} {item.name} ×{inventory[location][item.id]}</p><p className="text-xs">{item.description}</p></div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {location === 'bag' && item.bait && <button disabled={inventoryPending} onClick={() => void updateInventory(() => setEquippedBait(user.uid, inventory.equippedBait === item.id ? null : item.id as BaitId))} className="rounded bg-[#225c66] px-2 py-1 text-xs font-bold text-white disabled:opacity-50">{inventory.equippedBait === item.id ? 'Ta av agn' : 'Velg agn'}</button>}
                    {inventoryView === 'chest' && <button disabled={inventoryPending} onClick={() => void updateInventory(() => transferItem(user.uid, item.id as ItemId, location === 'bag'))} className="rounded border border-[#38564d] px-2 py-1 text-xs font-bold disabled:opacity-50">{location === 'bag' ? 'Legg i kiste' : 'Ta i sekk'}</button>}
                  </div>
                </div>)}
              </div>
            })}
          </div>
          <p className="mt-3 text-xs">Valgt agn: {inventory.equippedBait ? ITEM_BY_ID[inventory.equippedBait].name : 'Ingen'} · Ett agn brukes per kast. Du må velge agn for å fiske. · {inventory.coins} mynter</p>
        </div>
      </section>}

      {showShop && inventory && <section role="dialog" aria-label="Agnbutikken" aria-modal="true" className="absolute inset-0 overflow-y-auto bg-[#e5e5c9] p-3 text-[#233b3a] sm:p-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest">Bryggehavn</p><h2 className="text-2xl font-black">Agnbutikken</h2><p className="text-sm font-bold">🪙 {inventory.coins} mynter</p></div>
            <button onClick={() => setShowShop(false)} disabled={inventoryPending} className="rounded-md border-2 border-[#38564d] bg-[#f7f4df] px-3 py-2 text-sm font-bold disabled:opacity-50">Lukk ✕</button></div>
          <p className="mt-3 text-sm">Velkommen! Fang fisk for å tjene mynter, og velg agn i sekken etter kjøpet.</p>
          {inventoryError && <p role="alert" className="mt-2 rounded bg-red-100 p-2 text-sm text-red-900">{inventoryError}</p>}
          <div className="mt-3 grid gap-2">
            {(Object.keys(SHOP_PRICES) as BaitId[]).map(bait => <div key={bait} className="flex items-center justify-between gap-2 border-2 border-[#73897a] bg-[#f7f4df] p-2 text-sm">
              <div><p className="font-black">{ITEM_BY_ID[bait].icon} {ITEM_BY_ID[bait].name}</p><p className="text-xs">{ITEM_BY_ID[bait].description} · {SHOP_PRICES[bait]} mynter/stk.</p></div>
              <div className="flex shrink-0 gap-1">
                {([1, 5] as const).map(quantity => <button key={quantity} disabled={inventoryPending || inventory.coins < SHOP_PRICES[bait] * quantity} onClick={() => void updateInventory(() => buyBait(user.uid, bait, quantity))} className="rounded bg-[#225c66] px-2 py-1 text-xs font-bold text-white disabled:opacity-40">Kjøp {quantity}</button>)}
              </div>
            </div>)}
          </div>
        </div>
      </section>}

      {showWardrobe && <section role="dialog" aria-label="Garderobe" aria-modal="true" className="absolute inset-0 overflow-y-auto bg-[#e5e5c9] p-4 text-[#233b3a] sm:p-7">
        <div className="mx-auto max-w-md">
          <h2 className="text-2xl font-black">Garderoben</h2>
          <div className="wardrobe-preview"><FisherPortrait appearance={draftLook} /><FisherPortrait appearance={draftLook} direction="right" /><FisherPortrait appearance={draftLook} direction="up" /></div>
          <p className="mt-1 text-sm">Piltaster flytter markeringen. E eller mellomrom velger. Gå ned til Lagre eller Avbryt, eller trykk Escape for å gå ut.</p>
          {([['Klær og hattebånd', 'shirt', SHIRT_COLORS], ['Hår', 'hair', HAIR_COLORS], ['Hudtone', 'skin', SKIN_COLORS]] as const).map(([label, key, colors], row) =>
            <div key={key} className="mt-5"><h3 className="mb-2 font-bold">{label}</h3><div className="flex flex-wrap gap-3">
              {colors.map((color, index) => <button key={index} type="button" aria-label={`${label} ${index + 1}`} aria-pressed={draftLook[key] === index}
                onFocus={() => setWardrobeCursor({ row, column: index })}
                onClick={() => { setWardrobeCursor({ row, column: index }); previewLook({ ...draftLook, [key]: index }) }}
                className={`h-11 w-11 rounded border-4 ${draftLook[key] === index ? 'border-[#233b3a]' : 'border-white'} ${wardrobeCursor.row === row && wardrobeCursor.column === index ? 'ring-4 ring-amber-500 ring-offset-2' : ''}`} 
                style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }} />)}
            </div></div>)}
          <div className="mt-8 flex gap-3">
            <button onClick={() => void confirmLook()} onFocus={() => setWardrobeCursor({ row: 3, column: 0 })} onMouseEnter={() => setWardrobeCursor({ row: 3, column: 0 })} disabled={savingLook} className={`rounded-md bg-[#225c66] px-4 py-2 font-bold text-white disabled:opacity-50 ${wardrobeCursor.row === 3 && wardrobeCursor.column === 0 ? 'ring-4 ring-amber-500 ring-offset-2' : ''}`}>{savingLook ? 'Lagrer …' : 'Lagre utseende'}</button>
            <button onClick={closeWardrobe} onFocus={() => setWardrobeCursor({ row: 3, column: 1 })} onMouseEnter={() => setWardrobeCursor({ row: 3, column: 1 })} disabled={savingLook} className={`rounded-md border-2 border-[#38564d] px-4 py-2 font-bold disabled:opacity-50 ${wardrobeCursor.row === 3 && wardrobeCursor.column === 1 ? 'ring-4 ring-amber-500 ring-offset-2' : ''}`}>Avbryt</button>
          </div>
        </div>
      </section>}

      {showBook && <section role="dialog" aria-label="Fiskeboken" aria-modal="true" className="absolute inset-0 overflow-y-auto bg-[#e5e5c9] p-4 text-[#233b3a] sm:p-7">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-4 border-[#506f62] bg-[#e5e5c9] pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Fiskespill</p>
            <h2 className="text-2xl font-black sm:text-3xl">Fiskeboken</h2>
            <p className="text-xs sm:text-sm">Oppdaget {book.length} av {FISH.length} arter · Fanget {caughtSpecies}</p>
          </div>
          <button onClick={() => setShowBook(false)} className="rounded-md border-2 border-[#38564d] bg-[#f7f4df] px-3 py-2 text-sm font-bold hover:bg-white">← Spillmeny</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FISH.map((species, index) => {
            const entry = book.find(item => item.speciesId === species.id)
            return <article key={species.id} className="border-2 border-[#73897a] bg-[#f7f4df] p-3 shadow-[3px_3px_0_#8ba091]">
              <h3 className="text-lg font-black">#{String(index + 1).padStart(2, '0')} {entry ? `${species.icon} ${species.name}` : '❔ Ukjent art'}</h3>
              {entry ? <>
                <p className="mt-1 text-sm">{species.description}</p>
                <p className="mt-2 text-sm font-semibold">Sett {entry.seenCount} · Fanget {entry.caughtCount}</p>
                {entry.caughtCount > 0 && <p className="text-sm">Minst {formatWeight(entry.smallestGrams!)} · Størst {formatWeight(entry.largestGrams!)}</p>}
              </> : <p className="mt-2 text-sm">Ikke oppdaget ennå.</p>}
            </article>
          })}
        </div>
      </section>}
    </div>

    <div className="mt-4 grid w-fit grid-cols-3 gap-1 sm:hidden">
      <span /><button className="control-button" disabled={uiBlocked} aria-label="Gå opp" onClick={() => scene.current?.move('up')}>▲</button><span />
      {(['left', 'down', 'right'] as Direction[]).map((direction, index) =>
        <button key={direction} className="control-button" disabled={uiBlocked} aria-label={['Gå venstre', 'Gå ned', 'Gå høyre'][index]} onClick={() => scene.current?.move(direction)}>{['◀', '▼', '▶'][index]}</button>)}
    </div>
    <button className="mt-2 text-xs text-slate-300 underline sm:hidden" disabled={!inventory || !position || uiBlocked} onClick={() => { scene.current?.setUiBlocked(true); setShowMenu(true) }}>Spillmeny</button>
    <p className="mt-3 text-xs text-slate-400">Enter: spillmeny · Piltaster / WASD: bevegelse · E / mellomrom: handling · Esc: tilbake · Gå på dører og trapper for å bytte rom.</p>
  </div>
}
