import { useState } from 'react'
import Kasse from './pages/Kasse'
import Produkte from './pages/Produkte'
import Einstellungen from './pages/Einstellungen'
import Tagesuebersicht from './pages/Tagesuebersicht'
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
    </div>
  )
}
