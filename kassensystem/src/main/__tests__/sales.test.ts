import { beforeEach, describe, expect, it } from 'vitest'
import { initDb } from '../db'
import { createProduct, removeProduct } from '../products'
import { createSale, voidSale } from '../sales'
import { getJournal } from '../journal'

// initDb(':memory:') never touches Electron's `app.getPath`, so this runs outside the Electron
// runtime (which isn't available in this sandbox) while still exercising the real SQLite schema.
beforeEach(() => {
  initDb(':memory:')
})

describe('createSale', () => {
  it('persists a sale, auto-adds a Pfand line, and assigns sequential voucher numbers', () => {
    const bier = createProduct({
      name: 'Bier',
      priceCents: 200,
      category: 'Getränke',
      taxClass: 'B',
      depositCents: 50,
      sortOrder: 0,
      active: true
    })
    const bratwurst = createProduct({
      name: 'Bratwurst',
      priceCents: 300,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 1,
      active: true
    })

    const sale = createSale({
      lines: [
        { productId: bier.id, quantity: 2 },
        { productId: bratwurst.id, quantity: 1 }
      ],
      cashReceivedCents: 1000
    })

    // 2x Bier (2,00) + 2x Pfand (0,50) + 1x Bratwurst (3,00) = 4,00 + 1,00 + 3,00 = 8,00
    expect(sale.totalCents).toBe(800)
    expect(sale.changeCents).toBe(200)
    expect(sale.receiptNumber).toBe(1)
    expect(sale.items).toHaveLength(3)

    const bierItem = sale.items.find((i) => i.productName === 'Bier')
    const pfandItem = sale.items.find((i) => i.productName === 'Pfand')
    const bratwurstItem = sale.items.find((i) => i.productName === 'Bratwurst')

    expect(bierItem?.quantity).toBe(2)
    expect(pfandItem?.quantity).toBe(2)
    expect(pfandItem?.priceCents).toBe(50)
    expect(bratwurstItem?.quantity).toBe(1)

    // Voucher numbers are handed out globally and contiguously across all printed vouchers,
    // matching the real reference receipts (e.g. "No. 177/178/179" for one 3-item purchase).
    const allNumbers = sale.items
      .flatMap((i) => Array.from({ length: i.quantity }, (_, k) => i.voucherNumberStart + k))
      .sort((a, b) => a - b)
    expect(allNumbers).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects a sale when the cash received is less than the total', () => {
    const product = createProduct({
      name: 'Kaffee',
      priceCents: 100,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 0,
      active: true
    })

    expect(() =>
      createSale({ lines: [{ productId: product.id, quantity: 1 }], cashReceivedCents: 50 })
    ).toThrow()
  })

  it('increments the receipt number across multiple sales', () => {
    const product = createProduct({
      name: 'Kaffee',
      priceCents: 100,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 0,
      active: true
    })

    const first = createSale({ lines: [{ productId: product.id, quantity: 1 }], cashReceivedCents: 100 })
    const second = createSale({ lines: [{ productId: product.id, quantity: 1 }], cashReceivedCents: 100 })

    expect(first.receiptNumber).toBe(1)
    expect(second.receiptNumber).toBe(2)
  })
})

describe('voidSale', () => {
  it('marks a sale as voided and excludes it from the journal', () => {
    const product = createProduct({
      name: 'Kaffee',
      priceCents: 100,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 0,
      active: true
    })

    const sale = createSale({ lines: [{ productId: product.id, quantity: 2 }], cashReceivedCents: 200 })
    expect(sale.voided).toBe(false)

    const voided = voidSale(sale.id)
    expect(voided.voided).toBe(true)

    const report = getJournal('0000-01-01 00:00:00', '9999-01-01 00:00:00')
    expect(report.entries).toHaveLength(0)
    expect(report.totalCents).toBe(0)
  })

  it('throws when voiding a sale that does not exist', () => {
    expect(() => voidSale(999)).toThrow()
  })
})

describe('removeProduct', () => {
  it('refuses to delete a product that has already been sold', () => {
    const product = createProduct({
      name: 'Kaffee',
      priceCents: 100,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 0,
      active: true
    })
    createSale({ lines: [{ productId: product.id, quantity: 1 }], cashReceivedCents: 100 })

    expect(() => removeProduct(product.id)).toThrow()
  })
})

describe('getJournal', () => {
  it('aggregates sale items per product/price/tax-class with a tax breakdown', () => {
    const product = createProduct({
      name: 'Pommes',
      priceCents: 200,
      category: 'Essen',
      taxClass: 'A',
      depositCents: 0,
      sortOrder: 0,
      active: true
    })

    createSale({ lines: [{ productId: product.id, quantity: 2 }], cashReceivedCents: 400 })
    createSale({ lines: [{ productId: product.id, quantity: 3 }], cashReceivedCents: 600 })

    const report = getJournal('0000-01-01 00:00:00', '9999-01-01 00:00:00')
    const entry = report.entries.find((e) => e.productName === 'Pommes')

    expect(entry?.quantity).toBe(5)
    expect(entry?.totalCents).toBe(1000)
    expect(report.totalCents).toBe(1000)
    expect(report.taxBreakdown).toEqual([
      { taxClass: 'A', ratePercent: 7, netCents: 935, taxCents: 65, grossCents: 1000 }
    ])
  })
})
