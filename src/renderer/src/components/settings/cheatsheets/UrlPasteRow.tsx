import { CloseSmall } from '@icon-park/react'

/** Full-width URL paste row that appears under the thumbnails when the user
 *  clicks the link half of the placeholder tile. Mirrors the HotkeyField
 *  chrome (same setting-box height + right-cluster of buttons) so the form
 *  affordance reads the same across cheat-sheet rows.
 *
 *  Encodes errors in the value string with an "error: " prefix so the parent
 *  can keep using a single useState; this component picks them apart for
 *  display. */
export function UrlPasteRow({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}): JSX.Element {
  const isError = value.startsWith('error: ')
  const display = isError ? '' : value
  const errorMsg = isError ? value.slice(7) : null
  return (
    <div>
      <div className="setting-box" style={{ cursor: 'auto' }}>
        <input
          autoFocus
          type="text"
          placeholder="Paste image URL"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          className="value flex-1 bg-transparent border-none outline-none p-0 m-0 min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            title="Cancel"
            className="flex items-center justify-center w-5 h-5 shrink-0 rounded bg-white/[0.06] border-none cursor-pointer text-text-dim p-0 hover:bg-[rgba(239,83,80,0.2)] hover:text-white"
          >
            <CloseSmall size={14} theme="outline" fill="currentColor" className="flex" />
          </button>
          <button onClick={onSubmit} className="primary">
            Add
          </button>
        </div>
      </div>
      {errorMsg && <div className="text-[10px] text-danger mt-1 px-2">{errorMsg}</div>}
    </div>
  )
}
