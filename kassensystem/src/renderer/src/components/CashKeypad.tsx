import { useEffect, useState } from 'react'
import { formatEuro } from '../format'

interface Props {
  totalCents: number
  submitting: boolean
  error?: string | null
  voucherError?: string | null
  onRetryVoucherPrint: () => void
  onConfirm: (cashReceivedCents: number, printReceipt: boolean) => void
  onCancel: () => void
}

// Übliche Scheine bis 50 € - größere Scheine (100/200/500) kommen beim Kassieren an einem
// Fest-Stand praktisch nicht vor, deshalb bewusst nicht mit aufgenommen.
const BILLS_CENTS = [500, 1000, 2000, 5000]

export default function CashKeypad({
  totalCents,
  submitting,
  error,
  voucherError,
  onRetryVoucherPrint,
  onConfirm,
  onCancel
}: Props): JSX.Element {
  const [input, setInput] = useState('')

  const receivedCents = input === '' ? 0 : Number(input)
  const change = receivedCents - totalCents
  const canConfirm = receivedCents >= totalCents && !submitting

  function pressKey(key: string): void {
    if (key === '⌫') {
      setInput((prev) => prev.slice(0, -1))
      return
    }
    setInput((prev) => (prev + key).slice(0, 8))
  }

  // Scheine werden addiert statt den Betrag zu ersetzen, damit man z.B. einen 20er und einen 5er
  // antippt, wenn genau die kombiniert übergeben wurden - wie beim echten Nachzählen der Scheine.
  function addBill(cents: number): void {
    setInput((prev) => String((prev === '' ? 0 : Number(prev)) + cents))
  }

  // Der erhaltene Betrag wird über die Tastatur eingegeben (kein Ziffernblock auf dem Bildschirm
  // mehr) - Enter bestätigt, Escape bricht ab, wie bei jedem anderen Dialog.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key >= '0' && e.key <= '9') {
        pressKey(e.key)
      } else if (e.key === 'Backspace') {
        pressKey('⌫')
      } else if (e.key === 'Enter') {
        if (canConfirm) onConfirm(receivedCents, false)
      } else if (e.key === 'Escape') {
        if (!submitting) onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div className="modal-backdrop">
      <div className="modal card cash-keypad">
        <h2>Kassieren</h2>

        {voucherError && (
          <div className="form-error cash-keypad-voucher-error">
            <p>Wertbons konnten nicht gedruckt werden: {voucherError}</p>
            <button type="button" className="button-secondary" onClick={onRetryVoucherPrint}>
              Erneut drucken
            </button>
          </div>
        )}

        <div className="cash-row">
          <span>Summe</span>
          <span>{formatEuro(totalCents)}</span>
        </div>
        <div className="cash-row">
          <span>Erhalten</span>
          <span>{formatEuro(receivedCents)}</span>
        </div>
        <div className={`cash-row cash-change${change < 0 ? ' negative' : ''}`}>
          <span>Rückgeld</span>
          <span>{formatEuro(Math.max(change, 0))}</span>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="cash-keypad-bills">
          {BILLS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              className="cash-keypad-bill"
              onClick={() => addBill(cents)}
            >
              {formatEuro(cents)}
            </button>
          ))}
        </div>

        <div className="keypad-actions">
          <button
            type="button"
            className="cash-keypad-passend"
            onClick={() => setInput(String(totalCents))}
          >
            Passend
          </button>
          <button type="button" className="button-secondary" onClick={() => setInput('')}>
            Löschen
          </button>
        </div>

        <div className="modal-actions">
          <button className="button-secondary" onClick={onCancel} disabled={submitting}>
            Abbrechen
          </button>
          <button
            className="button-primary"
            onClick={() => onConfirm(receivedCents, false)}
            disabled={!canConfirm}
          >
            {submitting ? 'Wird gespeichert…' : 'Bestätigen'}
          </button>
        </div>
        <button
          type="button"
          className="button-secondary cash-keypad-receipt-button"
          onClick={() => onConfirm(receivedCents, true)}
          disabled={!canConfirm}
        >
          Bestätigen + Bon drucken
        </button>
      </div>
    </div>
  )
}
