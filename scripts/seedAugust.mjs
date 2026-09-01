import { initializeApp } from 'firebase/app'
import { getFirestore, doc, writeBatch } from 'firebase/firestore'
import dotenv from 'dotenv'

dotenv.config()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase env. Check .env')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Unit Rates per vendor
const RAMAKRISHNA_RATES = { coffee: 13, tea: 12, biscuits: 6 }
const KUMAR_RATES = { coffee: 10, tea: 10, biscuits: 5 }

// Data format: [Day, Coffee, Tea, Biscuits, Total]
const ramakrishnaAugustData = [
  [1, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 16, 3, 8, 292],
  [4, 15, 3, 7, 273],
  [5, 15, 2, 6, 255],
  [6, 14, 3, 8, 266],
  [7, 13, 3, 6, 241],
  [8, 0, 0, 0, 0],
  [9, 0, 0, 0, 0],
  [10, 17, 2, 4, 269],
  [11, 16, 2, 6, 268],
  [12, 17, 2, 0, 245],
  [13, 16, 2, 4, 256],
  [14, 12, 2, 4, 204],
  [15, 0, 0, 0, 0],
  [16, 0, 0, 0, 0],
  [17, 15, 2, 5, 249],
  [18, 18, 3, 7, 312],
  [19, 18, 2, 4, 282],
  [20, 17, 3, 7, 299],
  [21, 17, 2, 7, 287],
  [22, 0, 0, 0, 0],
  [23, 0, 0, 0, 0],
  [24, 0, 0, 0, 0],
  [25, 0, 0, 0, 0],
  [26, 0, 0, 0, 0],
  [27, 0, 0, 0, 0],
  [28, 14, 2, 6, 242],
  [29, 0, 0, 0, 0],
  [30, 0, 0, 0, 0],
  [31, 17, 2, 5, 275],
]

const kumarAugustData = [
  [1, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 7, 3, 0, 100],
  [4, 10, 2, 0, 120],
  [5, 7, 6, 0, 130],
  [6, 7, 0, 7, 105],
  [7, 10, 0, 8, 140],
  [8, 0, 0, 0, 0],
  [9, 0, 0, 0, 0],
  [10, 10, 5, 0, 150],
  [11, 10, 5, 0, 150],
  [12, 10, 6, 0, 160],
  [13, 15, 0, 10, 200],
  [14, 0, 0, 0, 0],
  [15, 0, 0, 0, 0],
  [16, 0, 0, 0, 0],
  [17, 7, 0, 4, 90],
  [18, 13, 0, 14, 200],
  [19, 10, 6, 0, 160],
  [20, 13, 0, 5, 155],
  [21, 14, 0, 6, 170],
  [22, 0, 0, 0, 0],
  [23, 0, 0, 0, 0],
  [24, 7, 6, 10, 180],
  [25, 10, 8, 0, 180],
  [26, 35, 0, 9, 395],
  [27, 30, 0, 4, 320],
  [28, 7, 0, 0, 70],
  [29, 0, 0, 0, 0],
  [30, 0, 0, 0, 0],
  [31, 18, 0, 6, 210],
]

export async function seedAugustData() {
  console.log('Seeding August 2026 data to Firestore...')
  console.log(`Project: ${firebaseConfig.projectId}`)
  const batch = writeBatch(db)

  // 1. Seed Vendor Profiles & Item Pricing
  const ramakrishnaRef = doc(db, 'vendors', 'morning-ramakrishna')
  batch.set(ramakrishnaRef, {
    id: 'morning-ramakrishna',
    name: 'Ramakrishna',
    shift: 'Morning',
    isActive: true,
    items: [
      { id: 'coffee', name: 'Coffee', price: RAMAKRISHNA_RATES.coffee, isActive: true },
      { id: 'tea', name: 'Tea', price: RAMAKRISHNA_RATES.tea, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: RAMAKRISHNA_RATES.biscuits, isActive: true },
    ],
  })

  const kumarRef = doc(db, 'vendors', 'evening-kumar')
  batch.set(kumarRef, {
    id: 'evening-kumar',
    name: 'Kumar',
    shift: 'Evening',
    isActive: true,
    items: [
      { id: 'coffee', name: 'Coffee', price: KUMAR_RATES.coffee, isActive: true },
      { id: 'tea', name: 'Tea', price: KUMAR_RATES.tea, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: KUMAR_RATES.biscuits, isActive: true },
    ],
  })

  // 2. Seed Ramakrishna Entries (Morning Shift)
  for (const [day, coffee, tea, biscuits, total] of ramakrishnaAugustData) {
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `2026-08-${dayStr}`
    const entryRef = doc(db, 'daily_entries', `${dateStr}_morning-ramakrishna`)

    batch.set(entryRef, {
      date: dateStr,
      vendorId: 'morning-ramakrishna',
      items: {
        coffee: { quantity: coffee, unitPrice: RAMAKRISHNA_RATES.coffee, subtotal: coffee * RAMAKRISHNA_RATES.coffee },
        tea: { quantity: tea, unitPrice: RAMAKRISHNA_RATES.tea, subtotal: tea * RAMAKRISHNA_RATES.tea },
        biscuits: { quantity: biscuits, unitPrice: RAMAKRISHNA_RATES.biscuits, subtotal: biscuits * RAMAKRISHNA_RATES.biscuits },
      },
      totalAmount: total,
      notes: '',
      updatedAt: new Date().toISOString(),
    })
  }

  // 3. Seed Kumar Entries (Evening Shift)
  for (const [day, coffee, tea, biscuits, total] of kumarAugustData) {
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `2026-08-${dayStr}`
    const entryRef = doc(db, 'daily_entries', `${dateStr}_evening-kumar`)

    batch.set(entryRef, {
      date: dateStr,
      vendorId: 'evening-kumar',
      items: {
        coffee: { quantity: coffee, unitPrice: KUMAR_RATES.coffee, subtotal: coffee * KUMAR_RATES.coffee },
        tea: { quantity: tea, unitPrice: KUMAR_RATES.tea, subtotal: tea * KUMAR_RATES.tea },
        biscuits: { quantity: biscuits, unitPrice: KUMAR_RATES.biscuits, subtotal: biscuits * KUMAR_RATES.biscuits },
      },
      totalAmount: total,
      notes: '',
      updatedAt: new Date().toISOString(),
    })
  }

  await batch.commit()
  console.log('Done! August 2026 data successfully committed.')
  console.log(`- Vendors: 2 (Ramakrishna 13/12/6, Kumar 10/10/5)`)
  console.log(`- Entries: ${ramakrishnaAugustData.length + kumarAugustData.length} (31 + 31)`)
}

seedAugustData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e)
    if (e.code) console.error('Code:', e.code)
    if (e.message?.includes('permission')) {
      console.error('\nHint: Firestore Rules must allow write. In Firebase Console -> Firestore -> Rules set:')
      console.error('allow read, write: if true;  (for dev)')
    }
    process.exit(1)
  })
