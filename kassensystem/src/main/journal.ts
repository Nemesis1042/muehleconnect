import { getDb } from './db'
import { getSettings } from './settings'
import { taxBreakdown } from '../shared/cart'
import type { JournalEntry, JournalReport, TaxClass } from '../shared/types'

export function getJournal(from: string, to: string): JournalReport {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT si.product_id as product_id, si.product_name as product_name,
              si.tax_class as tax_class, si.price_cents as price_cents,
              SUM(si.quantity) as quantity, SUM(si.price_cents * si.quantity) as total_cents
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.created_at >= ? AND s.created_at < ? AND s.voided = 0
       GROUP BY si.product_id, si.price_cents, si.tax_class
       ORDER BY MIN(si.id) ASC`
    )
    .all(from, to) as Array<{
    product_id: number
    product_name: string
    tax_class: TaxClass
    price_cents: number
    quantity: number
    total_cents: number
  }>

  const entries: JournalEntry[] = rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    taxClass: r.tax_class,
    quantity: r.quantity,
    priceCents: r.price_cents,
    totalCents: r.total_cents
  }))

  const totalCents = entries.reduce((sum, e) => sum + e.totalCents, 0)
  const settings = getSettings()
  const breakdown = taxBreakdown(
    entries.map((e) => ({ taxClass: e.taxClass, grossCents: e.totalCents })),
    { A: settings.taxRateA, B: settings.taxRateB }
  )

  return { from, to, entries, totalCents, taxBreakdown: breakdown }
}
