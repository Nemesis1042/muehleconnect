import { describe, expect, it } from 'vitest'
import { cartTotalCents, changeCents, expandCart, taxBreakdown } from '../cart'
import type { Product } from '../types'

const bier: Product = {
  id: 1,
  name: 'Bier',
  priceCents: 200,
  category: 'Getränke',
  taxClass: 'B',
  depositCents: 50,
  sortOrder: 0,
  active: true,
  createdAt: ''
}

const pommes: Product = {
  id: 2,
  name: 'Pommes',
  priceCents: 200,
  category: 'Essen',
  taxClass: 'A',
  depositCents: 0,
  sortOrder: 1,
  active: true,
  createdAt: ''
}

const pfand: Product = {
  id: 99,
  name: 'Pfand',
  priceCents: 0,
  category: 'Pfand',
  taxClass: 'B',
  depositCents: 0,
  sortOrder: 999,
  active: true,
  createdAt: ''
}

const products = [bier, pommes]

describe('expandCart', () => {
  it('leaves a product without deposit as a single line', () => {
    const lines = expandCart([{ productId: pommes.id, quantity: 2 }], products, pfand)
    expect(lines).toEqual([
      {
        productId: pommes.id,
        productName: pommes.name,
        priceCents: pommes.priceCents,
        taxClass: pommes.taxClass,
        quantity: 2,
        isDeposit: false
      }
    ])
  })

  it('auto-adds a matching Pfand line for deposit-bearing products', () => {
    const lines = expandCart([{ productId: bier.id, quantity: 2 }], products, pfand)
    expect(lines).toHaveLength(2)
    expect(lines[0].isDeposit).toBe(false)
    expect(lines[1]).toEqual({
      productId: pfand.id,
      productName: pfand.name,
      priceCents: bier.depositCents,
      taxClass: pfand.taxClass,
      quantity: 2,
      isDeposit: true
    })
  })

  it('skips unknown products and non-positive quantities', () => {
    const lines = expandCart(
      [
        { productId: 12345, quantity: 3 },
        { productId: pommes.id, quantity: 0 },
        { productId: pommes.id, quantity: -1 }
      ],
      products,
      pfand
    )
    expect(lines).toHaveLength(0)
  })
})

describe('cartTotalCents / changeCents', () => {
  it('sums line totals (price * quantity) across all lines', () => {
    const lines = expandCart(
      [
        { productId: bier.id, quantity: 2 },
        { productId: pommes.id, quantity: 1 }
      ],
      products,
      pfand
    )
    // 2x Bier (2,00) + 2x Pfand (0,50) + 1x Pommes (2,00) = 4,00 + 1,00 + 2,00 = 7,00
    expect(cartTotalCents(lines)).toBe(700)
  })

  it('computes change as received minus total, negative when short-paid', () => {
    expect(changeCents(1000, 700)).toBe(300)
    expect(changeCents(500, 700)).toBe(-200)
  })
})

describe('taxBreakdown', () => {
  it('splits gross amounts per tax class into net/tax/gross using the given rates', () => {
    const result = taxBreakdown(
      [
        { taxClass: 'A', grossCents: 1250 },
        { taxClass: 'B', grossCents: 1750 }
      ],
      { A: 7, B: 19 }
    )
    expect(result).toEqual([
      { taxClass: 'A', ratePercent: 7, netCents: 1168, taxCents: 82, grossCents: 1250 },
      { taxClass: 'B', ratePercent: 19, netCents: 1471, taxCents: 279, grossCents: 1750 }
    ])
  })

  it('omits tax classes with no turnover', () => {
    const result = taxBreakdown([{ taxClass: 'A', grossCents: 500 }], { A: 7, B: 19 })
    expect(result).toHaveLength(1)
    expect(result[0].taxClass).toBe('A')
  })
})
