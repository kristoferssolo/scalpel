import { useEffect } from 'react'

/** Push focusin/focusout state for this window's editable elements to the
 *  main process, so the hotkey gate can swallow keystrokes while the user is
 *  typing in any Scalpel surface (main overlay, whiteboard text editor, etc.).
 *  Without this, single-key hotkeys would be unusable in text fields.
 *
 *  Mount in each Scalpel window's root component. Main reconciles per-sender
 *  state in `src/main/overlay.ts` and gates uIOhook-routed handlers via
 *  `isTypingInOverlay()`. */
export function useReportInputFocus(): void {
  useEffect(() => {
    const isEditable = (el: Element | null): boolean => {
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      return (el as HTMLElement).isContentEditable
    }
    let last = false
    const update = (): void => {
      const next = isEditable(document.activeElement)
      if (next !== last) {
        last = next
        window.api.setOverlayInputFocused(next)
      }
    }
    update()
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
}
