import { BrowserWindow } from 'electron'
import { OverlayController } from 'electron-overlay-window'
import { uIOhook } from 'uiohook-napi'
import { createOverlayWindow } from './window'
import { prewarmSnapCanvas, setSnapGhost, type Rect } from './snap-canvas'
import { isAnyScalpelWindowFocused } from './focus'
import { fireOnLeaveScalpel, overlays, type OverlayState } from './state'

// Public re-exports - this module is the public face of the windowing system.
export type { Rect }
export { sendCanvasIpc, moveCanvasTop, prewarmSnapCanvas, setSnapGhost } from './snap-canvas'
export {
  aroundNativeDialog,
  hideAllOnPoeBlur,
  hideFocusedOrAnyVisibleSecondaryOverlay,
  isAnyScalpelWindowFocused,
  isInsideAnySecondaryOverlay,
  isSecondaryOverlayWindow,
  restoreAllOnPoeFocus,
} from './focus'
export { setMainOverlayGetter, setOnLeaveScalpel } from './state'

interface DefaultBoundsCtx {
  /** PoE's window bounds when known, else null (no game running). The bounds
   *  helper should fall back to a sensible non-PoE default when null. */
  poeBounds: Rect | null
  /** Optional override for size when computing snap target during drag (use
   *  the dragged window's *current* size, not the spec's default). */
  width?: number
  height?: number
}

export interface OverlaySpec {
  /** Stable id, used for IPC channels and as a lookup key. Kebab-case. */
  id: string
  /** HTML filename in src/renderer/, e.g. 'cheat-sheets-grid.html'. */
  htmlEntry: string
  /** Compute the snap-target / first-create rect. Called both at window
   *  creation (when no persisted bounds exist) and during drag to determine
   *  where the snap ghost goes. */
  defaultBounds: (ctx: DefaultBoundsCtx) => Rect
  /** Optional: read persisted bounds (from electron-store etc.). */
  storedBounds?: () => Rect | undefined
  /** Optional: fired whenever the user moves or resizes the window. Persist
   *  here. */
  onBoundsChanged?: (bounds: Rect) => void
  /** Fired once after did-finish-load + the very first show. The earliest
   *  safe point to deliver IPCs whose payload was known at registration time
   *  but couldn't be sent during window creation (renderer wasn't mounted
   *  yet, so webContents.send would silently drop them). */
  onFirstShow?: (win: BrowserWindow) => void
}

export interface SecondaryOverlay {
  show(): void
  hide(): void
  toggle(): void
  isVisible(): boolean
  send(channel: string, ...args: unknown[]): void
  /** The underlying BrowserWindow. Null until the first .show() (window is
   *  created lazily so we don't spawn renderers for overlays the user never
   *  touches in a session). */
  getWindow(): BrowserWindow | null
}

const SNAP_RANGE = 80

// Track left-mouse-button state globally so we only show the snap ghost when
// the user is actually dragging. gridWin.on('move') fires for *any* bounds
// change - initial creation, programmatic restores, etc. - so without this
// gate the ghost would light up whenever a persisted position happens to be
// within snap range of the default. Mirrors how the main overlay only updates
// snap state inside its drag-bound mousemove handler.
let leftMouseHeld = false
uIOhook.on('mousedown', (e) => {
  if (e.button === 1) leftMouseHeld = true
})
uIOhook.on('mouseup', (e) => {
  if (e.button === 1) leftMouseHeld = false
  // Don't clear snapGhostActive here - the gridWin 'moved' event fires
  // *after* this mouseup and needs the flag set to know whether to commit
  // the snap. Clearing it here would silently break the snap.
})

export function registerSecondaryOverlay(spec: OverlaySpec): SecondaryOverlay {
  if (overlays.has(spec.id)) {
    throw new Error(`Secondary overlay '${spec.id}' is already registered`)
  }
  const state: OverlayState = {
    spec,
    win: null,
    snapGhostActive: false,
    inProgrammaticMove: false,
    isResizing: false,
    wasVisibleBeforeFocusLoss: false,
  }
  overlays.set(spec.id, state)
  return makeOverlayApi(state)
}

function makeOverlayApi(state: OverlayState): SecondaryOverlay {
  return {
    show: () => showState(state),
    hide: () => hideState(state),
    toggle: () => {
      if (state.win && !state.win.isDestroyed() && state.win.isVisible()) {
        hideState(state)
      } else {
        showState(state)
      }
    },
    isVisible: () => !!state.win && !state.win.isDestroyed() && state.win.isVisible(),
    send: (channel, ...args) => {
      if (state.win && !state.win.isDestroyed()) state.win.webContents.send(channel, ...args)
    },
    getWindow: () => (state.win && !state.win.isDestroyed() ? state.win : null),
  }
}

// ---- Internal state operations ---------------------------------------------

function ensureWin(state: OverlayState): BrowserWindow {
  if (state.win && !state.win.isDestroyed()) return state.win
  const stored = state.spec.storedBounds?.()
  const bounds = stored ?? state.spec.defaultBounds({ poeBounds: getPoeBounds() })
  const win = createOverlayWindow({ htmlEntry: state.spec.htmlEntry, bounds })
  state.win = win
  prewarmSnapCanvas()
  wireWindowEvents(state, win)
  win.webContents.once('did-finish-load', () => {
    if (!state.win || state.win.isDestroyed()) return
    // First show registers the window with the OS (one-time animation).
    // Doesn't steal focus from PoE - see installOpacityHideShow comment.
    state.win.show()
    state.spec.onFirstShow?.(state.win)
  })
  return win
}

function showState(state: OverlayState): void {
  const win = ensureWin(state)
  // The did-finish-load handler above takes care of the very first show.
  // Subsequent shows (window already loaded) just flip opacity. No .focus()
  // call - we never want to steal focus from PoE (background PoE breaks
  // hold-to-move and re-triggers PoE-blur which causes overlay flicker).
  if (win.webContents.isLoading()) return
  if (win.isVisible()) return
  win.show()
}

function hideState(state: OverlayState): void {
  if (!state.win || state.win.isDestroyed()) return
  // Explicit user-driven hide: clear the auto-restore memory so PoE
  // refocusing doesn't bring it back. Only PoE alt-tab cycles restore.
  state.wasVisibleBeforeFocusLoss = false
  state.win.hide()
}

function wireWindowEvents(state: OverlayState, win: BrowserWindow): void {
  win.on('close', (e) => {
    e.preventDefault()
    win.hide()
    state.wasVisibleBeforeFocusLoss = false
  })
  win.on('move', () => {
    if (state.inProgrammaticMove) return
    maybeUpdateSnap(state)
  })
  win.on('moved', () => {
    if (state.inProgrammaticMove) return
    if (state.snapGhostActive) {
      // Snap will commit: skip persisting the user's pre-snap drop position
      // and persist the snapped position once after setBounds. The synthetic
      // 'moved' Windows fires from setBounds-inside-a-moved-handler doesn't
      // reliably arrive on Windows, so we have to persist explicitly.
      state.snapGhostActive = false
      setSnapGhost(null)
      state.inProgrammaticMove = true
      const cur = win.getBounds()
      const target = state.spec.defaultBounds({ poeBounds: getPoeBounds(), width: cur.width, height: cur.height })
      win.setBounds(target)
      persistBounds(state)
      // Pad past the synthetic move/moved volley so distance=0 doesn't re-arm.
      setTimeout(() => {
        state.inProgrammaticMove = false
      }, 200)
    } else {
      persistBounds(state)
      setSnapGhost(null)
    }
  })
  win.on('will-resize', () => {
    state.isResizing = true
  })
  win.on('resized', () => {
    persistBounds(state)
    state.isResizing = false
  })
  win.on('blur', () => {
    setImmediate(() => {
      if (!state.win || state.win.isDestroyed()) return
      // PoE keeps the overlay alive; focus moving to another Scalpel window
      // (main overlay or sibling secondary) does too. Only hide when focus
      // genuinely left the app.
      if (OverlayController.targetHasFocus || isAnyScalpelWindowFocused()) return
      if (state.win.isVisible()) {
        state.wasVisibleBeforeFocusLoss = true
        state.win.hide()
      }
      setSnapGhost(null)
      // Focus left every Scalpel surface. The PoE-blur handler in main can't
      // fire here because PoE was already blurred when focus moved into this
      // overlay; without this hook, hotkeys would stay armed in the
      // destination app.
      fireOnLeaveScalpel()
    })
  })
}

function persistBounds(state: OverlayState): void {
  if (!state.win || state.win.isDestroyed()) return
  state.spec.onBoundsChanged?.(state.win.getBounds())
}

function maybeUpdateSnap(state: OverlayState): void {
  if (!state.win || state.win.isDestroyed()) return
  // Only react to bounds changes that happen while the user is actively
  // holding the mouse (dragging the title bar). Programmatic moves and the
  // 'move' events fired during initial show would otherwise pop the ghost
  // when the persisted bounds happen to be within snap range.
  if (!leftMouseHeld) return
  // Resizing from the top/left edges shifts the origin, firing 'move' events
  // that look like a drag. Skip - the user isn't repositioning, they're
  // resizing.
  if (state.isResizing) return
  const cur = state.win.getBounds()
  const target = state.spec.defaultBounds({ poeBounds: getPoeBounds(), width: cur.width, height: cur.height })
  const dist = Math.hypot(cur.x - target.x, cur.y - target.y)
  const wantActive = dist < SNAP_RANGE
  if (wantActive === state.snapGhostActive) return
  state.snapGhostActive = wantActive
  setSnapGhost(state.snapGhostActive ? target : null)
}

function getPoeBounds(): Rect | null {
  const tb = OverlayController.targetBounds
  return tb && tb.width > 0 && tb.height > 0 ? { x: tb.x, y: tb.y, width: tb.width, height: tb.height } : null
}
