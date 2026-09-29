import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'

export type Profile = {
  username: string
  bio: string
  avatar: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export function profileRef(uid: string) {
  if (!db) throw new Error('Firestore er ikke konfigurert.')
  return doc(db, 'profiles', uid)
}

function initialUsername(user: User) {
  const prefix = (user.email?.split('@')[0] || 'Fisker').replace(/[^a-zA-Z0-9æøåÆØÅ_-]/g, '').slice(0, 20)
  return prefix.length >= 3 ? prefix : 'Fisker'
}

export async function ensureProfile(user: User) {
  const ref = profileRef(user.uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) {
    await setDoc(ref, {
      username: initialUsername(user),
      bio: '',
      avatar: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

export function watchProfile(uid: string, onChange: (profile: Profile | null) => void, onError: (error: Error) => void) {
  return onSnapshot(profileRef(uid), snapshot => {
    onChange(snapshot.exists() ? snapshot.data() as Profile : null)
  }, onError)
}

export function profileError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === 'permission-denied') return 'Mangler tilgang til profilen. Kontroller Firestore-reglene.'
  if (code === 'unavailable') return 'Firestore er ikke tilgjengelig akkurat nå. Prøv igjen.'
  return 'Kunne ikke hente eller lagre profilen. Kontroller at Firestore er opprettet.'
}

export async function resizeAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Velg en bildefil.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Bildet kan ikke være større enn 8 MB.')
  const image = await createImageBitmap(file)
  try {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Kunne ikke behandle bildet.')
    const scale = Math.max(size / image.width, size / image.height)
    const width = image.width * scale
    const height = image.height * scale
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
    const data = canvas.toDataURL('image/jpeg', 0.75)
    if (data.length > 100000) throw new Error('Bildet ble for stort etter komprimering.')
    return data
  } finally {
    image.close()
  }
}
