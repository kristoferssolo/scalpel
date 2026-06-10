import { join } from 'node:path'
import { BrowserWindow, screen, type Rectangle } from 'electron'
import { OVERLAY_WINDOW_OPTS, OverlayController } from 'electron-overlay-window'

/** Shared transparent click-through window used by the secondary-overlay system
 *  to render the snap-target ghost during drag. Sized to PoE's current display
 *  (not the full virtual desktop) so Chromium assigns it that monitor's device
 *  scale factor - a window spanning mixed-DPI monitors otherwise gets the
 *  primary's dpr, and DIP-sized rects then render at the wrong physical scale
 *  on any non-primary monitor (visible as ghosts that are offset and shrunk by
 *  the scale-factor ratio). Snap targets are always within PoE's bounds
 *  (they're derived from PoE-relative anchors), so confining the canvas to
 *  PoE's display covers every position a ghost can land at.
 *
 *  The window is created+loaded lazily on first activation; from then on it's
 *  never hidden. Each "hide ghost" sends an IPC clearing the rect so the
 *  transparent window paints nothing - this avoids the Windows blank-window
 *  flash on every show/hide cycle. */

let canvasWin: BrowserWindow | null = null
let canvasShown = false

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Track the display id we last sized the canvas to so we can skip the
// double-setBounds dance when nothing has changed. setSnapGhost re-runs
// applyCanvasBounds on every snap-target transition during drag; without this
// guard each transition would emit two setBounds + the OS move/resize events
// they synthesize, even when the target rect is identical to the current.
let lastCanvasDisplayId: number | null = null
const HIDDEN_SHAPE: Rectangle[] = [{ x: 0, y: 0, width: 1, height: 1 }]

function setCanvasShape(win: BrowserWindow, rect: Rect | null): void {
  if (process.platform !== 'linux') return
  try {
    if (!rect) {
      win.setShape(HIDDEN_SHAPE)
      return
    }
    const bounds = win.getBounds()
    const shape: Rectangle = {
      x: Math.max(0, Math.floor(rect.x - bounds.x)),
      y: Math.max(0, Math.floor(rect.y - bounds.y)),
      width: Math.max(1, Math.ceil(rect.width)),
      height: Math.max(1, Math.ceil(rect.height)),
    }
    win.setShape([shape])
  } catch {
    // setShape is a visual workaround only; the renderer can still clear itself.
  }
}

function applyCanvasBounds(win: BrowserWindow): void {
  // Prefer the display PoE sits on so the canvas's CSS coordinate space ==
  // that monitor's DIP at the monitor's scale factor. Fall back to the primary
  // display when PoE isn't attached (dev, between attach/detach, etc.).
  const tb = OverlayController.targetBounds
  const display =
    tb && tb.width > 0 && tb.height > 0
      ? screen.getDisplayNearestPoint({
          x: tb.x + Math.round(tb.width / 2),
          y: tb.y + Math.round(tb.height / 2),
        })
      : screen.getPrimaryDisplay()
  if (display.id === lastCanvasDisplayId) return
  lastCanvasDisplayId = display.id
  win.setBounds(display.bounds)
  // Windows sometimes needs a second setBounds when the target display has a
  // different scale factor than the current one, mirroring the double-apply
  // pattern in electron-overlay-window's main overlay.
  if (process.platform === 'win32') win.setBounds(display.bounds)
}

function ensureCanvasWindow(): BrowserWindow {
  if (canvasWin && !canvasWin.isDestroyed()) return canvasWin
  canvasWin = new BrowserWindow({
    ...OVERLAY_WINDOW_OPTS,
    backgroundColor: '#00000000',
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // 'screen-saver' lifts the canvas above PoE + taskbar + other floating
  // windows. Same level the main overlay runs at after attach.
  canvasWin.setAlwaysOnTop(true, 'screen-saver')
  applyCanvasBounds(canvasWin)
  canvasWin.setIgnoreMouseEvents(true)
  if (process.env.ELECTRON_RENDERER_URL) {
    void canvasWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}/secondary-overlay-canvas.html`)
  } else {
    void canvasWin.loadFile(join(__dirname, '../renderer/secondary-overlay-canvas.html'))
  }
  return canvasWin
}

/** Pre-create the canvas so its renderer process is warm before a snap ghost
 *  is first needed. Called when a secondary overlay is first shown. */
export function prewarmSnapCanvas(): void {
  ensureCanvasWindow()
}

/** The shared canvas BrowserWindow, or null if it hasn't been created yet.
 *  Used by aroundNativeDialog to temporarily demote alwaysOnTop so native
 *  dialogs render above us. */
export function getSnapCanvasWindow(): BrowserWindow | null {
  return canvasWin && !canvasWin.isDestroyed() ? canvasWin : null
}

/** Show the snap ghost at the given rect. Pass null to clear it. */
export function setSnapGhost(rect: Rect | null): void {
  const win = ensureCanvasWindow()
  if (rect) {
    // Re-apply bounds on every show: PoE may have moved to a different display
    // since the canvas was last sized, and the canvas needs to land on PoE's
    // current display to inherit that monitor's scale factor. Also covers the
    // Windows quirk where the first show after creation re-clamps the window
    // into the work area, chopping the bottom off.
    applyCanvasBounds(win)
    setCanvasShape(win, rect)
    if (!canvasShown) {
      win.show()
      canvasShown = true
    }
  } else {
    setCanvasShape(win, null)
  }
  win.webContents.send('secondary-overlay-canvas:snap-ghost', rect)
}
