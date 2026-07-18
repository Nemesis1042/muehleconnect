import { useEffect, useState } from 'react'
import type { BackupInfo, Settings, SerialPortInfo, UsbDeviceInfo } from '@shared/types'

function formatBackupTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function platformHint(): string | null {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) {
    return (
      'Windows erkannt: Für einen USB-Drucker muss er meist erst per Zadig auf den ' +
      'WinUSB-Treiber umgestellt werden; ein serieller Drucker läuft über den im ' +
      'Geräte-Manager sichtbaren COM-Port. Siehe README, Abschnitt "Bondrucker per USB ' +
      'anschließen und einrichten" bzw. "Serieller Drucker".'
    )
  }
  if (ua.includes('Linux')) {
    return (
      'Linux erkannt: Bricht der Testdruck mit einem Berechtigungsfehler ab, fehlt meist eine ' +
      'udev-Regel (USB-Drucker, Gruppe plugdev) bzw. die dialout-Gruppenmitgliedschaft ' +
      '(serieller Drucker). Siehe README, Abschnitt "Bondrucker per USB anschließen und ' +
      'einrichten" bzw. "Serieller Drucker".'
    )
  }
  return null
}

function connectionStatus(settings: Settings): string {
  if (settings.printerConnection === 'usb') {
    return `Aktiv: USB-Drucker (VID ${settings.printerVendorId} / PID ${settings.printerProductId})`
  }
  if (settings.printerConnection === 'serial') {
    return `Aktiv: Seriell ${settings.printerSerialPath} @ ${settings.printerSerialBaudRate} Baud`
  }
  return 'Aktiv: kein Drucker (Dry-Run-Modus)'
}

export default function Einstellungen(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [devices, setDevices] = useState<UsbDeviceInfo[]>([])
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanningSerial, setScanningSerial] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [lastBackup, setLastBackup] = useState<BackupInfo | null>(null)
  const [backupResult, setBackupResult] = useState<string | null>(null)
  const [backingUp, setBackingUp] = useState(false)

  useEffect(() => {
    void window.kassen.settings.get().then(setSettings)
    void scanDevices()
    void scanSerialPorts()
    void refreshLastBackup()
  }, [])

  async function refreshLastBackup(): Promise<void> {
    setLastBackup(await window.kassen.backup.getLastAuto())
  }

  async function handleExportBackup(): Promise<void> {
    setBackingUp(true)
    setBackupResult(null)
    try {
      const result = await window.kassen.backup.exportToFile()
      setBackupResult(
        result.ok ? `Gesichert nach: ${result.path}` : `Sicherung nicht gespeichert: ${result.error}`
      )
    } finally {
      setBackingUp(false)
    }
  }

  async function scanDevices(): Promise<void> {
    setScanning(true)
    try {
      setDevices(await window.kassen.printer.listDevices())
    } finally {
      setScanning(false)
    }
  }

  async function scanSerialPorts(): Promise<void> {
    setScanningSerial(true)
    try {
      setSerialPorts(await window.kassen.printer.listSerialPorts())
    } finally {
      setScanningSerial(false)
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
        <p className="printer-platform-hint">
          Laufen mehrere Kassen-Laptops gleichzeitig: Jede Kasse braucht hier eine eigene,
          eindeutige Kassennummer. Sie erscheint auf jedem Bon/Wertbon (z. B. „Kasse 1 – No.
          177“) und macht Bon-/Wertbon-Nummern über mehrere Kassen hinweg eindeutig
          unterscheidbar.
        </p>
      </section>

      <section className="settings-section">
        <h2>Datensicherung</h2>
        <p>
          Nach jedem Verkauf wird automatisch eine Sicherungskopie der Kassendaten angelegt (die
          letzten 5 werden aufgehoben).{' '}
          {lastBackup
            ? `Letzte automatische Sicherung: ${formatBackupTimestamp(lastBackup.at)}.`
            : 'Bisher noch keine automatische Sicherung vorhanden.'}
        </p>
        <button className="button-secondary" onClick={() => void handleExportBackup()} disabled={backingUp}>
          {backingUp ? 'Sichere…' : 'Jetzt manuell sichern (z. B. auf USB-Stick)'}
        </button>
        {backupResult && <p>{backupResult}</p>}
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
        <h2>Bondrucker</h2>
        <p className="printer-status">{connectionStatus(settings)}</p>
        {platformHint() && <p className="printer-platform-hint">{platformHint()}</p>}

        <h3>USB</h3>
        <button className="button-secondary" onClick={() => void scanDevices()} disabled={scanning}>
          {scanning ? 'Suche…' : 'USB-Geräte suchen'}
        </button>
        <div className="printer-device-list">
          {devices.length === 0 && <p>Keine USB-Geräte gefunden.</p>}
          {devices.map((d) => {
            const selected =
              settings.printerConnection === 'usb' &&
              settings.printerVendorId === d.vendorIdHex &&
              settings.printerProductId === d.productIdHex
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
                    update('printerConnection', 'usb')
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

        <h3>Seriell (COM/tty, z.B. USB-zu-Seriell-Adapter)</h3>
        <label className="printer-baud-rate">
          Baudrate
          <input
            type="number"
            value={settings.printerSerialBaudRate}
            onChange={(e) => update('printerSerialBaudRate', Number(e.target.value))}
          />
        </label>
        <button
          className="button-secondary"
          onClick={() => void scanSerialPorts()}
          disabled={scanningSerial}
        >
          {scanningSerial ? 'Suche…' : 'Serielle Anschlüsse suchen'}
        </button>
        <div className="printer-device-list">
          {serialPorts.length === 0 && <p>Keine seriellen Anschlüsse gefunden.</p>}
          {serialPorts.map((p) => {
            const selected =
              settings.printerConnection === 'serial' && settings.printerSerialPath === p.path
            return (
              <div key={p.path} className={`printer-device${selected ? ' selected' : ''}`}>
                <div className="printer-device-info">
                  <div>{p.manufacturer ?? p.path}</div>
                  <div className="printer-device-id">
                    {p.path}
                    {p.vendorId ? ` – VID 0x${p.vendorId} / PID 0x${p.productId}` : ''}
                  </div>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => {
                    update('printerConnection', 'serial')
                    update('printerSerialPath', p.path)
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
        {settings.printerConnection === '' && (
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
