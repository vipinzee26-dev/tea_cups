import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
)

let app: FirebaseApp | null = null
let db: Firestore | null = null

let analytics: unknown = null

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig as Record<string, string>)
  db = getFirestore(app)
  // Analytics only in browser, non-blocking
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    import('firebase/analytics')
      .then(({ getAnalytics, isSupported }) =>
        isSupported().then((ok) => {
          if (ok && app) analytics = getAnalytics(app)
        })
      )
      .catch(() => {})
  }
} else {
  console.warn(
    '[Firebase] Missing VITE_FIREBASE_* env variables. Running in offline/mock mode. Add .env to enable Firestore persistence.'
  )
}

export { app, db, analytics }
