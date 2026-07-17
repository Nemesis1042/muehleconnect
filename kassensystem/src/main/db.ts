import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { Product, ProductInput, Settings } from '../shared/types'

export const PFAND_PRODUCT_CODE = 'PFAND'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

export function initDb(dbPath?: string): Database.Database {
  const path = dbPath ?? join(app.getPath('userData'), 'kassensystem.db')
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category TEXT NOT NULL,
      tax_class TEXT NOT NULL CHECK (tax_class IN ('A', 'B')),
      deposit_cents INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_cents INTEGER NOT NULL,
      cash_received_cents INTEGER NOT NULL,
      change_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      tax_class TEXT NOT NULL CHECK (tax_class IN ('A', 'B')),
      voucher_number_start INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  seedDefaults()
  return db
}

const DEFAULT_SETTINGS: Settings = {
  titleLine1: '45 Jahre Dobelmühle',
  titleLine2: 'Mühle live',
  orgName: 'Dobelmühle gGmbH',
  orgStreet: 'Dobelmühle 24',
  orgZipCity: '88326 Aulendorf',
  orgTaxId: '',
  registerNumber: 1,
  taxRateA: 7,
  taxRateB: 19,
  printerConnection: '',
  printerVendorId: '',
  printerProductId: '',
  printerSerialPath: '',
  // Vorbelegt mit dem am Kassen-Laptop bestätigten Wert; der ESC/POS-Standard wäre 9600, aber
  // nicht jeder Drucker hält sich daran (Feld bleibt frei änderbar).
  printerSerialBaudRate: 19200
}

const COUNTER_RECEIPT = 'counter_receipt_number'
const COUNTER_VOUCHER = 'counter_voucher_number'

function seedDefaults(): void {
  const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c
  if (settingsCount === 0) {
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        insert.run(key, String(value))
      }
      insert.run(COUNTER_RECEIPT, '0')
      insert.run(COUNTER_VOUCHER, '0')
    })
    tx()
  }

  const pfand = db.prepare('SELECT id FROM products WHERE code = ?').get(PFAND_PRODUCT_CODE)
  if (!pfand) {
    db.prepare(
      `INSERT INTO products (code, name, price_cents, category, tax_class, deposit_cents, sort_order, active)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1)`
    ).run(PFAND_PRODUCT_CODE, 'Pfand', 0, 'Pfand', 'B', 999)
  }

  const productCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c
  if (productCount === 1) {
    seedSampleProducts()
  }
}

function seedSampleProducts(): void {
  const sample: Array<Omit<ProductInput, 'active'>> = [
    { name: 'Maultaschen mit Kartoffelsalat', priceCents: 800, category: 'Essen', taxClass: 'A', depositCents: 0, sortOrder: 1 },
    { name: 'Wilde Kartoffeln', priceCents: 250, category: 'Essen', taxClass: 'A', depositCents: 0, sortOrder: 2 },
    { name: 'Pommes', priceCents: 200, category: 'Essen', taxClass: 'A', depositCents: 0, sortOrder: 3 },
    { name: 'Kuchen', priceCents: 300, category: 'Essen', taxClass: 'A', depositCents: 0, sortOrder: 4 },
    { name: 'Kaffee', priceCents: 100, category: 'Essen', taxClass: 'A', depositCents: 0, sortOrder: 5 },
    { name: 'Bier', priceCents: 200, category: 'Getränke', taxClass: 'B', depositCents: 50, sortOrder: 6 },
    { name: 'Radler', priceCents: 200, category: 'Getränke', taxClass: 'B', depositCents: 50, sortOrder: 7 },
    { name: 'Citro', priceCents: 150, category: 'Getränke', taxClass: 'B', depositCents: 50, sortOrder: 8 },
    { name: 'Apfelschorle', priceCents: 150, category: 'Getränke', taxClass: 'B', depositCents: 50, sortOrder: 9 },
    { name: 'Mineralwasser', priceCents: 100, category: 'Getränke', taxClass: 'B', depositCents: 50, sortOrder: 10 }
  ]
  const insert = db.prepare(
    `INSERT INTO products (name, price_cents, category, tax_class, deposit_cents, sort_order, active)
     VALUES (@name, @priceCents, @category, @taxClass, @depositCents, @sortOrder, 1)`
  )
  const tx = db.transaction(() => {
    for (const p of sample) insert.run(p)
  })
  tx()
}

export function nextReceiptNumber(): number {
  return incrementCounter(COUNTER_RECEIPT)
}

export function nextVoucherNumbers(count: number): number {
  // returns the first number of a contiguous block of `count` numbers
  const current = Number(
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(COUNTER_VOUCHER) as { value: string }).value
  )
  const start = current + 1
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(current + count), COUNTER_VOUCHER)
  return start
}

function incrementCounter(key: string): number {
  const current = Number(
    (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string }).value
  )
  const next = current + 1
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(next), key)
  return next
}

export function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    category: row.category,
    taxClass: row.tax_class,
    depositCents: row.deposit_cents,
    sortOrder: row.sort_order,
    active: !!row.active,
    createdAt: row.created_at
  }
}
