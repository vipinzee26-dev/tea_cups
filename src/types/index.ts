export type VendorItem = {
  id: string
  name: string
  price: number
  isActive: boolean
}

export type Vendor = {
  id: string
  name: string
  shift: 'Morning' | 'Evening' | string
  isActive: boolean
  items: VendorItem[]
}

export type DailyEntryItem = {
  quantity: number
  unitPrice: number
  subtotal: number
}

export type DailyEntry = {
  date: string // YYYY-MM-DD
  vendorId: string
  items: Record<string, DailyEntryItem>
  totalAmount: number
  notes: string
  updatedAt: string // ISO
}
