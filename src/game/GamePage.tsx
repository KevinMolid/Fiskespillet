import { FishBookDialog } from './FishBookDialog'
import { CatchDialog } from './CatchDialog'
import { CharacterSelect } from './CharacterSelect'
import type { CatchMilestone } from './fishBook'
import type { FishSpecies } from './fish'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import { createWorld, type WorldScene } from './WorldScene'
import * as persistence from './persistence'
import { type FishBookEntry, type Inventory } from './persistence'
import { GameMenu } from './GameMenu'
import { PlaceNotice } from './PlaceNotice'
import { InventoryDialog, ShopDialog, WardrobeDialog } from './GameDialogs'
import { MobileControls } from './MobileControls'
import { FishingDialog, type FishingFinish, type ReelControl } from './FishingDialog'
import { useGameInput } from './useGameInput'
import { FISH_REWARDS, hasRunningShoes, type BaitId } from './items'
import { MARITA_SNEAKERS_GIFT_LINE } from './npcs'
import { fishingOptions } from './fish'
import { canFish, DEFAULT_APPEARANCE, FISH, formatWeight, interactionAhead, MAPS, type Appearance, type PlayerVariant, type Position } from './world'

type Result = { species: FishSpecies; grams: number; coins: number; milestone: CatchMilestone | null }

export type GameServices = Pick<typeof persistence, 'buyBait' | 'consumeBait' | 'digForWorms' | 'grantMaritaSneakers' | 'loadAppearance' | 'loadFishBook' | 'loadInventory' | 'loadPosition' | 'recordEncounter' | 'saveAppearance' | 'savePosition' | 'setEquippedBait' | 'transferItem'>

export default function GamePage({ user, services = persistence }: { user: Pick<User, 'uid'>; services?: GameServices }) {
  const { buyBait, consumeBait, digForWorms, grantMaritaSneakers, loadAppearance, loadFishBook, loadInventory, loadPosition, recordEncounter, saveAppearance, savePosition, setEquippedBait, transferItem } = services
  const canvasParent = useRef<HTMLDivElement>(null)
  const gameFrame = useRef<HTMLDivElement>(null)
  const scene = useRef<WorldScene | null>(null)
  const saveTimer = useRef<number | null>(null)
  const casting = useRef(false)
  const fishingCommitted = useRef(false)
  const reelControl = useRef<ReelControl | null>(null)
  const [fishingActionLabel, setFishingActionLabel] = useState('Velg')
  const registerReelControl = useCallback((control: ReelControl | null) => {
    reelControl.current = control
    setFishingActionLabel(control?.label ?? 'Velg')
  }, [])
  const interacting = useRef(false)
  const [, refreshInteraction] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)
  const [book, setBook] = useState<FishBookEntry[]>([])
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [inventoryView, setInventoryView] = useState<'bag' | 'chest' | null>(null)
  const [showShop, setShowShop] = useState(false)
  const [fishingSession, setFishingSession] = useState<{ position: Position; zoneId: string; bait: BaitId } | null>(null)
  const [inventoryPending, setInventoryPending] = useState(false)
  const [inventoryError, setInventoryError] = useState('')
  const [appearance, setAppearance] = useState<Appearance | null>(null)
  const [draftLook, setDraftLook] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [showWardrobe, setShowWardrobe] = useState(false)
  const [savingLook, setSavingLook] = useState(false)
  const [choiceError, setChoiceError] = useState('')
  const choosingCharacter = Boolean(appearance && !appearance.playerVariant)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyText, setBusyText] = useState('Du kastet ut snøret … Vent på napp!')
  const [result, setResult] = useState<Result | null>(null)
  const catchNotice = result?.milestone && !error && !busy ? result : null
  const [showBook, setShowBook] = useState(false)
  const fishBookBack = useRef<(() => void) | null>(null)
  const closeBook = useCallback(() => setShowBook(false), [])
  const registerFishBookMenuBack = useCallback((handler: (() => void) | null) => { fishBookBack.current = handler }, [])
  const [showMenu, setShowMenu] = useState(false)
  const closeMenu = useCallback(() => {
    setShowMenu(false)
    window.requestAnimationFrame(() => gameFrame.current?.focus({ preventScroll: true }))
  }, [])
  const [signMessage, setSignMessage] = useState<{ title: string; text: string } | null>(null)
  const uiBlocked = choosingCharacter || showMenu || showBook || showWardrobe || Boolean(inventoryView) || showShop || Boolean(fishingSession) || inventoryPending || savingLook || Boolean(result) || Boolean(error) || Boolean(signMessage) || busy

  async function selectCharacter(playerVariant: PlayerVariant) {
    if (!appearance || savingLook) return
    setSavingLook(true)
    setChoiceError('')
    const next = { ...appearance, playerVariant }
    try {
      await saveAppearance(user.uid, next)
      setAppearance(next)
      setDraftLook(next)
    } catch { setChoiceError('Kunne ikke lagre karaktervalget. Prøv igjen.') }
    finally { setSavingLook(false) }
  }

  useEffect(() => {
    scene.current?.setUiBlocked(uiBlocked)
  }, [uiBlocked, position])

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
    if (!canvasParent.current || !position || !appearance?.playerVariant || !inventory || scene.current) return
    let active = true
    const { game, scene: world } = createWorld(canvasParent.current, position, appearance, {
      onInteractionChange() { refreshInteraction(n => n + 1) },
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
        setShowWardrobe(true)
      },
      onSign(sign) {
        setSignMessage(sign)
      },
      onNpcTalk(npc, line) {
        if (npc.id !== 'marita' || hasRunningShoes(currentInventory.current)) {
          setSignMessage({ title: npc.name, text: line })
          return
        }
        if (interacting.current) return
        interacting.current = true
        setBusyText('Marita finner frem joggeskoene …')
        setBusy(true)
        void grantMaritaSneakers(user.uid)
          .then(({ inventory: next, received }) => {
            if (!active) return
            setInventory(next)
            setSignMessage({ title: npc.name, text: received ? MARITA_SNEAKERS_GIFT_LINE : line })
          })
          .catch(() => {
            if (active) setError('Kunne ikke lagre joggeskoene. Sjekk tilkoblingen og snakk med Marita igjen.')
          })
          .finally(() => { if (active) { interacting.current = false; setBusy(false) } })
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
        const zone = worldPosition.current && MAPS[worldPosition.current.mapId].fishingZone
        if (!zone || !fishingOptions(zone, activeBait).length) {
          setError('Dette agnet passer ikke til fiskene her. Prøv et annet agn. Agnet er ikke brukt.')
          world.finishFishing()
          return
        }
        const currentPosition = worldPosition.current
        if (!zone || !currentPosition) {
          setError('Du kan ikke fiske her.')
          world.finishFishing()
          return
        }
        casting.current = true
        fishingCommitted.current = false
        world.setCastAim(true)
        setResult(null)
        setError('')
        setSignMessage(null)
        setFishingSession({ position: { ...currentPosition }, zoneId: zone, bait: activeBait })
      },
    })
    scene.current = world
    return () => {
      active = false
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        if (worldPosition.current) void savePosition(user.uid, worldPosition.current).catch(() => {})
      }
      casting.current = false
      interacting.current = false
      scene.current = null
      game.destroy(true)
    }
  // The Phaser scene must be created once after the saved position loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(position), Boolean(appearance?.playerVariant), Boolean(inventory), user.uid])

  useEffect(() => {
    scene.current?.setCanRun(hasRunningShoes(inventory))
  }, [inventory, Boolean(position), Boolean(appearance)])

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
  function closeFishingSession() {
    reelControl.current = null
    fishingCommitted.current = false
    casting.current = false
    setFishingSession(null)
    scene.current?.finishFishing()
  }
  async function finishFishingSession(outcome: FishingFinish) {
    setBusyText(outcome.type === 'landed' ? 'Du landet fisken …' : 'Du sveiver inn snøret …')
    setBusy(true)
    setError('')
    try {
      if (outcome.type === 'landed') {
        if (!fishingSession) throw new Error('Fisketuren ble avbrutt før fangsten kunne lagres.')
        const { inventory: nextInventory, entry, milestone } = await recordEncounter(
          user.uid, outcome.species.id, outcome.grams, true, outcome.bait, fishingSession.zoneId,
        )
        setInventory(nextInventory)
        setResult({ species: outcome.species, grams: outcome.grams, coins: FISH_REWARDS[outcome.species.id] ?? 0, milestone })
        setBook(current => [...current.filter(item => item.speciesId !== entry.speciesId), entry])
      } else {
        const nextInventory = await consumeBait(user.uid, outcome.bait)
        setInventory(nextInventory)
        const text = outcome.reason === 'no-bite'
          ? 'Ingen napp denne gangen. Agnet er brukt.'
          : outcome.reason === 'bottom-snag'
            ? 'Kroken satte seg fast i bunnen. Kastet mislyktes, og agnet er brukt.'
          : outcome.reason === 'missed-hook'
            ? 'Du reagerte litt for sent. Fisken slapp unna, og agnet er brukt.'
            : 'Snøret røk. Fisken slapp unna, og agnet er brukt.'
        setSignMessage({ title: outcome.reason === 'no-bite' ? 'Ingen napp' : outcome.reason === 'bottom-snag' ? 'Kroken sitter fast' : 'Fisken slapp unna', text })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fisketuren kunne ikke lagres. Prøv igjen.')
    } finally {
      setBusy(false)
      closeFishingSession()
    }
  }
  const canFishNow = Boolean(inventory?.bag.rod && inventory.equippedBait && inventory.bag[inventory.equippedBait])
  const target = position ? interactionAhead(position) : null
  const actionLabel = !position || uiBlocked ? null
    : (scene.current?.npcAhead() || target?.npc) ? 'Snakk'
      : target?.tile === 'wardrobe' ? 'Skift klær'
        : target?.tile === 'chest' ? 'Åpne kiste'
          : target?.tile === 'shopCounter' ? 'Handle'
            : target?.tile === 'soil' && inventory?.bag.shovel ? 'Grav'
              : target?.sign ? 'Les'
                : canFish(position) && canFishNow ? 'Fisk' : null
  const caughtSpecies = book.filter(entry => entry.caughtCount > 0).length

  const modal = Boolean(choosingCharacter || showMenu || showBook || showWardrobe || inventoryView || showShop || fishingSession || catchNotice)
  const inputContext = choosingCharacter ? 'character' : fishingSession ? 'fishing' : catchNotice ? 'catch' : showWardrobe ? 'wardrobe' : inventoryView ?? (showBook ? 'book' : showShop ? 'shop' : showMenu ? 'menu' : error || result || signMessage ? 'message' : 'world')
  function dismissMessage() { setError(''); setResult(null); setSignMessage(null) }
  function menuControl() {
    if (choosingCharacter || inventoryPending || savingLook || busy) return
    if (fishingSession) {
      if (!fishingCommitted.current) closeFishingSession()
    }
    else if (showWardrobe) closeWardrobe()
    else if (inventoryView) setInventoryView(null)
    else if (showBook) { if (fishBookBack.current) fishBookBack.current(); else closeBook() }
    else if (showShop) setShowShop(false)
    else if (error || result || signMessage) dismissMessage()
    else if (showMenu) closeMenu()
    else if (position && inventory) { scene.current?.setUiBlocked(true); setShowMenu(true) }
  }
  const input = useGameInput({ frame: gameFrame, context: inputContext, modal, locked: busy || inventoryPending || savingLook,
    move: direction => { if (!uiBlocked) scene.current?.move(direction) },
    moveHold: direction => { if (!uiBlocked || direction === null) scene.current?.setTouchDirection(direction) },
    action: () => { if (error || result || signMessage) dismissMessage(); else scene.current?.action() }, menu: menuControl,
    tapAction: () => fishingSession ? (reelControl.current?.tap() ?? false) : false,
    utilityAllowed: Boolean(position && hasRunningShoes(inventory) && !uiBlocked), utility: active => scene.current?.setUtilityHeld(active),
  })

  return <div className="game-shell">
    <div ref={gameFrame} tabIndex={-1} className="game-frame relative aspect-[3/2] w-full overflow-hidden rounded-xl border-4 border-[#27474a] bg-[#183a36] shadow-2xl">
      <div ref={canvasParent} className="absolute inset-0 [&_canvas]:block" aria-label="Spillkart" />

      {map && !choosingCharacter && <PlaceNotice key={map.id} name={map.name} />}
      {choosingCharacter && <CharacterSelect pending={savingLook} error={choiceError} onSelect={variant => void selectCharacter(variant)} />}

      {!showMenu && !showBook && !showWardrobe && !inventoryView && !showShop && <>
        {!position && <p role="status" className="absolute left-4 top-4 text-white">Laster kart …</p>}
        {actionLabel && <button onClick={() => scene.current?.action()} className="context-action">{actionLabel}</button>}

        {!catchNotice && (error || busy || result || signMessage) && <div role={error ? 'alert' : 'status'} className="world-message absolute inset-x-2 bottom-2 min-h-16 p-2 pb-6 text-sm font-semibold sm:inset-x-5 sm:bottom-5 sm:min-h-24 sm:p-4 sm:pb-8 sm:text-lg">
          {error ? <p>{error}</p>
            : busy ? <p>{busyText}</p>
              : result ? <p>{result.species.icon} {`Du fanget en ${result.species.name}! Den veier ${formatWeight(result.grams)}. +${result.coins} mynter.`}</p>
                : signMessage && <p><strong>{signMessage.title}</strong><br />{signMessage.text}</p>}
          {(error || result || signMessage) && <button onClick={() => { setError(''); setResult(null); setSignMessage(null) }} className="absolute bottom-1 right-2 text-xs font-bold sm:bottom-2 sm:right-4 sm:text-sm">Videre ▼</button>}
        </div>}
      </>}

      {showMenu && !inventoryView && !showBook && inventory && appearance && <GameMenu
        inventory={inventory} appearance={appearance} caughtSpecies={caughtSpecies} speciesCount={FISH.length}
        onBag={() => { setInventoryError(''); setInventoryView('bag') }}
        onBook={() => setShowBook(true)} onClose={closeMenu}
      />}

      {inventoryView && inventory && <InventoryDialog inventory={inventory} chest={inventoryView === 'chest'} pending={inventoryPending} error={inventoryError}
        onClose={() => setInventoryView(null)}
        onBait={bait => void updateInventory(() => setEquippedBait(user.uid, bait))}
        onTransfer={(id, toStorage) => void updateInventory(() => transferItem(user.uid, id, toStorage))} />}
      {showShop && inventory && <ShopDialog inventory={inventory} pending={inventoryPending} error={inventoryError} onClose={() => setShowShop(false)} onBuy={(bait, amount) => void updateInventory(() => buyBait(user.uid, bait, amount))} />}
      {showWardrobe && <WardrobeDialog appearance={draftLook} pending={savingLook} onPreview={previewLook} onSave={() => void confirmLook()} onClose={closeWardrobe} />}
      {showBook && <FishBookDialog book={book} onClose={closeBook} registerMenuBack={registerFishBookMenuBack} />}
      {catchNotice?.milestone && <CatchDialog fish={catchNotice.species} grams={catchNotice.grams} coins={catchNotice.coins}
        milestone={catchNotice.milestone} onClose={dismissMessage} />}
      {fishingSession && <FishingDialog position={fishingSession.position} zoneId={fishingSession.zoneId} bait={fishingSession.bait}
        onCast={steps => scene.current?.playCast(steps) ?? Promise.resolve(false)}
        onLureProgress={(steps, progress) => scene.current?.setRetrieveProgress(steps, progress)}
        onCommit={() => { fishingCommitted.current = true }} onFinish={outcome => void finishFishingSession(outcome)}
        registerReelControl={registerReelControl} />}
    </div>

    <MobileControls context={inputContext} onDirection={input.direction} onAction={input.action}
      onDirectionStart={input.directionStart} onDirectionEnd={input.directionEnd}
      onMenu={input.menu}
      onUtilityStart={input.utilityStart} onUtilityEnd={input.utilityEnd} utilityHeld={input.utilityHeld}
      utilityDisabled={uiBlocked || !hasRunningShoes(inventory)}
      actionLabel={fishingSession ? fishingActionLabel : catchNotice ? 'Videre' : modal ? 'Velg' : (error || result || signMessage) ? 'Videre' : actionLabel ?? ''}
      disabled={!position || !inventory || busy || inventoryPending || savingLook}
      actionDisabled={!position || busy || inventoryPending || savingLook || (!modal && !actionLabel && !error && !result && !signMessage)} />
    <p className="desktop-control-hint mt-3 text-xs text-slate-400">Enter: spillmeny · Piltaster / WASD: bevegelse · {hasRunningShoes(inventory) ? 'Hold Shift: løp' : 'Joggesko fra Marita låser opp løping'} · E / mellomrom: handling · Esc: tilbake · Gå på dører og trapper for å bytte rom.</p>
  </div>
}
