import { getDb, rowToProduct, PFAND_PRODUCT_CODE } from './db'
import type { Product, ProductInput } from '../shared/types'

export function listProducts(): Product[] {
  const rows = getDb()
    .prepare('SELECT * FROM products WHERE code IS NULL ORDER BY sort_order ASC, id ASC')
    .all()
  return rows.map(rowToProduct)
}

export function getPfandProduct(): Product {
  const row = getDb().prepare('SELECT * FROM products WHERE code = ?').get(PFAND_PRODUCT_CODE)
  return rowToProduct(row)
}

export function getProduct(id: number): Product {
  const row = getDb().prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!row) throw new Error(`Produkt ${id} nicht gefunden`)
  return rowToProduct(row)
}

export function createProduct(input: ProductInput): Product {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO products (name, price_cents, category, tax_class, deposit_cents, sort_order, active)
       VALUES (@name, @priceCents, @category, @taxClass, @depositCents, @sortOrder, @active)`
    )
    .run({ ...input, active: input.active ? 1 : 0 })
  return getProduct(Number(result.lastInsertRowid))
}

export function updateProduct(id: number, input: Partial<ProductInput>): Product {
  const db = getDb()
  const existing = getProduct(id)
  const merged: ProductInput = { ...existing, ...input }
  db.prepare(
    `UPDATE products SET name = @name, price_cents = @priceCents, category = @category,
     tax_class = @taxClass, deposit_cents = @depositCents, sort_order = @sortOrder, active = @active
     WHERE id = @id`
  ).run({ ...merged, active: merged.active ? 1 : 0, id })
  return getProduct(id)
}

export function removeProduct(id: number): void {
  const db = getDb()
  const sold = db.prepare('SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1').get(id)
  if (sold) {
    throw new Error(
      'Produkt wurde bereits verkauft und kann nicht gelöscht werden – stattdessen das Häkchen "Aktiv" entfernen.'
    )
  }
  db.prepare('DELETE FROM products WHERE id = ? AND code IS NULL').run(id)
}

export function reorderProducts(orderedIds: number[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?')
  const tx = db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, id))
  })
  tx()
}
