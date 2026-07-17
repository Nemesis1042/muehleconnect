import { useEffect, useState } from 'react'
import type { JournalReport } from '@shared/types'
import { formatEuro } from '../format'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function Tagesuebersicht(): JSX.Element {
  const [date, setDate] = useState(todayIso())
  const [report, setReport] = useState<JournalReport | null>(null)
  const [printStatus, setPrintStatus] = useState<string | null>(null)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function range(): { from: string; to: string } {
    // Sales werden intern in UTC gespeichert (SQLite datetime('now')); für ein Fest an einem Tag
    // reicht diese einfache Tagesgrenze ohne separate Zeitzonen-Umrechnung völlig aus.
    return { from: `${date} 00:00:00`, to: `${addDays(date, 1)} 00:00:00` }
  }

  async function load(): Promise<void> {
    const { from, to } = range()
    setReport(await window.kassen.journal.get(from, to))
  }

  async function handlePrint(): Promise<void> {
    const { from, to } = range()
    setPrintStatus(null)
    const result = await window.kassen.journal.print(from, to)
    setPrintStatus(result.ok ? 'Journal gedruckt.' : 'Drucken fehlgeschlagen.')
  }

  return (
    <div className="journal-page">
      <h1>Kassen-Journal</h1>
      <div className="journal-filter">
        <label>
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="button-secondary" onClick={() => void handlePrint()}>
          Journal drucken
        </button>
        {printStatus && <span>{printStatus}</span>}
      </div>

      {!report && <p>Lädt…</p>}

      {report && (
        <>
          <table className="journal-table">
            <thead>
              <tr>
                <th>Anzahl</th>
                <th>Artikel</th>
                <th>MwSt.</th>
                <th className="amount">Preis</th>
                <th className="amount">Summe</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e) => (
                <tr key={`${e.productId}-${e.priceCents}-${e.taxClass}`}>
                  <td>{e.quantity}</td>
                  <td>{e.productName}</td>
                  <td>{e.taxClass}</td>
                  <td className="amount">{formatEuro(e.priceCents)}</td>
                  <td className="amount">{formatEuro(e.totalCents)}</td>
                </tr>
              ))}
              {report.entries.length === 0 && (
                <tr>
                  <td colSpan={5}>Keine Verkäufe an diesem Tag.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="journal-summary">
            <div className="journal-summary-total">
              <span>Gesamtsumme</span>
              <span>{formatEuro(report.totalCents)}</span>
            </div>
            <table className="journal-table">
              <thead>
                <tr>
                  <th>MwSt.</th>
                  <th className="amount">Netto</th>
                  <th className="amount">MwSt.</th>
                  <th className="amount">Brutto</th>
                </tr>
              </thead>
              <tbody>
                {report.taxBreakdown.map((b) => (
                  <tr key={b.taxClass}>
                    <td>
                      {b.taxClass} ({b.ratePercent}%)
                    </td>
                    <td className="amount">{formatEuro(b.netCents)}</td>
                    <td className="amount">{formatEuro(b.taxCents)}</td>
                    <td className="amount">{formatEuro(b.grossCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
