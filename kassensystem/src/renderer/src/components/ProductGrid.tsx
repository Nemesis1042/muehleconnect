import { useEffect } from 'react'
import type { Product } from '@shared/types'
import { formatEuro } from '../format'

interface Props {
  products: Product[]
  onAdd: (productId: number) => void
  onToggleActive: (productId: number, active: boolean) => void
}

/** Zifferntasten 1-9 sind Shortcuts für die ersten 9 Produkte der aktuell sichtbaren Kategorie. */
export default function ProductGrid({ products, onAdd, onToggleActive }: Props): JSX.Element {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const index = Number(e.key) - 1
      if (index >= 0 && index < 9 && products[index]?.active) {
        onAdd(products[index].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products, onAdd])

  return (
    <div className="product-grid">
      {products.map((p, i) => (
        <div key={p.id} className={`product-tile${!p.active ? ' product-tile-inactive' : ''}`}>
          <button className="product-button" onClick={() => onAdd(p.id)} disabled={!p.active}>
            {i < 9 && p.active && <span className="product-shortcut">{i + 1}</span>}
            <span className="product-name">{p.name}</span>
            <span className="product-price">{formatEuro(p.priceCents)}</span>
            {!p.active && <span className="product-sold-out-label">Ausverkauft</span>}
          </button>
          <button
            className="product-toggle-active"
            onClick={() => onToggleActive(p.id, !p.active)}
            title={p.active ? 'Als ausverkauft markieren' : 'Wieder verfügbar machen'}
          >
            {p.active ? '✕' : '✓'}
          </button>
        </div>
      ))}
      {products.length === 0 && (
        <div className="product-grid-empty">Keine Produkte in dieser Kategorie.</div>
      )}
    </div>
  )
}
