import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Calendar,
  Coffee,
  Cookie,
  CupSoda,
  Printer,
  Copy,
  Check,
  Settings2,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  UtensilsCrossed,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react'
import type { Vendor, DailyEntry, VendorItem } from '@/types'
import {
  fetchVendors,
  fetchEntriesForMonth,
  saveDailyEntry,
  upsertVendor,
  deleteVendor as deleteVendorService,
  SEED_VENDORS,
} from '@/services/firebaseService'
import { isFirebaseConfigured } from '@/lib/firebase'

// helpers
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}
function fmtDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase()
}
function currency(n: number) {
  return `₹${n.toLocaleString('en-IN')}`
}
function itemEmoji(id: string, name: string) {
  const k = id.toLowerCase()
  if (k.includes('coffee')) return '☕'
  if (k.includes('tea')) return '🍵'
  if (k.includes('biscuit')) return '🍪'
  if (k.includes('samosa')) return '🥟'
  if (k.includes('puff')) return '🥐'
  void name
  return '•'
}

export default function App() {
  // core state
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [vendors, setVendors] = useState<Vendor[]>(SEED_VENDORS)
  const [selectedVendorId, setSelectedVendorId] = useState<string>('morning-ramakrishna')
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map())
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // vendor modal
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [vendorForm, setVendorForm] = useState<Vendor>({
    id: '',
    name: '',
    shift: 'Morning',
    isActive: true,
    items: [
      { id: 'coffee', name: 'Coffee', price: 13, isActive: true },
      { id: 'tea', name: 'Tea', price: 12, isActive: true },
      { id: 'biscuits', name: 'Biscuits', price: 6, isActive: true },
    ],
  })
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState<number>(15)

  const printRef = useRef<HTMLDivElement>(null)

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? vendors[0],
    [vendors, selectedVendorId]
  )

  const days = getDaysInMonth(year, month)

  // to prevent race
  const loadId = useRef(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  // initial vendors load
  useEffect(() => {
    let cancelled = false
    async function loadVendors() {
      try {
        const vs = await fetchVendors()
        if (!cancelled && vs.length) {
          setVendors(vs)
          if (!vs.find((v) => v.id === selectedVendorId)) {
            setSelectedVendorId(vs[0].id)
          }
        }
      } catch (e) {
        console.error(e)
        showToast('Failed to load vendors')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadVendors()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line

  // load entries when month/year/vendor change
  useEffect(() => {
    if (!selectedVendor) return
    const cur = ++loadId.current
    setLoading(true)
    fetchEntriesForMonth(year, month, selectedVendor.id)
      .then((map) => {
        if (cur !== loadId.current) return
        setEntries(map)
      })
      .catch((e) => {
        console.error(e)
        showToast('Failed to load entries')
      })
      .finally(() => {
        if (cur === loadId.current) setLoading(false)
      })
  }, [year, month, selectedVendor?.id])

  // autosave debounce map
  const saveTimers = useRef<Map<string, number>>(new Map())

  const persistEntry = useCallback(
    async (entry: DailyEntry) => {
      setSavingKey(entry.date)
      try {
        await saveDailyEntry({ ...entry, updatedAt: new Date().toISOString() })
      } catch (e) {
        console.error(e)
        showToast('Save failed')
      } finally {
        setSavingKey((k) => (k === entry.date ? null : k))
      }
    },
    [showToast]
  )

  const handleQtyChange = (date: string, itemId: string, qtyStr: string) => {
    if (!selectedVendor) return
    let qty = parseInt(qtyStr, 10)
    if (isNaN(qty) || qtyStr === '') qty = 0
    if (qty < 0) qty = 0
    if (qty > 999) qty = 999

    const vendorItem = selectedVendor.items.find((i) => i.id === itemId)
    const unitPrice = vendorItem?.price ?? 0

    setEntries((prev) => {
      const next = new Map(prev)
      const existing = next.get(date)
      // create base items map from vendor active items + preserve existing
      const baseItems: DailyEntry['items'] = {}
      for (const vi of selectedVendor.items.filter((i) => i.isActive)) {
        const prevIt = existing?.items[vi.id]
        baseItems[vi.id] = prevIt
          ? { ...prevIt }
          : { quantity: 0, unitPrice: vi.price, subtotal: 0 }
      }
      // also keep any inactive items that already have data (to not lose)
      if (existing) {
        for (const [k, v] of Object.entries(existing.items)) {
          if (!baseItems[k]) baseItems[k] = { ...v }
        }
      }
      const cur = baseItems[itemId] ?? { quantity: 0, unitPrice, subtotal: 0 }
      const updated = { ...cur, quantity: qty, unitPrice, subtotal: qty * unitPrice }
      baseItems[itemId] = updated

      let total = 0
      for (const v of Object.values(baseItems)) total += v.subtotal

      const entry: DailyEntry = {
        date,
        vendorId: selectedVendor.id,
        items: baseItems,
        totalAmount: total,
        notes: existing?.notes ?? '',
        updatedAt: new Date().toISOString(),
      }
      next.set(date, entry)

      // debounce persist
      const prevTimer = saveTimers.current.get(date)
      if (prevTimer) window.clearTimeout(prevTimer)
      const t = window.setTimeout(() => persistEntry(entry), 450)
      saveTimers.current.set(date, t)

      return next
    })
  }

  // totals
  const totals = useMemo(() => {
    if (!selectedVendor) return { coffee: 0, tea: 0, biscuits: 0, snacks: 0, grand: 0, itemTotals: {} as Record<string, number> }
    let coffee = 0,
      tea = 0,
      biscuits = 0,
      snacks = 0,
      grand = 0
    const itemTotals: Record<string, number> = {}
    for (let d = 1; d <= days; d++) {
      const date = fmtDate(year, month, d)
      const e = entries.get(date)
      if (!e) continue
      grand += e.totalAmount
      for (const [itemId, it] of Object.entries(e.items)) {
        itemTotals[itemId] = (itemTotals[itemId] ?? 0) + it.quantity
        if (itemId === 'coffee') coffee += it.quantity
        else if (itemId === 'tea') tea += it.quantity
        else if (itemId === 'biscuits') biscuits += it.quantity
        else snacks += it.quantity
      }
    }
    // Include zero totals for vendor items not yet tallied
    for (const vi of selectedVendor.items) {
      if (!(vi.id in itemTotals)) itemTotals[vi.id] = 0
    }
    return { coffee, tea, biscuits, snacks, grand, itemTotals }
  }, [entries, days, year, month, selectedVendor])

  const activeItems = useMemo(
    () => (selectedVendor ? selectedVendor.items.filter((i) => i.isActive) : []),
    [selectedVendor]
  )

  // WhatsApp export
  const handleCopyWhatsApp = async () => {
    if (!selectedVendor) return
    const mName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })
    const headerItems = activeItems.map((i) => `*${i.name}*`).join(' | ')
    let lines: string[] = []
    lines.push(`*📊 DAILY BREAKDOWN (1-${days} ${mName.toUpperCase()})*`)
    lines.push(`*Vendor: ${selectedVendor.name} (${selectedVendor.shift})*`)
    lines.push('')
    lines.push(`*Date* | ${headerItems} | *Total*`)
    lines.push('─'.repeat(28))
    for (let d = 1; d <= days; d++) {
      const date = fmtDate(year, month, d)
      const e = entries.get(date)
      const label = `${d}-${mName}-${year}`
      const cols = activeItems.map((it) => {
        const itEntry = e?.items[it.id]
        const q = itEntry?.quantity ?? 0
        if (q === 0) return '0'
        return `${q} ${itemEmoji(it.id, it.name)}`
      })
      const total = e?.totalAmount ?? 0
      lines.push(`${label}: ${cols.join(' | ')} | *${total}*`)
    }
    lines.push('─'.repeat(28))
    lines.push('*📈 MONTH TOTALS*')
    for (const it of activeItems) {
      const qty = totals.itemTotals[it.id] ?? 0
      lines.push(`• *Total ${it.name}:* ${qty} ${itemEmoji(it.id, it.name)}`)
    }
    lines.push(`• *Grand Total:* *${currency(totals.grand)}*`)

    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      showToast('Copied to clipboard!')
    }
  }

  const handlePrint = () => window.print()

  // Vendor management
  const openAddVendor = () => {
    setEditingVendor(null)
    setVendorForm({
      id: '',
      name: '',
      shift: 'Evening',
      isActive: true,
      items: [
        { id: 'coffee', name: 'Coffee', price: 13, isActive: true },
        { id: 'tea', name: 'Tea', price: 12, isActive: true },
        { id: 'biscuits', name: 'Biscuits', price: 6, isActive: true },
      ],
    })
    setNewItemName('')
    setNewItemPrice(15)
    setShowVendorModal(true)
  }
  const openEditVendor = (v: Vendor) => {
    setEditingVendor(v)
    setVendorForm(structuredClone(v))
    setShowVendorModal(true)
  }
  const handleDeleteVendor = async (id: string) => {
    if (vendors.length <= 1) {
      showToast('At least one vendor required')
      return
    }
    if (!confirm('Delete this vendor and its entries reference?')) return
    try {
      await deleteVendorService(id)
      const next = vendors.filter((v) => v.id !== id)
      setVendors(next)
      if (selectedVendorId === id) setSelectedVendorId(next[0].id)
      showToast('Vendor deleted')
    } catch (e) {
      console.error(e)
      showToast('Delete failed')
    }
  }
  const handleSaveVendor = async () => {
    if (!vendorForm.name.trim()) {
      showToast('Vendor name required')
      return
    }
    let vid = vendorForm.id
    if (!editingVendor) {
      // generate id from name + shift
      const slug = vendorForm.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const shiftSlug = vendorForm.shift.toLowerCase()
      vid = `${shiftSlug}-${slug}` || `vendor-${Date.now()}`
      // ensure unique
      if (vendors.some((v) => v.id === vid)) vid = `${vid}-${Date.now()}`
    }
    const toSave: Vendor = { ...vendorForm, id: vid }
    // ensure item ids are slugified and unique
    const seen = new Set<string>()
    toSave.items = toSave.items.map((it) => {
      let id = it.id.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'item'
      let orig = id
      let c = 1
      while (seen.has(id)) {
        id = `${orig}-${c++}`
      }
      seen.add(id)
      return { ...it, id }
    })
    try {
      await upsertVendor(toSave)
      if (editingVendor) {
        setVendors((prev) => prev.map((v) => (v.id === editingVendor.id ? toSave : v)))
      } else {
        setVendors((prev) => [...prev, toSave])
        setSelectedVendorId(toSave.id)
      }
      setShowVendorModal(false)
      showToast(editingVendor ? 'Vendor updated' : 'Vendor added')
    } catch (e) {
      console.error(e)
      showToast('Save failed')
    }
  }
  const updateFormItemPrice = (itemId: string, price: number) => {
    setVendorForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, price: Math.max(0, price) } : it)),
    }))
  }
  const toggleFormItemActive = (itemId: string) => {
    setVendorForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, isActive: !it.isActive } : it)),
    }))
  }
  const removeFormItem = (itemId: string) => {
    setVendorForm((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== itemId) }))
  }
  const addFormItem = () => {
    const name = newItemName.trim()
    if (!name) {
      showToast('Item name required')
      return
    }
    if (vendorForm.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      showToast('Item already exists')
      return
    }
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    setVendorForm((prev) => ({
      ...prev,
      items: [...prev.items, { id, name, price: newItemPrice, isActive: true }],
    }))
    setNewItemName('')
  }

  const canPrev = !(year === 2020 && month === 1)
  const canNext = true

  const goPrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  const goNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-none tracking-tight">Tea & Refreshment</h1>
              <p className="text-xs text-slate-500 font-medium">Office Tracker</p>
            </div>
            {!isFirebaseConfigured && (
              <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> Offline mode — add .env to enable Firestore
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddVendor}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Vendor</span>
            </button>
            <button
              onClick={() => setShowVendorModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              <Settings2 className="w-4 h-4" /> <span className="hidden md:inline">Manage</span>
            </button>
          </div>
        </div>
      </header>

      {/* Vendor Tabs + Month Selector */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Vendor Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVendorId(v.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                  selectedVendorId === v.id
                    ? 'bg-white shadow-sm border border-slate-200 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${v.shift === 'Morning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                {v.name}
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${v.shift === 'Morning' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {v.shift}
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleCopyWhatsApp} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy WhatsApp'}
            </button>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50 shadow-sm">
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Month selector card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-slate-500 uppercase">Selected Month</div>
              <div className="text-lg font-extrabold">
                {new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })} {year}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goPrevMonth}
              disabled={!canPrev}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {Array.from({ length: 7 }, (_, i) => {
                  const y = now.getFullYear() - 2 + i
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                })}
              </select>
            </div>

            <button onClick={goNextMonth} disabled={!canNext} className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <SummaryCard icon={<Coffee className="w-5 h-5 text-amber-600" />} label="Total Coffee" value={totals.coffee} sub="cups" tone="amber" />
          <SummaryCard icon={<CupSoda className="w-5 h-5 text-emerald-600" />} label="Total Tea" value={totals.tea} sub="cups" tone="emerald" />
          <SummaryCard icon={<Cookie className="w-5 h-5 text-orange-600" />} label="Total Biscuits" value={totals.biscuits} sub="pcs" tone="orange" />
          <SummaryCard icon={<UtensilsCrossed className="w-5 h-5 text-violet-600" />} label="Total Snacks" value={totals.snacks} sub="items" tone="violet" />
          <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold tracking-widest uppercase">
              <TrendingUp className="w-4 h-4" /> Grand Total
            </div>
            <div className="mt-2 text-2xl font-extrabold">{currency(totals.grand)}</div>
            <div className="text-xs text-slate-400 mt-1">{days} days • {selectedVendor?.name}</div>
          </div>
        </div>

        {/* Table */}
        <div ref={printRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </span>
              Monthly Grid — <span className="text-slate-500 font-semibold">{new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })} {year}</span>
              <span className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-600">
                {selectedVendor?.name} • {selectedVendor?.shift}
              </span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">Enter quantities • auto-saves • ₹ per item from vendor pricing</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold tracking-widest uppercase border-b border-slate-200">
                  <th className="text-left px-4 py-3 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[110px]">Date</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">Day</th>
                  {activeItems.map((it) => (
                    <th key={it.id} className="text-center px-3 py-3 whitespace-nowrap min-w-[110px]">
                      <div className="flex flex-col items-center">
                        <span>{it.name}</span>
                        <span className="text-[11px] font-semibold normal-case tracking-normal text-slate-500">{currency(it.price)} each</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 whitespace-nowrap bg-slate-900 text-white sticky right-0 z-10 min-w-[110px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days }, (_, i) => {
                  const day = i + 1
                  const date = fmtDate(year, month, day)
                  const entry = entries.get(date)
                  const dObj = new Date(year, month - 1, day)
                  const dayName = dObj.toLocaleString('en-US', { weekday: 'short' })
                  const isWeekend = dObj.getDay() === 0
                  const isToday = date === new Date().toISOString().slice(0, 10)
                  const total = entry?.totalAmount ?? 0
                  return (
                    <tr key={date} className={`border-b border-slate-100 hover:bg-slate-50/70 ${isToday ? 'bg-amber-50/50' : ''} ${isWeekend ? 'bg-slate-50/30' : ''}`}>
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2 whitespace-nowrap border-r border-slate-100 font-semibold">
                        <span className={`inline-flex items-center gap-2 ${isToday ? 'text-amber-700' : ''}`}>
                          {isToday && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                          {day.toString().padStart(2, '0')}-{new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })}-{year}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-xs font-bold ${isWeekend ? 'text-red-500' : 'text-slate-500'}`}>{dayName}</td>
                      {activeItems.map((it) => {
                        const q = entry?.items[it.id]?.quantity ?? 0
                        return (
                          <td key={it.id} className="px-2 py-1.5 text-center">
                            <div className="flex justify-center">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={999}
                                value={q === 0 ? '' : q}
                                placeholder="0"
                                onChange={(e) => handleQtyChange(date, it.id, e.target.value)}
                                className="w-[72px] h-9 text-center rounded-xl border border-slate-200 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 placeholder:text-slate-300"
                              />
                            </div>
                          </td>
                        )
                      })}
                      <td className="sticky right-0 bg-white px-4 py-2 text-right font-extrabold whitespace-nowrap border-l border-slate-100">
                        <span className={`inline-flex items-center justify-end gap-1.5 min-w-[60px] ${total > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                          {savingKey === date && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                          {currency(total)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold">
                  <td colSpan={2} className="px-4 py-3 text-right sticky left-0 bg-slate-900">MONTH TOTAL</td>
                  {activeItems.map((it) => (
                    <td key={it.id} className="px-3 py-3 text-center">
                      {totals.itemTotals[it.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right sticky right-0 bg-slate-900">{currency(totals.grand)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading entries...
            </div>
          )}
          {!loading && !isFirebaseConfigured && (
            <div className="px-4 sm:px-6 py-3 bg-amber-50 border-t border-amber-100 text-amber-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Offline demo — entries stored in memory only. Configure Firebase env to persist.
            </div>
          )}
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-medium print:hidden">
            Tip: Price changes apply to new entries only — existing day totals keep their saved unit price until you re-edit the quantity.
          </div>
        </div>

        {/* Vendor overview + details */}
        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4" /> Vendors & Pricing
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {vendors.map((v) => (
                <div key={v.id} className={`rounded-2xl border p-4 ${selectedVendorId === v.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold flex items-center gap-2">
                        {v.name}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${v.shift === 'Morning' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{v.shift}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{v.id}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEditVendor(v)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteVendor(v.id)} className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {v.items.map((it) => (
                      <span key={it.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${it.isActive ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-100 border-slate-200 text-slate-400 line-through'}`}>
                        {it.name} • {currency(it.price)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm">
            <h4 className="font-bold">How WhatsApp export looks</h4>
            <pre className="mt-3 bg-white/10 rounded-xl p-3 text-[11px] leading-5 whitespace-pre-wrap font-mono overflow-auto max-h-[320px]">
{`*📊 DAILY BREAKDOWN (1-${days} ${monthName(month)})*
*Vendor: ${selectedVendor?.name ?? ''} (${selectedVendor?.shift ?? ''})*

*Date* | ${activeItems.map(i=>`*${i.name}*`).join(' | ')} | *Total*
────────────────────────────
1-${new Date(year, month-1,1).toLocaleString('en-US',{month:'long'})}-${year}: ${activeItems.map(()=>`0`).join(' | ')} | *0*
3-${new Date(year, month-1,1).toLocaleString('en-US',{month:'long'})}-${year}: ${activeItems.map(i=> `16 ${itemEmoji(i.id,i.name)}`).slice(0,1).join(' | ')}${activeItems.length>1?' | ...':''} | *292*
────────────────────────────
*📈 MONTH TOTALS*
${activeItems.map(i=>`• *Total ${i.name}:* ${totals.itemTotals[i.id]??0} ${itemEmoji(i.id,i.name)}`).join('\n')}
• *Grand Total:* *${currency(totals.grand)}*`}
            </pre>
            <button onClick={handleCopyWhatsApp} className="mt-3 w-full py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100">
              <Copy className="w-4 h-4" /> Copy WhatsApp Format
            </button>
          </div>
        </div>

        <footer className="py-10 text-center text-xs text-slate-400 font-medium">
          Tea & Refreshment Office Tracker • Firebase Spark • Vercel • Tailwind • Lucide • {year}
        </footer>
      </div>

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg">{editingVendor ? 'Edit Vendor' : vendorForm.id ? 'Manage Vendor' : 'Add Vendor & Items'}</h3>
                <p className="text-xs text-slate-500 font-medium">Per-vendor pricing • Add snacks dynamically (Samosa ₹15, Puff ₹20)</p>
              </div>
              <button onClick={() => setShowVendorModal(false)} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {!editingVendor && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-600">Vendor Name</span>
                    <input value={vendorForm.name} onChange={(e) => setVendorForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ramakrishna" className="w-full h-10 rounded-xl border border-slate-200 px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-600">Shift</span>
                    <select value={vendorForm.shift} onChange={(e) => setVendorForm((p) => ({ ...p, shift: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-200 px-3 font-semibold bg-white">
                      <option>Morning</option>
                      <option>Evening</option>
                    </select>
                  </label>
                </div>
              )}
              {editingVendor && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-600">Vendor Name</span>
                    <input value={vendorForm.name} onChange={(e) => setVendorForm((p) => ({ ...p, name: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-200 px-3 font-semibold" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-600">Shift</span>
                    <select value={vendorForm.shift} onChange={(e) => setVendorForm((p) => ({ ...p, shift: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-200 px-3 font-semibold bg-white">
                      <option>Morning</option>
                      <option>Evening</option>
                    </select>
                  </label>
                  <div className="sm:col-span-2 text-xs font-mono text-slate-500">ID: {vendorForm.id}</div>
                </div>
              )}

              <div>
                <div className="text-xs font-bold tracking-widest uppercase text-slate-600 mb-2">Items & Pricing</div>
                <div className="space-y-2">
                  {vendorForm.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{it.name} <span className="font-mono text-xs text-slate-500">({it.id})</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">₹</span>
                        <input type="number" min={0} value={it.price} onChange={(e) => updateFormItemPrice(it.id, parseInt(e.target.value) || 0)} className="w-20 h-8 rounded-lg border border-slate-200 text-center font-bold text-sm" />
                        <button onClick={() => toggleFormItemActive(it.id)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${it.isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                          {it.isActive ? 'Active' : 'Hidden'}
                        </button>
                        <button onClick={() => removeFormItem(it.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="New snack e.g. Samosa" className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500">₹</span>
                    <input type="number" min={0} value={newItemPrice} onChange={(e) => setNewItemPrice(parseInt(e.target.value) || 0)} className="w-20 h-10 rounded-xl border border-slate-200 text-center font-bold text-sm" />
                  </div>
                  <button onClick={addFormItem} className="px-4 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Examples: Samosa @ ₹15, Puff @ ₹20 — added per vendor only.</p>
              </div>

              {!editingVendor && vendorForm.name && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-medium text-amber-800">
                  New vendor ID will be: <span className="font-mono font-bold">{vendorForm.shift.toLowerCase()}-{vendorForm.name.toLowerCase().replace(/\s+/g, '-')}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setShowVendorModal(false)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-sm">Cancel</button>
              <button onClick={handleSaveVendor} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm inline-flex items-center gap-2">
                <Save className="w-4 h-4" /> {editingVendor ? 'Update Vendor' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl flex items-center gap-2 z-50">
          <Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number; sub: string; tone: string }) {
  const toneMap: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    orange: 'bg-orange-50 border-orange-100',
    violet: 'bg-violet-50 border-violet-100',
  }
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${toneMap[tone] ?? 'bg-white border-slate-200'} shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">{icon}</span>
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{sub}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold leading-none">{value.toLocaleString('en-IN')}</div>
      <div className="text-xs font-bold text-slate-600 mt-1">{label}</div>
    </div>
  )
}
