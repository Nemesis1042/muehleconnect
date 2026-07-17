export type TaxClass = 'A' | 'B'

export interface Product {
  id: number
  name: string
  priceCents: number
  category: string
  taxClass: TaxClass
  depositCents: number
  sortOrder: number
  active: boolean
  createdAt: string
}

export type ProductInput = Omit<Product, 'id' | 'createdAt'>

/** What the renderer sends when checking out: just what was clicked, no prices (server is authoritative). */
export interface CartInputLine {
  productId: number
  quantity: number
}

/** Expanded line (incl. auto-added Pfand lines) used for display and for authoritative sale creation. */
export interface CartLine {
  productId: number
  productName: string
  priceCents: number
  taxClass: TaxClass
  quantity: number
  /** true for the auto-generated Pfand line belonging to another cart line */
  isDeposit: boolean
}

export interface SaleItemRecord {
  id: number
  saleId: number
  productId: number
  productName: string
  priceCents: number
  quantity: number
  taxClass: TaxClass
  voucherNumberStart: number
}

export interface SaleRecord {
  id: number
  receiptNumber: number
  createdAt: string
  totalCents: number
  cashReceivedCents: number
  changeCents: number
  items: SaleItemRecord[]
}

export interface CreateSaleInput {
  lines: CartInputLine[]
  cashReceivedCents: number
  /** Wertbons werden immer gedruckt; der kombinierte Kassenzettel ist pro Verkauf optional. */
  printReceipt: boolean
}

export interface CreateSaleResult {
  sale: SaleRecord
  printResult: PrintResult
}

export interface Settings {
  titleLine1: string
  titleLine2: string
  orgName: string
  orgStreet: string
  orgZipCity: string
  orgTaxId: string
  registerNumber: number
  taxRateA: number
  taxRateB: number
  printerVendorId: string
  printerProductId: string
}

export interface TaxBreakdownEntry {
  taxClass: TaxClass
  ratePercent: number
  netCents: number
  taxCents: number
  grossCents: number
}

export interface JournalEntry {
  productId: number
  productName: string
  taxClass: TaxClass
  quantity: number
  priceCents: number
  totalCents: number
}

export interface JournalReport {
  from: string
  to: string
  entries: JournalEntry[]
  totalCents: number
  taxBreakdown: TaxBreakdownEntry[]
}

export interface UsbDeviceInfo {
  vendorId: number
  productId: number
  vendorIdHex: string
  productIdHex: string
  manufacturer?: string
  product?: string
}

export interface PrintJobItem {
  kind: 'receipt' | 'voucher' | 'journal'
  ok: boolean
  error?: string
}

export interface PrintResult {
  ok: boolean
  jobs: PrintJobItem[]
}

export interface KassenApi {
  products: {
    list(): Promise<Product[]>
    getPfand(): Promise<Product>
    create(input: ProductInput): Promise<Product>
    update(id: number, input: Partial<ProductInput>): Promise<Product>
    remove(id: number): Promise<void>
    reorder(orderedIds: number[]): Promise<void>
  }
  sale: {
    create(input: CreateSaleInput): Promise<CreateSaleResult>
    reprint(saleId: number): Promise<PrintResult>
  }
  printer: {
    listDevices(): Promise<UsbDeviceInfo[]>
    testPrint(): Promise<PrintResult>
  }
  settings: {
    get(): Promise<Settings>
    update(input: Partial<Settings>): Promise<Settings>
  }
  journal: {
    get(from: string, to: string): Promise<JournalReport>
    print(from: string, to: string): Promise<PrintResult>
  }
}
