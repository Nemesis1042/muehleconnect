import type { CartLine } from '@shared/types'
import { formatEuro } from '../format'

interface Props {
  lines: CartLine[]
  totalCents: number
  onRemoveOne: (productId: number) => void
  onCheckout: () => void
}

export default function Cart({ lines, totalCents, onRemoveOne, onCheckout }: Props): JSX.Element {
  return (
    <aside className="cart-panel card">
      <h2 className="cart-title">Warenkorb</h2>
      <div className="cart-lines">
        {lines.length === 0 && <p className="cart-empty">Noch keine Artikel ausgewählt.</p>}
        {lines.map((line, index) => (
          <div
            // Jede Pfand-Zeile trägt dieselbe productId (die des einen globalen Pfand-Produkts),
            // egal welches Getränk sie ausgelöst hat - bei mehreren verschiedenen Pfand-Getränken
            // im Warenkorb kollidierte der Key dadurch, React verwechselte die Zeilen beim Neu-
            // Rendern und alte Pfand-Zeilen blieben nach dem Entfernen sichtbar hängen. Der Index
            // macht den Key eindeutig - die Zeilenliste wird bei jedem Render komplett neu aus dem
            // Warenkorb berechnet, es gibt also keine Animation/lokalen State, für den die Position
            // sonst stabil bleiben müsste.
            key={`${line.productId}-${line.isDeposit ? 'pfand' : 'item'}-${index}`}
            className={`cart-line${line.isDeposit ? ' cart-line-deposit' : ''}`}
          >
            {line.isDeposit ? (
              <span className="cart-line-remove-placeholder" aria-hidden="true" />
            ) : (
              <button
                className="cart-line-remove"
                onClick={() => onRemoveOne(line.productId)}
                title="Eine Einheit entfernen (Pfand wird automatisch mit entfernt)"
                aria-label={`Eine Einheit ${line.productName} entfernen`}
              >
                ×
              </button>
            )}
            <span className="cart-line-name">
              {line.quantity} x {line.productName}
            </span>
            <span className="cart-line-price">{formatEuro(line.priceCents * line.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="cart-total">
        <span>Summe</span>
        <span className="cart-total-amount">{formatEuro(totalCents)}</span>
      </div>
      <button className="button-accent cart-checkout" disabled={lines.length === 0} onClick={onCheckout}>
        Kassieren
      </button>
    </aside>
  )
}
