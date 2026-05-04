import { BrowserWindow, screen } from 'electron'
import { getSnapCanvasWindow, setSnapGhost } from './snap-canvas'
import { getMainOverlay, overlays } from './state'

/** True if `win` is a registered secondary-overlay window. */
export function isSecondaryOverlayWindow(win: BrowserWindow): boolean {
  for (const state of overlays.values()) {
    if (state.win === win) return true
  }
  return false
}

// True while at least one native OS dialog is open. A dialog isn't a
// BrowserWindow and steals focus, which would otherwise trip the blur-
// handlers and hide whichever overlay the user opened it from. Treat it as
// "still in Scalpel" - a dialog is part of the same logical task. Reference-
// counted so concurrent dialogs don't desync the flag.
let nativeDialogCount = 0

/** Run an async block while marking a native dialog as open. While open, the
 *  isAnyScalpelWindowFocused predicate returns true so PoE-blur and Scalpel-
 *  window-blur handlers don't hide overlays mid-dialog. Also temporarily
 *  demotes every Scalpel window's alwaysOnTop level so the dialog can render
 *  above us - a screen-saver-level window otherwise occludes the file picker. */
export async function aroundNativeDialog<T>(fn: () => Promise<T>): Promise<T> {
  const isFirst = nativeDialogCount === 0
  nativeDialogCount++
  const demoted = isFirst ? collectScalpelWindows().filter((w) => w.isAlwaysOnTop()) : []
  for (const w of demoted) w.setAlwaysOnTop(false)
  try {
    return await fn()
  } finally {
    nativeDialogCount--
    if (nativeDialogCount === 0) {
      for (const w of demoted) {
        if (w.isDestroyed()) continue
        w.setAlwaysOnTop(true, 'screen-saver')
        // setAlwaysOnTop sets the topmost *flag* but doesn't actively raise an
        // already-buried window, so if the user clicked into PoE during the
        // dialog the overlay would stay behind PoE even after restore.
        // moveTop forces it to the front of the Z-order.
        w.moveTop()
      }
    }
  }
}

function collectScalpelWindows(): BrowserWindow[] {
  const result: BrowserWindow[] = []
  const main = getMainOverlay()
  if (main && !main.isDestroyed()) result.push(main)
  for (const state of overlays.values()) {
    if (state.win && !state.win.isDestroyed()) result.push(state.win)
  }
  const canvas = getSnapCanvasWindow()
  if (canvas) result.push(canvas)
  return result
}

/** True iff focus is currently on any Scalpel-owned window: the main overlay
 *  or any registered secondary overlay. The single source of truth for "did
 *  the user actually leave the app?" - every blur/hide decision should defer
 *  to this so clicking from one Scalpel window to another doesn't trigger
 *  cross-overlay hides. Native dialogs count as Scalpel-active too. */
export function isAnyScalpelWindowFocused(): boolean {
  if (nativeDialogCount > 0) return true
  const focused = BrowserWindow.getFocusedWindow()
  if (!focused || focused.isDestroyed()) return false
  if (focused === getMainOverlay()) return true
  return isSecondaryOverlayWindow(focused)
}

/** True if the screen point lies inside any visible secondary overlay window.
 *  Used by the main overlay's click-outside check so clicks on a Scalpel
 *  secondary window (cheat sheets etc.) don't get treated as "outside" and
 *  hide the main overlay.
 *
 *  Coordinates are in physical screen pixels (uIOhook reports them that way).
 *  BrowserWindow.getBounds() returns DIPs, so we have to scale before
 *  comparing - otherwise the check silently misfires on >100% DPI displays. */
export function isInsideAnySecondaryOverlay(physX: number, physY: number): boolean {
  for (const state of overlays.values()) {
    if (!state.win || state.win.isDestroyed() || !state.win.isVisible()) continue
    const b = state.win.getBounds()
    const sf = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).scaleFactor
    const left = b.x * sf
    const top = b.y * sf
    const right = left + b.width * sf
    const bottom = top + b.height * sf
    if (physX >= left && physX < right && physY >= top && physY < bottom) return true
  }
  return false
}

/** Hide every visible secondary overlay when PoE blurs AND focus has actually
 *  left Scalpel. Records visibility on each so restoreAllOnPoeFocus can bring
 *  them back. Called from the PoE focus-blur handler in main/index.ts. */
export function hideAllOnPoeBlur(): void {
  // Focus going from PoE to one of our windows is not "leaving the app".
  // Bail before recording wasVisibleBeforeFocusLoss so a later refocus
  // doesn't decide to "restore" something we never hid.
  if (isAnyScalpelWindowFocused()) return
  for (const state of overlays.values()) {
    if (!state.win || state.win.isDestroyed()) continue
    state.wasVisibleBeforeFocusLoss = state.win.isVisible()
    if (state.wasVisibleBeforeFocusLoss) state.win.hide()
  }
  setSnapGhost(null)
}

/** Re-show overlays that were visible when PoE last blurred. */
export function restoreAllOnPoeFocus(): void {
  for (const state of overlays.values()) {
    if (!state.wasVisibleBeforeFocusLoss) continue
    if (!state.win || state.win.isDestroyed()) continue
    state.win.show()
  }
}

/** Esc handling: hide the focused overlay if any, else any visible overlay.
 *  Returns true if an overlay was hidden so the caller can short-circuit (we
 *  don't want Esc to also dismiss the main overlay when a secondary was up).
 *  Called from the kernel-level Esc handler in hotkeys.ts. */
export function hideFocusedOrAnyVisibleSecondaryOverlay(): boolean {
  const focused = BrowserWindow.getFocusedWindow()
  for (const state of overlays.values()) {
    if (state.win && state.win === focused && state.win.isVisible()) {
      hideOverlayState(state)
      return true
    }
  }
  for (const state of overlays.values()) {
    if (state.win && !state.win.isDestroyed() && state.win.isVisible()) {
      hideOverlayState(state)
      return true
    }
  }
  return false
}

function hideOverlayState(state: import('./state').OverlayState): void {
  if (!state.win || state.win.isDestroyed()) return
  state.wasVisibleBeforeFocusLoss = false
  state.win.hide()
}
