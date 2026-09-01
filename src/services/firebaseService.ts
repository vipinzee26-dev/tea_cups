import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type { Vendor, DailyEntry } from '@/types'

// ---- Seed Data (per PROJECT.md) ----
export const SEED_VENDORS: Vendor[] = [
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

// ---- In-memory fallback when Firebase not configured ----
const memory = {
  vendors: new Map<string, Vendor>(SEED_VENDORS.map((v) => [v.id, structuredClone(v)])),
  entries: new Map<string, DailyEntry>(),
}

function entryDocId(date: string, vendorId: string) {
  return `${date}_${vendorId}`
}

// ---- Vendors ----
export async function fetchVendors(): Promise<Vendor[]> {
  if (!isFirebaseConfigured || !db) {
    return Array.from(memory.vendors.values()).sort((a, b) => a.shift.localeCompare(b.shift))
  }
  const snap = await getDocs(collection(db, 'vendors'))
  if (snap.empty) {
    // seed if empty
    await seedVendors()
    const seeded = await getDocs(collection(db, 'vendors'))
    return seeded.docs.map((d) => d.data() as Vendor)
  }
  return snap.docs.map((d) => d.data() as Vendor)
}

export async function upsertVendor(vendor: Vendor): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    memory.vendors.set(vendor.id, structuredClone(vendor))
    return
  }
  await setDoc(doc(db, 'vendors', vendor.id), vendor, { merge: true })
}

export async function deleteVendor(vendorId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    memory.vendors.delete(vendorId)
    return
  }
  await deleteDoc(doc(db, 'vendors', vendorId))
}

export async function seedVendors(): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  for (const v of SEED_VENDORS) {
    const ref = doc(db, 'vendors', v.id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      await setDoc(ref, v)
    }
  }
}

// ---- Daily Entries ----
export async function fetchEntriesForMonth(
  year: number,
  month: number, // 1-12
  vendorId: string
): Promise<Map<string, DailyEntry>> {
  const prefix = `${year}-${String(month).padStart(2, '0')}` // YYYY-MM
  if (!isFirebaseConfigured || !db) {
    const out = new Map<string, DailyEntry>()
    for (const [k, v] of memory.entries) {
      if (v.vendorId === vendorId && v.date.startsWith(prefix)) out.set(v.date, v)
    }
    return out
  }
  // Query by vendorId and date range would need composite index; simple fetch all for vendor + filter client-side for simplicity
  const q = query(collection(db, 'daily_entries'), where('vendorId', '==', vendorId))
  const snap = await getDocs(q)
  const out = new Map<string, DailyEntry>()
  for (const d of snap.docs) {
    const e = d.data() as DailyEntry
    if (e.date.startsWith(prefix)) out.set(e.date, e)
  }
  return out
}

export async function saveDailyEntry(entry: DailyEntry): Promise<void> {
  const id = entryDocId(entry.date, entry.vendorId)
  if (!isFirebaseConfigured || !db) {
    memory.entries.set(id, structuredClone(entry))
    return
  }
  await setDoc(doc(db, 'daily_entries', id), entry, { merge: true })
}

export async function deleteDailyEntry(date: string, vendorId: string): Promise<void> {
  const id = entryDocId(date, vendorId)
  if (!isFirebaseConfigured || !db) {
    memory.entries.delete(id)
    return
  }
  await deleteDoc(doc(db, 'daily_entries', id))
}

// ---- Utils ----
export function calcEntryTotal(
  items: Record<string, { quantity: number; unitPrice: number }>
): number {
  let total = 0
  for (const v of Object.values(items)) total += v.quantity * v.unitPrice
  return total
}

export function buildEmptyEntry(date: string, vendor: Vendor): DailyEntry {
  const items: DailyEntry['items'] = {}
  for (const it of vendor.items.filter((i) => i.isActive)) {
    items[it.id] = { quantity: 0, unitPrice: it.price, subtotal: 0 }
  }
  return {
    date,
    vendorId: vendor.id,
    items,
    totalAmount: 0,
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}
