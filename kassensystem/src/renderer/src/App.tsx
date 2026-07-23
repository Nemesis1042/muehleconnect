import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import Kasse from './pages/Kasse'
import Produkte from './pages/Produkte'
import Einstellungen from './pages/Einstellungen'
import Tagesuebersicht from './pages/Tagesuebersicht'
import BaudRateSetupDialog from './components/BaudRateSetupDialog'
import './App.css'
import './pages.css'

type Page = 'kasse' | 'produkte' | 'journal' | 'einstellungen'

const NAV: Array<{ id: Page; label: string }> = [
  { id: 'kasse', label: 'Kasse' },
  { id: 'produkte', label: 'Produkte' },
  { id: 'journal', label: 'Kassen-Journal' },
  { id: 'einstellungen', label: 'Einstellungen' }
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('kasse')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [dialogDismissed, setDialogDismissed] = useState(false)

  useEffect(() => {
    void window.kassen.settings.get().then(setSettings)
  }, [])

  async function handleBaudRateConfirmed(baudRate: number): Promise<void> {
    const updated = await window.kassen.settings.update({
      printerSerialBaudRate: baudRate,
      printerSerialBaudConfirmed: true
    })
    setSettings(updated)
  }

  // Nur solange noch nie erfolgreich eine Baudrate bestätigt wurde - danach nicht mehr automatisch,
  // sonst wäre der Dialog bei jedem Start störend, sobald schon alles eingerichtet ist. Ohne
  // gewählten seriellen Anschluss gibt es noch nichts zu testen; USB kennt keine Baudrate.
  const needsBaudSetup =
    settings !== null &&
    !dialogDismissed &&
    (settings.printerConnection === '' || settings.printerConnection === 'serial') &&
    !settings.printerSerialBaudConfirmed &&
    settings.printerSerialPath !== ''

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">Kassensystem Dobelmühle</div>
        <nav className="app-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-button${page === n.id ? ' active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {page === 'kasse' && <Kasse />}
        {page === 'produkte' && <Produkte />}
        {page === 'journal' && <Tagesuebersicht />}
        {page === 'einstellungen' && <Einstellungen />}
      </main>
      {needsBaudSetup && settings && (
        <BaudRateSetupDialog
          path={settings.printerSerialPath}
          onConfirmed={(baudRate) => void handleBaudRateConfirmed(baudRate)}
          onDismiss={() => setDialogDismissed(true)}
        />
      )}
    </div>
  )
}
