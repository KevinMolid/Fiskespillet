import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from './lib/firebase'
import { profileError, type Profile } from './lib/profile'
import { loadFishBook, type FishBookEntry } from './game/persistence'
import { FISH, formatWeight } from './game/world'

type Player = Profile & { uid: string }

export default function PlayersPage({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<FishBookEntry[]>([])
  const [bookLoading, setBookLoading] = useState(false)

  async function openBook(uid: string) {
    if (selected === uid) { setSelected(null); return }
    setSelected(uid)
    setBookLoading(true)
    setError('')
    try {
      setEntries(await loadFishBook(uid))
    } catch (cause) {
      setError(profileError(cause))
    } finally {
      setBookLoading(false)
    }
  }

  useEffect(() => {
    if (!db) {
      setError('Firestore er ikke konfigurert.')
      setLoading(false)
      return
    }
    let active = true
    getDocs(query(collection(db, 'profiles'), limit(50))).then(snapshot => {
      if (active) setPlayers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() as Profile })))
    }).catch(cause => {
      if (active) setError(profileError(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return <div className="mx-auto w-full max-w-3xl py-10">
    <button onClick={onBack} className="mb-6 text-sm text-cyan-300 hover:underline">← Tilbake</button>
    <h1 className="text-3xl font-bold">Spillere</h1>
    <p className="mt-2 text-slate-400">Profiler som andre innloggede spillere kan se.</p>
    {loading && <p role="status" className="mt-8 text-slate-300">Henter spillere …</p>}
    {error && <p role="alert" className="mt-8 text-rose-200">{error}</p>}
    {!loading && !error && players.length === 0 && <p className="mt-8 text-slate-300">Ingen profiler ennå.</p>}
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {players.map(player => <article key={player.uid} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-300/15 text-2xl">
          {player.avatar ? <img src={player.avatar} alt="" className="h-full w-full object-cover" /> : '🎣'}
        </div>
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{player.username}</h2>
          {player.bio && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{player.bio}</p>}
          <button onClick={() => void openBook(player.uid)} className="mt-3 text-sm text-cyan-300 hover:underline">Se fiskebok</button>
        </div>
      </article>)}
    </div>
    {selected && <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold">Fiskeboken til {players.find(player => player.uid === selected)?.username}</h2>
      {bookLoading ? <p className="mt-3 text-slate-300">Henter fiskebok …</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FISH.map(species => {
          const entry = entries.find(item => item.speciesId === species.id)
          return <div key={species.id} className="rounded-lg border border-white/10 p-3">
            <p className="font-medium">{species.name}</p>
            {entry && entry.caughtCount > 0 && <p className="mt-1 text-sm text-slate-300">Sett {entry.seenCount} · Fanget {entry.caughtCount}
              {entry.largestGrams && ` · Rekord ${formatWeight(entry.largestGrams)}`}</p>}
          </div>
        })}
      </div>}
    </section>}
  </div>
}
