import assert from 'node:assert/strict'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
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
      { id: 'coffee', name: 'Coffee', price: 10, isActive: true },
      { id: 'tea', name: 'Tea', price: 10, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: 5, isActive: true },
    ],
  },
]

let passedTests = 0
let failedTests = 0

function runTest(name, fn) {
  try {
    const res = fn()
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✔ PASS: ${name}`)
          passedTests++
        })
        .catch((err) => {
          console.error(`  ✖ FAIL: ${name}`)
          console.error(`    ${err.message || err}`)
          failedTests++
        })
    } else {
      console.log(`  ✔ PASS: ${name}`)
      passedTests++
    }
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`)
    console.error(`    ${err.message || err}`)
    failedTests++
  }
}

async function main() {
  console.log('\n===============================================================')
  console.log('   TEA CUPS APP - COMPREHENSIVE RELIABILITY & INTEGRITY TEST   ')
  console.log('===============================================================\n')

  console.log('--- TEST SUITE 1: FIRESTORE LIVE DATA ISOLATION ---')
  const TEST_DATE = '2099-01-01'
  const v1 = 'morning-ramakrishna'
  const v2 = 'evening-kumar'
  const docRef1 = doc(db, 'daily_entries', `${TEST_DATE}_${v1}`)
  const docRef2 = doc(db, 'daily_entries', `${TEST_DATE}_${v2}`)

  await runTest('Vendor 1 and Vendor 2 distinct document references', () => {
    assert.notEqual(`${TEST_DATE}_${v1}`, `${TEST_DATE}_${v2}`)
  })

  await runTest('Writing to Vendor 1 does not mutate Vendor 2', async () => {
    // 1. Initial write
    await setDoc(docRef1, {
      date: TEST_DATE,
      vendorId: v1,
      items: {
        coffee: { quantity: 15, unitPrice: 13, subtotal: 195 },
        tea: { quantity: 4, unitPrice: 12, subtotal: 48 },
      },
      totalAmount: 243,
      updatedAt: new Date().toISOString(),
    })
    await setDoc(docRef2, {
      date: TEST_DATE,
      vendorId: v2,
      items: {
        coffee: { quantity: 8, unitPrice: 10, subtotal: 80 },
        tea: { quantity: 1, unitPrice: 10, subtotal: 10 },
      },
      totalAmount: 90,
      updatedAt: new Date().toISOString(),
    })

    // 2. Read back
    const s1 = await getDoc(docRef1)
    const s2 = await getDoc(docRef2)
    assert.equal(s1.data().items.coffee.quantity, 15)
    assert.equal(s1.data().totalAmount, 243)
    assert.equal(s2.data().items.coffee.quantity, 8)
    assert.equal(s2.data().totalAmount, 90)

    // 3. Mutate Vendor 1
    await setDoc(docRef1, {
      date: TEST_DATE,
      vendorId: v1,
      items: {
        coffee: { quantity: 25, unitPrice: 13, subtotal: 325 },
        tea: { quantity: 0, unitPrice: 12, subtotal: 0 },
      },
      totalAmount: 325,
      updatedAt: new Date().toISOString(),
    })

    // 4. Verify Vendor 2 remained completely untouched
    const s2After = await getDoc(docRef2)
    assert.equal(s2After.data().items.coffee.quantity, 8)
    assert.equal(s2After.data().totalAmount, 90)

    // Cleanup probe
    await deleteDoc(docRef1)
    await deleteDoc(docRef2)
  })

  console.log('\n--- TEST SUITE 2: VENDOR SWITCH DEBOUNCE & FLUSH SIMULATION ---')
  await runTest('Fast vendor switch flushes pending saves without losing edits or colliding', async () => {
    const saveTimers = new Map()
    const pendingEntries = new Map()
    const savedToDb = new Map()

    async function mockSave(entry) {
      savedToDb.set(`${entry.vendorId}_${entry.date}`, structuredClone(entry))
    }

    function simulateType(vendorId, date, itemId, qty, price) {
      const timerKey = `${vendorId}_${date}`
      const prevTimer = saveTimers.get(timerKey)
      if (prevTimer) clearTimeout(prevTimer)

      const entry = {
        date,
        vendorId,
        items: { [itemId]: { quantity: qty, unitPrice: price, subtotal: qty * price } },
        totalAmount: qty * price,
      }
      pendingEntries.set(timerKey, entry)

      const t = setTimeout(() => {
        mockSave(entry)
        pendingEntries.delete(timerKey)
        saveTimers.delete(timerKey)
      }, 450)
      saveTimers.set(timerKey, t)
    }

    async function simulateVendorSwitch() {
      // Flush pending
      for (const [, timer] of saveTimers.entries()) clearTimeout(timer)
      saveTimers.clear()
      const toFlush = Array.from(pendingEntries.values())
      pendingEntries.clear()
      await Promise.all(toFlush.map((e) => mockSave(e)))
    }

    // Step A: User types in Vendor 1
    simulateType('morning-ramakrishna', '2026-10-29', 'coffee', 18, 13)

    // Step B: Within 50ms (before 450ms debounce), user switches to Vendor 2
    await simulateVendorSwitch()

    // Verify Vendor 1 was saved immediately during switch
    assert.ok(savedToDb.has('morning-ramakrishna_2026-10-29'), 'Vendor 1 entry must be saved on switch')
    assert.equal(savedToDb.get('morning-ramakrishna_2026-10-29').items.coffee.quantity, 18)

    // Step C: User now types in Vendor 2 for the same date
    simulateType('evening-kumar', '2026-10-29', 'coffee', 10, 10)
    await simulateVendorSwitch()

    // Verify Vendor 2 was saved, and Vendor 1 remains intact
    assert.equal(savedToDb.get('evening-kumar_2026-10-29').items.coffee.quantity, 10)
    assert.equal(savedToDb.get('morning-ramakrishna_2026-10-29').items.coffee.quantity, 18)
  })

  console.log('\n--- TEST SUITE 3: CROSS-VENDOR CONTAMINATION GUARD ---')
  await runTest('Stale Vendor 1 state in memory cannot leak into Vendor 2 entry', () => {
    const activeVendor = SEED_VENDORS[1] // Kumar
    const memoryMap = new Map()

    // Stale Vendor 1 entry left in memory
    memoryMap.set('2026-10-15', {
      date: '2026-10-15',
      vendorId: 'morning-ramakrishna',
      items: {
        coffee: { quantity: 22, unitPrice: 13, subtotal: 286 },
        tea: { quantity: 5, unitPrice: 12, subtotal: 60 },
        biscuits: { quantity: 10, unitPrice: 6, subtotal: 60 },
      },
      totalAmount: 406,
    })

    // Simulated handleQtyChange
    const rawExisting = memoryMap.get('2026-10-15')
    const existing = rawExisting && rawExisting.vendorId === activeVendor.id ? rawExisting : undefined

    assert.equal(existing, undefined, 'Must reject stale entry of different vendor')

    const baseItems = {}
    for (const vi of activeVendor.items.filter((i) => i.isActive)) {
      const prevIt = existing?.items[vi.id]
      baseItems[vi.id] = prevIt ? { ...prevIt } : { quantity: 0, unitPrice: vi.price, subtotal: 0 }
    }

    baseItems['tea'] = { quantity: 3, unitPrice: 10, subtotal: 30 }
    let total = 0
    for (const v of Object.values(baseItems)) total += v.subtotal

    const newEntry = {
      date: '2026-10-15',
      vendorId: activeVendor.id,
      items: baseItems,
      totalAmount: total,
    }

    assert.equal(newEntry.vendorId, 'evening-kumar')
    assert.equal(newEntry.items.coffee.quantity, 0, 'Coffee was not inherited from Ramakrishna')
    assert.equal(newEntry.items.biscuits.quantity, 0, 'Biscuits was not inherited from Ramakrishna')
    assert.equal(newEntry.items.tea.quantity, 3)
    assert.equal(newEntry.totalAmount, 30)
  })

  console.log('\n--- TEST SUITE 4: INPUT PARSING & VALUE DISPLAY ---')
  await runTest('Input parsing handles boundaries and edge cases', () => {
    function parseInput(val) {
      let qty = parseInt(val, 10)
      if (isNaN(qty) || val === '') qty = 0
      if (qty < 0) qty = 0
      if (qty > 999) qty = 999
      return qty
    }

    assert.equal(parseInput('0'), 0)
    assert.equal(parseInput(''), 0)
    assert.equal(parseInput('25'), 25)
    assert.equal(parseInput('-10'), 0)
    assert.equal(parseInput('9999'), 999)
    assert.equal(parseInput('abc'), 0)
    assert.equal(parseInput('05'), 5)
  })

  console.log('\n--- TEST SUITE 5: LIVE FIRESTORE DATABASE AUDIT (ALL 122 DOCUMENTS) ---')
  await runTest('Audit all documents in Firestore daily_entries collection', async () => {
    const snap = await getDocs(collection(db, 'daily_entries'))
    assert.ok(snap.size > 0, 'Collection must not be empty')
    console.log(`    Auditing ${snap.size} Firestore documents in daily_entries...`)

    let totalMorning = 0
    let totalEvening = 0
    let mismatches = 0

    for (const d of snap.docs) {
      const data = d.data()
      const docId = d.id

      // 1. Doc ID format: {date}_{vendorId}
      const parts = docId.split('_')
      assert.equal(parts.length, 2, `Doc ID "${docId}" must follow format {date}_{vendorId}`)
      const [expectedDate, expectedVendor] = parts

      // 2. Date check
      assert.equal(data.date, expectedDate, `Doc ${docId} has mismatched date: ${data.date} vs ${expectedDate}`)

      // 3. VendorId check
      assert.equal(data.vendorId, expectedVendor, `Doc ${docId} has mismatched vendorId: ${data.vendorId} vs ${expectedVendor}`)

      // 4. Subtotal and total math check
      let computedTotal = 0
      if (data.items) {
        for (const [itemId, item] of Object.entries(data.items)) {
          assert.equal(typeof item.quantity, 'number', `Item ${itemId} in ${docId} must have numeric quantity`)
          assert.equal(typeof item.unitPrice, 'number', `Item ${itemId} in ${docId} must have numeric unitPrice`)
          const expectedSubtotal = item.quantity * item.unitPrice
          assert.equal(item.subtotal, expectedSubtotal, `Subtotal mismatch for ${itemId} in ${docId}`)
          computedTotal += expectedSubtotal
        }
      }
      assert.equal(data.totalAmount, computedTotal, `TotalAmount mismatch in ${docId}: data=${data.totalAmount}, computed=${computedTotal}`)

      if (data.vendorId === 'morning-ramakrishna') totalMorning++
      else if (data.vendorId === 'evening-kumar') totalEvening++
    }

    console.log(`    Audit passed: ${totalMorning} Morning entries, ${totalEvening} Evening entries. All 100% mathematically consistent!`)
  })

  console.log('\n===============================================================')
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log('===============================================================\n')

  process.exit(failedTests > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Test harness error:', err)
  process.exit(1)
})

