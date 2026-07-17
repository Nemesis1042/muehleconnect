import type { CartInputLine, CartLine, Product, TaxBreakdownEntry, TaxClass } from './types'

/**
 * Expands raw {productId, quantity} lines into full CartLine entries, auto-adding a
 * Pfand (deposit) line right after any product that has depositCents > 0.
 */
export function expandCart(
  lines: CartInputLine[],
  products: Product[],
  pfandProduct: Product
): CartLine[] {
  const byId = new Map(products.map((p) => [p.id, p]))
  const result: CartLine[] = []

  for (const line of lines) {
    if (line.quantity <= 0) continue
    const product = byId.get(line.productId)
    if (!product) continue

    result.push({
      productId: product.id,
      productName: product.name,
      priceCents: product.priceCents,
      taxClass: product.taxClass,
      quantity: line.quantity,
      isDeposit: false
    })

    if (product.depositCents > 0) {
      result.push({
        productId: pfandProduct.id,
        productName: pfandProduct.name,
        priceCents: product.depositCents,
        taxClass: pfandProduct.taxClass,
        quantity: line.quantity,
        isDeposit: true
      })
    }
  }

  return result
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)
}

export function changeCents(cashReceivedCents: number, totalCents: number): number {
  return cashReceivedCents - totalCents
}

/**
 * Splits gross line totals per tax class into net/tax/gross, given VAT rates in percent.
 * Uses the standard "Brutto enthält MwSt" back-calculation: netto = brutto / (1 + rate/100).
 */
export function taxBreakdown(
  linesByClass: Array<{ taxClass: TaxClass; grossCents: number }>,
  rates: Record<TaxClass, number>
): TaxBreakdownEntry[] {
  const totals: Record<TaxClass, number> = { A: 0, B: 0 }
  for (const l of linesByClass) totals[l.taxClass] += l.grossCents

  return (['A', 'B'] as TaxClass[])
    .filter((cls) => totals[cls] > 0)
    .map((cls) => {
      const ratePercent = rates[cls]
      const grossCents = totals[cls]
      const netCents = Math.round(grossCents / (1 + ratePercent / 100))
      const taxCents = grossCents - netCents
      return { taxClass: cls, ratePercent, netCents, taxCents, grossCents }
    })
}
