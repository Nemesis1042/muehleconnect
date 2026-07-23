import { useState } from 'react'
import type { BaudTestSlipAttempt } from '@shared/types'

interface Props {
  path: string
  onConfirmed: (baudRate: number) => void
  onDismiss?: () => void
  onBusyChange?: (busy: boolean) => void
}

type Phase = 'idle' | 'probing' | 'probe-failed' | 'printing' | 'awaiting-choice'

export default function BaudRateWizard({ path, onConfirmed, onDismiss, onBusyChange }: Props): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<BaudTestSlipAttempt[]>([])

  function setBusyState(value: boolean): void {
    setBusy(value)
    onBusyChange?.(value)
  }

  async function handleDetect(): Promise<void> {
    setBusyState(true)
    setMessage(null)
    setPhase('probing')
    try {
      const result = await window.kassen.printer.probeBaudRate(path)
      if (result.ok && result.baudRate) {
        onConfirmed(result.baudRate)
        setPhase('idle')
        setMessage(`Fertig! Baudrate ${result.baudRate} wurde automatisch gespeichert – nichts weiter zu tun.`)
      } else {
        setPhase('probe-failed')
      }
    } finally {
      setBusyState(false)
    }
  }

  async function handleStartGuidedPrint(): Promise<void> {
    setBusyState(true)
    setPhase('printing')
    try {
      const result = await window.kassen.printer.printBaudTestSlips(path)
      setAttempts(result.attempts)
      if (!result.ok) {
        setPhase('idle')
        setMessage(
          `Kein Testzettel konnte gedruckt werden: ${result.attempts[0]?.error ?? 'unbekannter Fehler'}. ` +
            'Bitte prüfen: Ist das Kabel richtig eingesteckt? Ist der Drucker an?'
        )
      } else {
        setPhase('awaiting-choice')
      }
    } finally {
      setBusyState(false)
    }
  }

  function handleConfirm(baudRate: number): void {
    onConfirmed(baudRate)
    setPhase('idle')
    setMessage(`Fertig! Baudrate ${baudRate} wurde gespeichert – nichts weiter zu tun.`)
  }

  function handleNoneReadable(): void {
    setPhase('idle')
    setMessage(
      'Kein Zettel war lesbar. Bitte prüfen: Ist das Kabel richtig eingesteckt? Ist der Drucker ' +
        'an? Falls ja, bitte technische Hilfe holen.'
    )
  }

  return (
    <div className="baud-wizard">
      <button
        className="button-secondary"
        onClick={() => void handleDetect()}
        disabled={busy || !path}
      >
        {phase === 'probing' ? 'Prüfe automatisch… (kurz warten)' : 'Baudrate automatisch einstellen'}
      </button>
      {!path && <p className="printer-platform-hint">Bitte zuerst oben einen Anschluss auswählen.</p>}

      {phase === 'probe-failed' && (
        <div>
          <p>
            Automatisch hat es nicht geklappt. Kein Problem – wir drucken jetzt ein paar kurze
            Testzettel. Auf einem davon muss die Zahl klar lesbar sein.
          </p>
          <button className="button-secondary" onClick={() => void handleStartGuidedPrint()}>
            Testzettel drucken
          </button>
          <button className="button-secondary" onClick={() => setPhase('idle')}>
            Abbrechen
          </button>
        </div>
      )}

      {phase === 'printing' && <p>Drucke Testzettel… (dauert kurz, bitte warten)</p>}

      {phase === 'awaiting-choice' && (
        <div>
          <p>
            Schau dir die ausgedruckten Zettel an. Auf genau einem Zettel ist die Zahl klar und
            deutlich lesbar (nicht nur wirre Zeichen). Klicke unten auf genau diese Zahl.
          </p>
          {attempts
            .filter((a) => a.ok)
            .map((a) => (
              <button key={a.baudRate} className="button-secondary" onClick={() => handleConfirm(a.baudRate)}>
                {a.baudRate} war lesbar
              </button>
            ))}
          <button className="button-secondary" onClick={handleNoneReadable}>
            Keiner war lesbar
          </button>
        </div>
      )}

      {onDismiss && phase === 'idle' && !message && (
        <button className="button-secondary" onClick={onDismiss}>
          Später
        </button>
      )}

      {message && <p>{message}</p>}
    </div>
  )
}
