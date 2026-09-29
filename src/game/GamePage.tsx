import { useEffect, useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import { createWorld, type WorldScene } from './WorldScene'
import { loadFishBook, loadPosition, recordEncounter, savePosition, type FishBookEntry } from './persistence'
import { canFish, FISH, formatWeight, MAPS, rollFish, signAhead, type Direction, type Position } from './world'

type Result = { name: string; icon: string; grams: number; caught: boolean }

export default function GamePage({ user }: { user: User }) {
  const canvasParent = useRef<HTMLDivElement>(null)
  const scene = useRef<WorldScene | null>(null)
  const saveTimer = useRef<number | null>(null)
  const castTimer = useRef<number | null>(null)
  const casting = useRef(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [book, setBook] = useState<FishBookEntry[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [showBook, setShowBook] = useState(false)
  const [signMessage, setSignMessage] = useState<{ title: string; text: string } | null>(null)

  useEffect(() => {
    scene.current?.setUiBlocked(showBook || Boolean(result) || Boolean(error) || Boolean(signMessage) || busy)
  }, [showBook, result, error, signMessage, busy, position])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (showBook && event.key === 'Escape') setShowBook(false)
      else if ((result || error || signMessage) && ['Enter', ' ', 'e', 'E'].includes(event.key)) {
        event.preventDefault()
        setResult(null)
        setError('')
        setSignMessage(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showBook, result, error, signMessage])

  useEffect(() => {
    let active = true
    Promise.all([loadPosition(user.uid), loadFishBook(user.uid)]).then(([saved, entries]) => {
      if (!active) return
      setPosition(saved)
      setBook(entries)
    }).catch(() => {
      if (active) setError('Kunne ikke laste spillet. Kontroller Firestore-tilgangen og prøv å laste siden på nytt.')
    })
    return () => { active = false }
  }, [user.uid])

  useEffect(() => {
    if (!canvasParent.current || !position || scene.current) return
    const { game, scene: world } = createWorld(canvasParent.current, position, {
      onPosition(next, transitioned) {
        setPosition(next)
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          void savePosition(user.uid, next).catch(() => setError('Kunne ikke lagre posisjonen. Sjekk tilkoblingen.'))
          saveTimer.current = null
        }, transitioned ? 0 : 1200)
      },
      onSign(sign) {
        setSignMessage(sign)
      },
      onFishing() {
        if (casting.current) return
        casting.current = true
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
          const fish = rollFish(zoneId)
          void recordEncounter(user.uid, fish.species.id, fish.grams, fish.caught)
            .then(() => loadFishBook(user.uid))
            .then(entries => {
              setBook(entries)
              setResult({ name: fish.species.name, icon: fish.species.icon, grams: fish.grams, caught: fish.caught })
            })
            .catch(() => setError('Fisketuren kunne ikke lagres. Prøv igjen.'))
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
      scene.current = null
      game.destroy(true)
    }
  // The Phaser scene must be created once after the saved position loads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(position), user.uid])

  const worldPosition = useRef(position)
  worldPosition.current = position
  const map = position ? MAPS[position.mapId] : null
  const canAct = Boolean(position && (canFish(position) || signAhead(position)))
  const caughtSpecies = book.filter(entry => entry.caughtCount > 0).length

  return <div className="py-6">
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border-4 border-[#27474a] bg-[#183a36] shadow-2xl">
      <div ref={canvasParent} className="absolute inset-0 [&_canvas]:block" aria-label="Spillkart" />

      {!showBook && <>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-[#092520d9] to-transparent p-2 sm:p-4">
          <div className="rounded-md bg-[#092520d9] px-2 py-1 text-xs font-bold text-white sm:text-base">{map?.name ?? 'Laster kart …'}</div>
          <div className="flex gap-2">
            <button onClick={() => setShowBook(true)} disabled={!position || busy} className="rounded-md border-2 border-[#dae7ce] bg-[#183f3b] px-2 py-1 text-xs font-bold text-white disabled:opacity-50 sm:px-3 sm:text-sm">
              📖 Fiskebok {caughtSpecies}/{FISH.length}
            </button>
            <button onClick={() => scene.current?.action()} disabled={!canAct || busy || Boolean(result) || Boolean(error) || Boolean(signMessage)} className="rounded-md border-2 border-[#dae7ce] bg-[#225c66] px-2 py-1 text-xs font-bold text-white disabled:opacity-40 sm:px-3 sm:text-sm">
              ✦ Handling
            </button>
          </div>
        </div>

        {(error || busy || result || signMessage) && <div role={error ? 'alert' : 'status'} className="absolute inset-x-2 bottom-2 min-h-16 border-4 border-[#405e59] bg-[#f7f4df] p-2 text-sm font-semibold text-[#233b3a] shadow-[0_4px_0_#122b29] sm:inset-x-5 sm:bottom-5 sm:min-h-24 sm:p-4 sm:text-lg">
          {error ? <p>{error}</p>
            : busy ? <p>Du kastet ut snøret … Vent på napp!</p>
              : result ? <p>{result.icon} {result.caught
                ? `Du fanget en ${result.name}! Den veier ${formatWeight(result.grams)}.`
                : `En ${result.name} bet på, men slapp unna!`}</p>
                : signMessage && <p><strong>{signMessage.title}</strong><br />{signMessage.text}</p>}
          {(error || result || signMessage) && <button onClick={() => { setError(''); setResult(null); setSignMessage(null) }} className="absolute bottom-1 right-2 text-xs font-bold sm:bottom-2 sm:right-4 sm:text-sm">Videre ▼</button>}
        </div>}
      </>}

      {showBook && <section role="dialog" aria-label="Fiskeboken" aria-modal="true" className="absolute inset-0 overflow-y-auto bg-[#e5e5c9] p-4 text-[#233b3a] sm:p-7">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-4 border-[#506f62] bg-[#e5e5c9] pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]">Fiskespill</p>
            <h2 className="text-2xl font-black sm:text-3xl">Fiskeboken</h2>
            <p className="text-xs sm:text-sm">Oppdaget {book.length} av {FISH.length} arter · Fanget {caughtSpecies}</p>
          </div>
          <button onClick={() => setShowBook(false)} className="rounded-md border-2 border-[#38564d] bg-[#f7f4df] px-3 py-2 text-sm font-bold hover:bg-white">Lukk ✕</button>
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
      <span /><button className="control-button" aria-label="Gå opp" onClick={() => scene.current?.move('up')}>▲</button><span />
      {(['left', 'down', 'right'] as Direction[]).map((direction, index) =>
        <button key={direction} className="control-button" aria-label={['Gå venstre', 'Gå ned', 'Gå høyre'][index]} onClick={() => scene.current?.move(direction)}>{['◀', '▼', '▶'][index]}</button>)}
    </div>
    <p className="mt-3 text-xs text-slate-400">Bevegelse: piltaster eller WASD · Handling: E eller mellomrom (fisk eller les skilt) · Gå gjennom åpningen i kanten for å bytte kart.</p>
  </div>
}
