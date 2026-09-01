import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore'
import dotenv from 'dotenv'
import { readFileSync, existsSync } from 'fs'

if (existsSync('.env')) {
  dotenv.config()
  // also load Vite-prefixed vars manually if needed
} else {
  console.error('Missing .env file')
  process.exit(1)
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase env variables in .env')
  console.error(firebaseConfig)
  process.exit(1)
}

console.log(`Initializing Firebase project: ${firebaseConfig.projectId} ...`)
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const SEED_VENDORS = [
  {
    id: 'morning-ramakrishna',
    name: 'Ramakrishna',
    shift: 'Morning',
    isActive: true,
    items: [
      { id: 'coffee', name: 'Coffee', price: 13, isActive: true },
      { id: 'tea', name: 'Tea', price: 12, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: 6, isActive: true },
    ],
  },
  {
    id: 'evening-kumar',
    name: 'Kumar',
    shift: 'Evening',
    isActive: true,
    items: [
      { id: 'coffee', name: 'Coffee', price: 13, isActive: true },
      { id: 'tea', name: 'Tea', price: 12, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: 6, isActive: true },
    ],
  },
]

const SAMPLE_ENTRY = {
  date: '2026-08-03',
  vendorId: 'morning-ramakrishna',
  items: {
    coffee: { quantity: 16, unitPrice: 13, subtotal: 208 },
    tea: { quantity: 3, unitPrice: 12, subtotal: 36 },
    biscuits: { quantity: 8, unitPrice: 6, subtotal: 48 },
  },
  totalAmount: 292,
  notes: '',
  updatedAt: new Date().toISOString(),
}

async function seed() {
  console.log('Seeding vendors...')
  for (const v of SEED_VENDORS) {
    const ref = doc(db, 'vendors', v.id)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      console.log(` - ${v.id} already exists, merging...`)
    } else {
      console.log(` - creating ${v.id}`)
    }
    await setDoc(ref, v, { merge: true })
    console.log(`   ✔ ${v.id} (${v.name} - ${v.shift})`)
  }

  console.log('\nVerifying vendors collection...')
  const vsnap = await getDocs(collection(db, 'vendors'))
  console.log(` Found ${vsnap.size} vendor(s):`)
  vsnap.forEach((d) => console.log(`  • ${d.id}:`, JSON.stringify(d.data())))

  console.log('\nSeeding sample daily_entry (optional demo data)...')
  const entryId = `${SAMPLE_ENTRY.date}_${SAMPLE_ENTRY.vendorId}`
  const eref = doc(db, 'daily_entries', entryId)
  const esnap = await getDoc(eref)
  if (!esnap.exists()) {
    await setDoc(eref, SAMPLE_ENTRY)
    console.log(` ✔ Created sample entry ${entryId} (₹292)`)
  } else {
    console.log(` - Sample entry ${entryId} already exists, skipping`)
  }

  console.log('\n✅ Seed complete! Firestore ready.')
  console.log(`Project: ${firebaseConfig.projectId}`)
  console.log(`Vendors: ${SEED_VENDORS.map((v) => v.id).join(', ')}`)
  console.log(`Collections: vendors, daily_entries`)
  process.exit(0)
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  console.error(e.code, e.message)
  if (e.message?.includes('permission')) {
    console.error('\nHint: Check Firestore Rules in Firebase Console -> Firestore Database -> Rules')
    console.error('For dev, allow: allow read, write: if true;')
  }
  process.exit(1)
})
