import { useEffect, useState } from 'react'
import type { Settings, UsbDeviceInfo } from '@shared/types'

function platformHint(): string | null {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) {
    return (
      'Windows erkannt: Falls der Drucker unten nicht auftaucht oder der Testdruck fehlschlägt, ' +
      'muss er meist erst per Zadig auf den WinUSB-Treiber umgestellt werden (siehe README, ' +
      'Abschnitt "Bondrucker per USB anschließen und einrichten").'
    )
  }
  if (ua.includes('Linux')) {
    return (
      'Linux erkannt: Falls der Drucker unten nicht auftaucht oder der Testdruck mit einem ' +
      'Berechtigungsfehler abbricht, fehlt meist eine udev-Regel für den normalen Nutzer ' +
      '(siehe README, Abschnitt "Bondrucker per USB anschließen und einrichten").'
    )
  }
  return null
}

export default function Einstellungen(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([])
  const [scanning, setScanning] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void window.kassen.settings.get().then(setSettings)
    void scanDevices()
  }, [])

  async function scanDevices(): Promise<void> {
    setScanning(true)
    try {
      setDevices(await window.kassen.printer.listDevices())
    } finally {
      setScanning(false)
    }
  }

  async function handleSave(): Promise<void> {
    if (!settings) return
    const updated = await window.kassen.settings.update(settings)
    setSettings(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTestPrint(): Promise<void> {
    setTestResult(null)
    const result = await window.kassen.printer.testPrint()
    setTestResult(
      result.ok
        ? 'Testdruck erfolgreich gesendet.'
        : `Testdruck fehlgeschlagen: ${result.jobs[0]?.error ?? 'unbekannter Fehler'}`
    )
  }

  if (!settings) return <p>Lädt…</p>

  function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="einstellungen-page">
      <section className="settings-section">
        <h2>Bon-Kopfzeilen</h2>
        <div className="settings-grid">
          <label>
            Titelzeile 1
            <input value={settings.titleLine1} onChange={(e) => update('titleLine1', e.target.value)} />
          </label>
          <label>
            Titelzeile 2
            <input value={settings.titleLine2} onChange={(e) => update('titleLine2', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Organisation (Kassenbon-Adressblock)</h2>
        <div className="settings-grid">
          <label>
            Name
            <input value={settings.orgName} onChange={(e) => update('orgName', e.target.value)} />
          </label>
          <label>
            Straße
            <input value={settings.orgStreet} onChange={(e) => update('orgStreet', e.target.value)} />
          </label>
          <label>
            PLZ / Ort
            <input
              value={settings.orgZipCity}
              onChange={(e) => update('orgZipCity', e.target.value)}
            />
          </label>
          <label>
            Steuer-ID
            <input value={settings.orgTaxId} onChange={(e) => update('orgTaxId', e.target.value)} />
          </label>
          <label>
            Kassennummer
            <input
              type="number"
              min={1}
              value={settings.registerNumber}
              onChange={(e) => update('registerNumber', Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>MwSt.-Sätze</h2>
        <div className="settings-grid">
          <label>
            Klasse A (%)
            <input
              type="number"
              value={settings.taxRateA}
              onChange={(e) => update('taxRateA', Number(e.target.value))}
            />
          </label>
          <label>
            Klasse B (%)
            <input
              type="number"
              value={settings.taxRateB}
              onChange={(e) => update('taxRateB', Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Bondrucker (USB)</h2>
        {platformHint() && <p className="printer-platform-hint">{platformHint()}</p>}
        <button className="button-secondary" onClick={() => void scanDevices()} disabled={scanning}>
          {scanning ? 'Suche…' : 'USB-Geräte suchen'}
        </button>
        <div className="printer-device-list">
          {devices.length === 0 && <p>Keine USB-Geräte gefunden.</p>}
          {devices.map((d) => {
            const selected =
              settings.printerVendorId === d.vendorIdHex && settings.printerProductId === d.productIdHex
            return (
              <div key={`${d.vendorIdHex}-${d.productIdHex}`} className={`printer-device${selected ? ' selected' : ''}`}>
                <div className="printer-device-info">
                  <div>
                    {d.manufacturer || d.product
                      ? `${d.manufacturer ?? 'Unbekannter Hersteller'} – ${d.product ?? 'USB-Gerät'}`
                      : 'Name nicht lesbar (Treiber/Berechtigung?)'}
                  </div>
                  <div className="printer-device-id">
                    VID {d.vendorIdHex} / PID {d.productIdHex}
                  </div>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => {
                    update('printerVendorId', d.vendorIdHex)
                    update('printerProductId', d.productIdHex)
                  }}
                >
                  {selected ? 'Ausgewählt' : 'Auswählen'}
                </button>
              </div>
            )
          })}
        </div>
        <button className="button-secondary" onClick={() => void handleTestPrint()}>
          Testdruck
        </button>
        {testResult && <p>{testResult}</p>}
        {!settings.printerVendorId && (
          <p className="cart-line-deposit">
            Kein Drucker ausgewählt – es wird im Dry-Run-Modus gedruckt (Vorschau nur in der
            Konsole, kein echter Ausdruck).
          </p>
        )}
      </section>

      <div className="settings-actions">
        <button className="button-primary" onClick={() => void handleSave()}>
          Speichern
        </button>
        {saved && <span className="save-status">Gespeichert.</span>}
      </div>
    </div>
  )
}
