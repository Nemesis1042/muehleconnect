import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Without this, an unexpected render error anywhere in the tree unmounts the whole app to a
// blank screen (no error boundary means React tears down the entire tree) - during a live sale
// that leaves the cashier with no way to recover except force-quitting and restarting the app.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Kassensystem] Unerwarteter Fehler in der Oberfläche:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>Ein unerwarteter Fehler ist aufgetreten</h1>
          <p>{this.state.error.message}</p>
          <p>Bereits gespeicherte Verkäufe sind davon nicht betroffen.</p>
          <button className="button-accent" onClick={() => window.location.reload()}>
            Kassensystem neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
