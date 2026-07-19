import { useEffect, useMemo, useState } from 'react'
import type { PrintSaleOptions, Product, PrintResult, SaleRecord } from '@shared/types'
import { expandCart, cartTotalCents } from '@shared/cart'
import { formatEuro } from '../format'
import ProductGrid from '../components/ProductGrid'
import Cart from '../components/Cart'
import CashKeypad from '../components/CashKeypad'

const VOUCHERS_ONLY: PrintSaleOptions = { printReceipt: false, printVouchers: true }
const RECEIPT_ONLY: PrintSaleOptions = { printReceipt: true, printVouchers: false }
const RECEIPT_AND_VOUCHERS: PrintSaleOptions = { printReceipt: true, printVouchers: true }

export default function Kasse(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [pfand, setPfand] = useState<Product | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [rawCart, setRawCart] = useState<Record<number, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null)
  const [lastPrintResult, setLastPrintResult] = useState<PrintResult | null>(null)
  const [lastPrintOptions, setLastPrintOptions] = useState<PrintSaleOptions>(VOUCHERS_ONLY)
  const [voiding, setVoiding] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState(false)

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

  async function confirmPayment(cashReceivedCents: number, printReceipt: boolean): Promise<void> {
    setSubmitting(true)
    setError(null)
    const printOptions = printReceipt ? RECEIPT_AND_VOUCHERS : VOUCHERS_ONLY
    try {
      const result = await window.kassen.sale.create(
        { lines: cartInputLines, cashReceivedCents },
        printOptions
      )
      setLastSale(result.sale)
      setLastPrintResult(result.printResult)
      setLastPrintOptions(printOptions)
      setRawCart({})
      setCheckoutOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function retryPrint(): Promise<void> {
    if (lastSale === null) return
    setSubmitting(true)
    try {
      const result = await window.kassen.sale.reprint(lastSale.id, lastPrintOptions)
      setLastPrintResult(result)
    } finally {
      setSubmitting(false)
    }
  }

  async function printReceipt(): Promise<void> {
    if (lastSale === null) return
    setPrintingReceipt(true)
    try {
      const result = await window.kassen.sale.reprint(lastSale.id, RECEIPT_ONLY)
      setLastPrintResult(result)
      setLastPrintOptions(RECEIPT_ONLY)
    } finally {
      setPrintingReceipt(false)
    }
  }

  async function voidLastSale(): Promise<void> {
    if (lastSale === null) return
    const confirmed = window.confirm(
      `Verkauf Nr. ${lastSale.receiptNumber} (${formatEuro(lastSale.totalCents)}) wirklich stornieren? ` +
        'Bereits gedruckte Bons/Wertbons bleiben davon unberührt, der Verkauf zählt danach nicht mehr im Journal.'
    )
    if (!confirmed) return
    setVoiding(true)
    try {
      const voided = await window.kassen.sale.void(lastSale.id)
      setLastSale(voided)
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="kasse-page">
      {lastSale && !lastSale.voided && (
        <div className="sale-confirm-banner">
          <span>
            Verkauf Nr. {lastSale.receiptNumber} über {formatEuro(lastSale.totalCents)} gespeichert.
          </span>
          <button
            className="button-secondary"
            onClick={() => void printReceipt()}
            disabled={printingReceipt}
          >
            {printingReceipt ? 'Drucke…' : 'Bon drucken'}
          </button>
          <button className="button-secondary" onClick={() => void voidLastSale()} disabled={voiding}>
            {voiding ? 'Storniere…' : 'Stornieren'}
          </button>
          <button className="button-secondary" onClick={() => setLastSale(null)}>
            Ausblenden
          </button>
        </div>
      )}
      {lastSale && lastSale.voided && (
        <div className="sale-confirm-banner voided">
          <span>Verkauf Nr. {lastSale.receiptNumber} wurde storniert.</span>
          <button className="button-secondary" onClick={() => setLastSale(null)}>
            Ausblenden
          </button>
        </div>
      )}
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
          onConfirm={(cash, printReceipt) => void confirmPayment(cash, printReceipt)}
          onCancel={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  )
}
