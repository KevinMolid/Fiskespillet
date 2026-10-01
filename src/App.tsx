import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth'
import { auth } from './lib/firebase'
import { ensureProfile, profileError, watchProfile, type Profile } from './lib/profile'
import ProfilePage from './ProfilePage'
import PlayersPage from './PlayersPage'
import { hasExistingGame, resetGameData } from './game/persistence'
import { StartMenu } from './game/StartMenu'

const GamePage = lazy(() => import('./game/GamePage'))

type Mode = 'login' | 'register' | 'reset'

function authMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  switch (code) {
    case 'auth/invalid-email': return 'Skriv inn en gyldig e-postadresse.'
    case 'auth/weak-password': return 'Passordet må ha minst 6 tegn.'
    case 'auth/email-already-in-use': return 'Denne e-postadressen er allerede registrert.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Feil e-post eller passord.'
    case 'auth/too-many-requests': return 'For mange forsøk. Vent litt og prøv igjen.'
    case 'auth/network-request-failed': return 'Nettverksfeil. Prøv igjen.'
    case 'auth/operation-not-allowed': return 'Aktiver e-post og passord i Firebase Authentication.'
    default: return 'Noe gikk galt. Prøv igjen.'
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(auth))
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileIssue, setProfileIssue] = useState('')
  const [page, setPage] = useState<'home' | 'profile' | 'players'>('home')
  const [gameStart, setGameStart] = useState<'checking' | 'menu' | 'error' | 'playing'>('checking')
  const [hasSave, setHasSave] = useState(false)
  const [startPending, setStartPending] = useState(false)
  const [startError, setStartError] = useState('')

  useEffect(() => {
    if (!auth) return
    const timer = window.setTimeout(() => {
      setError('Innloggingssjekken tar for lang tid. Sjekk nettverket og prøv å logge inn.')
      setChecking(false)
    }, 10000)
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      window.clearTimeout(timer)
      setUser(nextUser)
      setChecking(false)
      setError('')
    }, () => {
      window.clearTimeout(timer)
      setError('Kunne ikke sjekke innloggingen. Last siden på nytt.')
      setChecking(false)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileIssue('')
      setPage('home')
      setGameStart('checking')
      setHasSave(false)
      return
    }
    let cancelled = false
    setPage('home')
    setGameStart('checking')
    setStartError('')
    hasExistingGame(user.uid).then(saved => {
      if (cancelled) return
      setHasSave(saved)
      setGameStart('menu')
    }).catch(() => {
      if (cancelled) return
      setStartError('Kunne ikke sjekke lagringen. Kontroller tilkoblingen og prøv igjen.')
      setGameStart('error')
    })
    let unsubscribe = () => {}
    ensureProfile(user).then(() => {
      if (cancelled) return
      unsubscribe = watchProfile(user.uid, setProfile, cause => setProfileIssue(profileError(cause)))
      setProfileIssue('')
    }).catch(cause => {
      if (!cancelled) setProfileIssue(profileError(cause))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user])

  async function startNewGame() {
    if (!user || startPending) return
    setStartPending(true)
    setStartError('')
    try {
      if (hasSave) await resetGameData(user.uid)
      setHasSave(false)
      setGameStart('playing')
    } catch {
      setStartError('Kunne ikke slette spillagringen. Ingen nytt spill er startet. Prøv igjen.')
    } finally {
      setStartPending(false)
    }
  }

  async function retryGameCheck() {
    if (!user || gameStart === 'checking') return
    setGameStart('checking')
    setStartError('')
    try {
      setHasSave(await hasExistingGame(user.uid))
      setGameStart('menu')
    } catch {
      setStartError('Kunne ikke sjekke lagringen. Kontroller tilkoblingen og prøv igjen.')
      setGameStart('error')
    }
  }

  function changeMode(next: Mode) {
    setMode(next)
    setPassword('')
    setConfirm('')
    setError('')
    setNotice('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth || busy) return
    setError('')
    setNotice('')
    if (mode === 'register' && password !== confirm) {
      setError('Passordene er ikke like.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setNotice('Hvis adressen har en konto, får du en e-post med lenke for å velge nytt passord.')
      } else if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (cause) {
      setError(authMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (!auth || busy) return
    setBusy(true)
    setError('')
    try {
      await signOut(auth)
      changeMode('login')
    } catch (cause) {
      setError(authMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20'

  return (
    <main className="min-h-screen bg-[#061c2b] text-slate-100">
      <div className={`app-shell ${user && page === 'home' && gameStart === 'playing' ? 'game-active' : ''} mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 sm:px-10`}>
        <header className="app-header flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <button onClick={() => setPage('home')} className="text-lg font-semibold tracking-wide">🎣 Fiskespill</button>
          {user && <div className="flex items-center gap-3">
            <button onClick={() => setPage('home')} className="rounded-lg px-2 py-2 text-sm hover:bg-white/10">Spill</button>
            <button onClick={() => setPage('profile')} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/10" aria-label="Åpne min profil">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-cyan-300/15">
                {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : '🎣'}
              </span>
              <span className="hidden max-w-36 truncate sm:block">{profile?.username || user.email}</span>
            </button>
            <button onClick={() => setPage('players')} className="rounded-lg px-2 py-2 text-sm hover:bg-white/10">Spillere</button>
            <button onClick={logout} disabled={busy} className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50">Logg ut</button>
          </div>}
        </header>
        {user && page === 'players' ? <div className="flex-1"><PlayersPage onBack={() => setPage('home')} /></div>
        : user && page === 'profile' ? <div className="flex-1">
          {profileIssue && <p role="alert" className="mt-6 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{profileIssue}</p>}
          <ProfilePage user={user} profile={profile} onBack={() => setPage('home')} />
        </div> : user && gameStart !== 'playing' ? <div className="flex-1"><StartMenu hasSave={hasSave} ready={gameStart === 'menu'} pending={gameStart === 'checking' || startPending} error={startError} onContinue={() => setGameStart('playing')} onNewGame={() => void startNewGame()} onRetry={() => void retryGameCheck()} /></div>
        : user ? <div className="flex-1"><Suspense fallback={<p className="py-16 text-slate-300">Laster spillet …</p>}><GamePage key={user.uid} user={user} /></Suspense></div>
        : <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Et nytt online fiskespill</p>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Eventyret starter ved vannkanten.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300">Her bygger vi etter hvert fiske, fangster, progresjon og spill sammen med andre.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl sm:p-8">
            {!auth ? <p role="alert" className="text-amber-200">Firebase er ikke konfigurert. Se README for oppsett.</p>
              : checking ? <p role="status" className="text-slate-300">Sjekker innlogging …</p>
              : <>
                  <h2 className="text-2xl font-bold">{mode === 'register' ? 'Opprett konto' : mode === 'reset' ? 'Glemt passord?' : 'Logg inn'}</h2>
                  <p className="mt-2 text-sm text-slate-400">{mode === 'reset' ? 'Vi sender deg en lenke for å velge nytt passord.' : 'Bruk e-postadressen din for å komme i gang.'}</p>
                  <form onSubmit={submit} className="mt-7 space-y-4">
                    <label className="block text-sm font-medium">E-post
                      <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
                    </label>
                    {mode !== 'reset' && <label className="block text-sm font-medium">Passord
                      <input className={inputClass} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} required value={password} onChange={event => setPassword(event.target.value)} />
                    </label>}
                    {mode === 'register' && <label className="block text-sm font-medium">Gjenta passord
                      <input className={inputClass} type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} />
                    </label>}
                    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
                    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
                    <button disabled={busy} className="w-full rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
                      {busy ? 'Vennligst vent …' : mode === 'register' ? 'Opprett konto' : mode === 'reset' ? 'Send lenke' : 'Logg inn'}
                    </button>
                  </form>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-cyan-300">
                    {mode !== 'login' && <button type="button" onClick={() => changeMode('login')} className="hover:underline">Tilbake til innlogging</button>}
                    {mode === 'login' && <>
                      <button type="button" onClick={() => changeMode('register')} className="hover:underline">Opprett konto</button>
                      <button type="button" onClick={() => changeMode('reset')} className="hover:underline">Glemt passord?</button>
                    </>}
                  </div>
                </>}
          </div>
        </section>}
        <footer className="border-t border-white/10 py-5 text-xs text-slate-500">React · Vite · Tailwind CSS · Firebase</footer>
      </div>
    </main>
  )
}

export default App
