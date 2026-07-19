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
  voided: boolean
  items: SaleItemRecord[]
}

/** One row per sale item, flattened for the CSV/Excel/PDF data exports. */
export interface SaleExportRow {
  saleId: number
  receiptNumber: number
  createdAt: string
  voided: boolean
  productName: string
  quantity: number
  priceCents: number
  totalCents: number
  taxClass: TaxClass
}

export interface CreateSaleInput {
  lines: CartInputLine[]
  cashReceivedCents: number
}

/** printReceipt/printVouchers default to false/true - see printSale() in src/main/printer.ts. */
export interface PrintSaleOptions {
  printReceipt?: boolean
  printVouchers?: boolean
}

export interface CreateSaleResult {
  sale: SaleRecord
  printResult: PrintResult
}

export type PrinterConnection = 'usb' | 'serial' | ''

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
  /** Which of the configurations below is actually active; '' falls back to Dry-Run. */
  printerConnection: PrinterConnection
  printerVendorId: string
  printerProductId: string
  printerSerialPath: string
  printerSerialBaudRate: number
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

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
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

export interface BackupInfo {
  path: string
  /** ISO timestamp of the last automatic backup. */
  at: string
}

export interface BackupResult {
  ok: boolean
  path?: string
  error?: string
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
    create(input: CreateSaleInput, printOptions?: PrintSaleOptions): Promise<CreateSaleResult>
    reprint(saleId: number, options?: PrintSaleOptions): Promise<PrintResult>
    void(saleId: number): Promise<SaleRecord>
  }
  printer: {
    listDevices(): Promise<UsbDeviceInfo[]>
    listSerialPorts(): Promise<SerialPortInfo[]>
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
  backup: {
    exportToFile(): Promise<BackupResult>
    getLastAuto(): Promise<BackupInfo | null>
    exportCsv(): Promise<BackupResult>
    exportExcel(): Promise<BackupResult>
    exportPdf(): Promise<BackupResult>
  }
}
