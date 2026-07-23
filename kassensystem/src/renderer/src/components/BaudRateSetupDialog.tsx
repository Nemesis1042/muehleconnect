import BaudRateWizard from './BaudRateWizard'

interface Props {
  path: string
  onConfirmed: (baudRate: number) => void
  onDismiss: () => void
}

export default function BaudRateSetupDialog({ path, onConfirmed, onDismiss }: Props): JSX.Element {
  return (
    <div className="modal-backdrop">
      <div className="modal card baud-setup-dialog">
        <h2>Bevor es losgeht</h2>
        <p>Wir müssen einmal die richtige Drucker-Einstellung finden.</p>
        <BaudRateWizard path={path} onConfirmed={onConfirmed} onDismiss={onDismiss} />
      </div>
    </div>
  )
}
