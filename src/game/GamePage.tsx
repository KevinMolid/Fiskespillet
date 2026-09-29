import { useEffect, useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import { createWorld, type WorldScene } from './WorldScene'
import { loadFishBook, loadPosition, recordEncounter, savePosition, type FishBookEntry } from './persistence'
import { FISH, FISHING_ZONES, formatWeight, MAPS, rollFish, type Direction, type Position } from './world'

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
  const atWater = Boolean(position && map?.tiles[position.y][position.x] === 'fish')
  const caughtSpecies = book.filter(entry => entry.caughtCount > 0).length

  return <div className="py-7">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Utforsk verden</p>
        <h1 className="mt-1 text-2xl font-bold">{map?.name ?? 'Laster kart …'}</h1>
        <p className="mt-1 text-sm text-slate-400">{map?.description ?? 'Henter lagret fremgang.'}</p>
      </div>
      <button onClick={() => setShowBook(value => !value)} className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
        📖 Fiskebok · {caughtSpecies}/{FISH.length}
      </button>
    </div>

    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
    <div className="overflow-hidden rounded-xl border-4 border-[#27474a] bg-[#183a36] shadow-2xl">
      <div ref={canvasParent} className="aspect-[3/2] w-full [&_canvas]:block" aria-label="Spillkart" />
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-300">
      <p>Gå: piltaster eller WASD · Fisk: E eller mellomrom på den lyse fiskeruten.</p>
      <button onClick={() => scene.current?.fish()} disabled={!atWater || busy} className="rounded-lg bg-cyan-300 px-5 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? 'Venter på napp …' : '🎣 Fisk'}
      </button>
    </div>

    <div className="mt-4 grid w-fit grid-cols-3 gap-1 sm:hidden">
      <span /><button className="control-button" aria-label="Gå opp" onClick={() => scene.current?.move('up')}>▲</button><span />
      {(['left', 'down', 'right'] as Direction[]).map((direction, index) =>
        <button key={direction} className="control-button" aria-label={['Gå venstre', 'Gå ned', 'Gå høyre'][index]} onClick={() => scene.current?.move(direction)}>{['◀', '▼', '▶'][index]}</button>)}
    </div>

    {result && <div role="status" className="mt-5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-5">
      <p className="text-2xl">{result.icon} {result.caught ? `Du fanget en ${result.name}!` : `Du så en ${result.name}, men den slapp unna!`}</p>
      {result.caught && <p className="mt-2 text-cyan-100">Vekt: {formatWeight(result.grams)}</p>}
      <button onClick={() => setResult(null)} className="mt-3 text-sm text-cyan-300 hover:underline">Lukk</button>
    </div>}

    {showBook && <section className="mt-7">
      <h2 className="text-2xl font-semibold">Fiskeboken</h2>
      <p className="mt-1 text-sm text-slate-400">Arter du har sett og fanget ved {FISHING_ZONES.skogstjern.name}.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FISH.map(species => {
          const entry = book.find(item => item.speciesId === species.id)
          return <article key={species.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold">{entry ? `${species.icon} ${species.name}` : '❔ Ukjent art'}</h3>
            {entry ? <>
              <p className="mt-1 text-sm text-slate-300">{species.description}</p>
              <p className="mt-2 text-sm">Sett {entry.seenCount} · Fanget {entry.caughtCount}</p>
              {entry.caughtCount > 0 && <p className="mt-1 text-sm text-cyan-200">Minst {formatWeight(entry.smallestGrams!)} · Størst {formatWeight(entry.largestGrams!)}</p>}
            </> : <p className="mt-2 text-sm text-slate-400">Ikke oppdaget ennå.</p>}
          </article>
        })}
      </div>
    </section>}
  </div>
}
