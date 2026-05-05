import { CloseSmall } from '@icon-park/react'
import appIcon from '../../../../resources/icon.png'

interface ChromeProps {
  /** Optional content rendered to the right of the logo in the header (e.g.
   *  category tabs). Lives inside the drag region but inherits no-drag from
   *  individual interactive children. */
  headerContent?: React.ReactNode
  /** Optional content rendered between `headerContent` and the close button --
   *  intended for view-control affordances (size pickers, filters, etc.) that
   *  belong on the right side of the bar. Same drag behavior as headerContent. */
  headerEnd?: React.ReactNode
  /** Body content beneath the header. */
  children: React.ReactNode
  onClose: () => void
}

/** Standard chrome for a secondary overlay window: rounded translucent card
 *  with a draggable header containing the Scalpel logo, an optional content
 *  slot (tabs, status text, ...), and a square close button. The whole
 *  surface is sized to 100vh so it fills the BrowserWindow.
 *
 *  Consumers compose their body inside <Chrome>...</Chrome>. Interactive
 *  elements anywhere in the chrome should set
 *  `style={{ WebkitAppRegion: 'no-drag' }}` so the title-bar drag doesn't
 *  swallow their clicks. The close button + header buttons handle this
 *  automatically. */
export function Chrome({ headerContent, headerEnd, children, onClose }: ChromeProps): JSX.Element {
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties
  const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
  return (
    <div className="flex flex-col h-screen bg-bg-card-translucent rounded overflow-hidden border border-border">
      <div
        className="flex items-center justify-between gap-2 px-2 py-1 border-b border-border bg-bg-solid-translucent"
        style={drag}
      >
        <div className="flex items-center gap-2 min-w-0">
          <img src={appIcon} alt="Scalpel" className="w-4 h-4 shrink-0" />
          {headerContent && (
            <div className="flex gap-[6px] flex-wrap" style={noDrag}>
              {headerContent}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {headerEnd && (
            <div className="flex items-center gap-[4px]" style={noDrag}>
              {headerEnd}
            </div>
          )}
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text shrink-0 w-6 h-6 flex items-center justify-center"
            style={noDrag}
          >
            <CloseSmall size={14} theme="outline" fill="currentColor" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
