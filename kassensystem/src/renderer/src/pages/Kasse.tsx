import { useEffect, useMemo, useState } from 'react'
import type { Product, PrintResult } from '@shared/types'
import { expandCart, cartTotalCents } from '@shared/cart'
import ProductGrid from '../components/ProductGrid'
import Cart from '../components/Cart'
import CashKeypad from '../components/CashKeypad'

export default function Kasse(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [pfand, setPfand] = useState<Product | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [rawCart, setRawCart] = useState<Record<number, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaleId, setLastSaleId] = useState<number | null>(null)
  const [lastPrintResult, setLastPrintResult] = useState<PrintResult | null>(null)

  useEffect(() => {
    void loadProducts()
  }, [])

  async function loadProducts(): Promise<void> {
    const [list, pfandProduct] = await Promise.all([
      window.kassen.products.list(),
      window.kassen.products.getPfand()
    ])
    setProducts(list)
    setPfand(pfandProduct)
    if (list.length > 0) setActiveCategory((prev) => prev || list[0].category)
  }

  const categories = useMemo(() => {
    const seen: string[] = []
    for (const p of products) if (!seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [products])

  const visibleProducts = useMemo(
    () => products.filter((p) => p.active && p.category === activeCategory),
    [products, activeCategory]
  )

  const cartInputLines = useMemo(
    () =>
      Object.entries(rawCart)
        .map(([id, quantity]) => ({ productId: Number(id), quantity }))
        .filter((l) => l.quantity > 0),
    [rawCart]
  )

  const cartLines = useMemo(
    () => (pfand ? expandCart(cartInputLines, products, pfand) : []),
    [cartInputLines, products, pfand]
  )

  const totalCents = useMemo(() => cartTotalCents(cartLines), [cartLines])

  function addOne(productId: number): void {
    setRawCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }))
  }

  function removeOne(productId: number): void {
    setRawCart((prev) => {
      const current = prev[productId] ?? 0
      if (current <= 1) {
        const { [productId]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: current - 1 }
    })
  }

  async function confirmPayment(cashReceivedCents: number): Promise<void> {
    setSubmitting(true)
    setError(null)
    try {
      const result = await window.kassen.sale.create({ lines: cartInputLines, cashReceivedCents })
      setLastSaleId(result.sale.id)
      setLastPrintResult(result.printResult)
      setRawCart({})
      setCheckoutOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function retryPrint(): Promise<void> {
    if (lastSaleId === null) return
    setSubmitting(true)
    try {
      const result = await window.kassen.sale.reprint(lastSaleId)
      setLastPrintResult(result)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="kasse-page">
      {lastPrintResult && !lastPrintResult.ok && (
        <div className="print-error-banner">
          <span>
            Beim Drucken ist etwas schiefgelaufen (Drucker angeschlossen? Papier vorhanden?). Der
            Verkauf wurde trotzdem gespeichert.
          </span>
          <button className="button-secondary" onClick={() => void retryPrint()} disabled={submitting}>
            Erneut drucken
          </button>
          <button className="button-secondary" onClick={() => setLastPrintResult(null)}>
            Ausblenden
          </button>
        </div>
      )}

      <div className="kasse-layout">
        <div className="kasse-products">
          <div className="category-tabs">
            {categories.map((c) => (
              <button
                key={c}
                className={`nav-button category-tab${c === activeCategory ? ' active' : ''}`}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <ProductGrid products={visibleProducts} onAdd={addOne} />
        </div>

        <Cart
          lines={cartLines}
          totalCents={totalCents}
          onRemoveOne={removeOne}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </div>

      {checkoutOpen && (
        <CashKeypad
          totalCents={totalCents}
          submitting={submitting}
          error={error}
          onConfirm={(cash) => void confirmPayment(cash)}
          onCancel={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  )
}
