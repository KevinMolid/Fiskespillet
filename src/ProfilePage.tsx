import { useEffect, useState, type FormEvent } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User } from 'firebase/auth'
import { updateDoc, serverTimestamp } from 'firebase/firestore'
import { profileError, profileRef, resizeAvatar, type Profile } from './lib/profile'

type Props = {
  user: User
  profile: Profile | null
  onBack: () => void
}

const inputClass = 'mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300'

export default function ProfilePage({ user, profile, onBack }: Props) {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username)
    setBio(profile.bio)
    setAvatar(profile.avatar)
  }, [profile])

  async function chooseImage(file?: File) {
    if (!file) return
    setError('')
    try {
      setAvatar(await resizeAvatar(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke lese bildet.')
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = username.trim()
    if (name.length < 3 || name.length > 24) {
      setError('Brukernavnet må ha 3–24 tegn.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateDoc(profileRef(user.uid), { username: name, bio: bio.trim(), avatar, updatedAt: serverTimestamp() })
      setMessage('Profilen er lagret.')
    } catch (cause) {
      setError(profileError(cause))
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('De nye passordene er ikke like.')
      return
    }
    if (!user.email) return
    setChangingPassword(true)
    setError('')
    setMessage('')
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
      await updatePassword(user, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Passordet er endret.')
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : ''
      setError(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? 'Nåværende passord er feil.'
        : code === 'auth/weak-password' ? 'Nytt passord er for svakt.'
        : 'Kunne ikke endre passordet. Prøv å logge ut og inn igjen.')
    } finally {
      setChangingPassword(false)
    }
  }

  return <div className="account-page mx-auto w-full max-w-2xl py-10">
    <button onClick={onBack} className="mb-6 text-sm text-cyan-300 hover:underline">← Tilbake</button>
    <h1 className="text-3xl font-bold">Min profil</h1>
    <p className="mt-2 text-slate-400">Brukernavn, bilde og profiltekst kan ses av andre innloggede spillere. E-postadressen din vises ikke.</p>
    {error && <p role="alert" className="mt-5 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    {message && <p role="status" className="mt-5 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}

    <form onSubmit={save} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-300/15 text-3xl text-cyan-200">
          {avatar ? <img src={avatar} alt="Ditt profilbilde" className="h-full w-full object-cover" /> : '🎣'}
        </div>
        <div>
          <label className="cursor-pointer rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
            Velg bilde
            <input type="file" accept="image/*" className="sr-only" onChange={event => void chooseImage(event.target.files?.[0])} />
          </label>
          {avatar && <button type="button" onClick={() => setAvatar('')} className="ml-3 text-sm text-slate-300 hover:underline">Fjern bilde</button>}
          <p className="mt-3 text-xs text-slate-400">Bildet beskjæres til en liten firkant. Maks 8 MB.</p>
        </div>
      </div>
      <label className="block text-sm font-medium">Brukernavn
        <input className={inputClass} maxLength={24} minLength={3} required value={username} onChange={event => setUsername(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">Profiltekst
        <textarea className={inputClass} rows={4} maxLength={500} value={bio} onChange={event => setBio(event.target.value)} />
        <span className="mt-1 block text-right text-xs text-slate-400">{bio.length}/500</span>
      </label>
      <button disabled={saving || !profile} className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Lagrer …' : 'Lagre profil'}</button>
    </form>

    <form onSubmit={changePassword} className="mt-7 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Endre passord</h2>
      <label className="block text-sm font-medium">Nåværende passord
        <input className={inputClass} type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">Nytt passord
        <input className={inputClass} type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={event => setNewPassword(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">Gjenta nytt passord
        <input className={inputClass} type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
      </label>
      <button disabled={changingPassword} className="rounded-lg border border-white/20 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-50">{changingPassword ? 'Endrer …' : 'Endre passord'}</button>
    </form>
  </div>
}
