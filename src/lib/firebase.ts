import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAtx202yd5LTz-1FXGgzQdWgRQh1D2WV5Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fiskespillet-6319e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fiskespillet-6319e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fiskespillet-6319e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '829769927625',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:829769927625:web:8634c8d2d2ff6750237618',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-KWF7WT3VCG',
}

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
)

export const firebaseApp: FirebaseApp | null = firebaseConfigured
  ? initializeApp(config)
  : null
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
