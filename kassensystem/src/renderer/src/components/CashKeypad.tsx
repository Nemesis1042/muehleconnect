import { useState } from 'react'
import { formatEuro } from '../format'

interface Props {
  totalCents: number
  submitting: boolean
  error?: string | null
  onConfirm: (cashReceivedCents: number, printReceipt: boolean) => void
  onCancel: () => void
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '⌫']

export default function CashKeypad({
  totalCents,
  submitting,
  error,
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

  return (
    <div className="modal-backdrop">
      <div className="modal card cash-keypad">
        <h2>Kassieren</h2>
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

        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className="keypad-button" onClick={() => pressKey(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="keypad-actions">
          <button
            type="button"
            className="button-secondary"
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
            {submitting ? 'Wird gedruckt…' : 'Bestätigen'}
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
