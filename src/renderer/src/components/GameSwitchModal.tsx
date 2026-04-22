interface Props {
  target: 1 | 2
  onRestart: () => void
  onCancel: () => void
}

export function GameSwitchModal({ target, onRestart, onCancel }: Props): JSX.Element {
  const targetName = target === 2 ? 'Path of Exile 2' : 'Path of Exile'
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="bg-bg-card border border-border rounded p-6 flex flex-col gap-4"
        style={{ maxWidth: 420, width: '90%' }}
      >
        <h3 className="text-accent text-sm font-bold m-0">Switch to {targetName}?</h3>
        <p className="text-xs text-text m-0 leading-normal">
          Scalpel works with both games, but it needs to restart when you move between them.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} style={{ padding: '8px 20px' }}>
            Cancel
          </button>
          <button className="primary" onClick={onRestart} style={{ padding: '8px 20px' }}>
            Restart
          </button>
        </div>
      </div>
    </div>
  )
}
