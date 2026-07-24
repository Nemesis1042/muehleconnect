import { getDb, nextReceiptNumber, nextVoucherNumbers } from './db'
import { listProducts, getPfandProduct } from './products'
import { expandCart, cartTotalCents, changeCents } from '../shared/cart'
import type {
  CartInputLine,
  CartLine,
  CreateSaleInput,
  SaleExportRow,
  SaleItemRecord,
  SaleRecord
} from '../shared/types'

/**
 * Expands raw cart lines (product IDs + quantities) into full lines with names/prices, without
 * creating a sale or touching any counters - used to print Wertbons the moment "Kassieren" wird
 * geöffnet, before the amount received is even known, let alone confirmed.
 */
export function expandCartForPreview(input: CartInputLine[]): CartLine[] {
  const products = listProducts()
  const pfand = getPfandProduct()
  return expandCart(input, products, pfand)
}

export function createSale(input: CreateSaleInput): SaleRecord {
  const products = listProducts()
  const pfand = getPfandProduct()
  const lines = expandCart(input.lines, products, pfand)
  if (lines.length === 0) throw new Error('Warenkorb ist leer')

  const totalCents = cartTotalCents(lines)
  const change = changeCents(input.cashReceivedCents, totalCents)
  if (change < 0) throw new Error('Erhaltener Betrag ist niedriger als die Summe')

  const db = getDb()
  let saleId = 0

  const tx = db.transaction(() => {
    const receiptNumber = nextReceiptNumber()
    const saleResult = db
      .prepare(
        `INSERT INTO sales (receipt_number, total_cents, cash_received_cents, change_cents)
         VALUES (?, ?, ?, ?)`
      )
      .run(receiptNumber, totalCents, input.cashReceivedCents, change)
    saleId = Number(saleResult.lastInsertRowid)

    const insertItem = db.prepare(
      `INSERT INTO sale_items
         (sale_id, product_id, product_name, price_cents, quantity, tax_class, voucher_number_start)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const line of lines) {
      const voucherStart = nextVoucherNumbers(line.quantity)
      insertItem.run(
        saleId,
        line.productId,
        line.productName,
        line.priceCents,
        line.quantity,
        line.taxClass,
        voucherStart
      )
    }
  })
  tx()

  return getSale(saleId)
}

/** Flat, one-row-per-sale-item view of every sale ever recorded - the basis for the CSV/Excel/PDF
 * data exports (unlike getJournal(), this isn't aggregated or date-filtered: it's the full,
 * auditable history for a backup/export, not a day's till report). */
export function listAllSaleItemsForExport(): SaleExportRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id as sale_id, s.receipt_number, s.created_at, s.voided,
              si.product_name, si.quantity, si.price_cents, si.tax_class
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       ORDER BY s.id ASC, si.id ASC`
    )
    .all() as Array<{
    sale_id: number
    receipt_number: number
    created_at: string
    voided: number
    product_name: string
    quantity: number
    price_cents: number
    tax_class: 'A' | 'B'
  }>

  return rows.map((r) => ({
    saleId: r.sale_id,
    receiptNumber: r.receipt_number,
    createdAt: r.created_at,
    voided: !!r.voided,
    productName: r.product_name,
    quantity: r.quantity,
    priceCents: r.price_cents,
    totalCents: r.price_cents * r.quantity,
    taxClass: r.tax_class
  }))
}

export function voidSale(id: number): SaleRecord {
  const db = getDb()
  const result = db.prepare('UPDATE sales SET voided = 1 WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error(`Verkauf ${id} nicht gefunden`)
  return getSale(id)
}

export function getSale(id: number): SaleRecord {
  const db = getDb()
  const saleRow = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
    | {
        id: number
        receipt_number: number
        created_at: string
        total_cents: number
        cash_received_cents: number
        change_cents: number
        voided: number
      }
    | undefined
  if (!saleRow) throw new Error(`Verkauf ${id} nicht gefunden`)

  const itemRows = db
    .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC')
    .all(id) as Array<{
    id: number
    sale_id: number
    product_id: number
    product_name: string
    price_cents: number
    quantity: number
    tax_class: 'A' | 'B'
    voucher_number_start: number
  }>

  const items: SaleItemRecord[] = itemRows.map((r) => ({
    id: r.id,
    saleId: r.sale_id,
    productId: r.product_id,
    productName: r.product_name,
    priceCents: r.price_cents,
    quantity: r.quantity,
    taxClass: r.tax_class,
    voucherNumberStart: r.voucher_number_start
  }))

  return {
    id: saleRow.id,
    receiptNumber: saleRow.receipt_number,
    createdAt: saleRow.created_at,
    totalCents: saleRow.total_cents,
    cashReceivedCents: saleRow.cash_received_cents,
    changeCents: saleRow.change_cents,
    voided: !!saleRow.voided,
    items
  }
}
