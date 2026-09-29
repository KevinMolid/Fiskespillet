import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from './lib/firebase'
import { profileError, type Profile } from './lib/profile'

type Player = Profile & { uid: string }

export default function PlayersPage({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        </div>
      </article>)}
    </div>
  </div>
}
