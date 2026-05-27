import { type BrowserWindow, desktopCapturer, screen } from 'electron'
import { OverlayController } from 'electron-overlay-window'
import type { PanelState } from '../../shared/panel-state'
import { getPoeVersion } from '../game-state'
import { PanelDetector } from './detector'
import type { BitmapView } from './match'
import { PANEL_SAMPLES } from './panel-samples'

let detector: PanelDetector | null = null
let lastPanelState: PanelState = { leftPanelOpen: false, rightPanelOpen: false }

/** Last detected panel state; returned by get-overlay-state for the initial pull. */
export function getCurrentPanelState(): PanelState {
  return lastPanelState
}

/** Capture the display the game is on and crop to the game-window rect, returning
 *  BGRA pixels with (0,0) at the window top-left. Null when the game isn't focused
 *  or no usable frame is available. Physical-pixel assumptions are validated in-game. */
async function captureGameWindow(): Promise<BitmapView | null> {
  if (!OverlayController.targetHasFocus) return null
  const tb = OverlayController.targetBounds
  if (!tb?.width || !tb.height) return null

  try {
    const display = screen.getDisplayNearestPoint({ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 })
    const sf = display.scaleFactor
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(display.size.width * sf), height: Math.round(display.size.height * sf) },
    })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (!source) return null

    const img = source.thumbnail
    const full = img.getSize()
    const bmp = img.toBitmap() // BGRA, row-major

    const ox = Math.round(tb.x - display.bounds.x * sf)
    const oy = Math.round(tb.y - display.bounds.y * sf)
    const w = Math.round(tb.width)
    const h = Math.round(tb.height)
    if (ox < 0 || oy < 0 || ox + w > full.width || oy + h > full.height) return null

    const out = Buffer.allocUnsafe(w * h * 4)
    for (let y = 0; y < h; y++) {
      const srcStart = ((oy + y) * full.width + ox) * 4
      bmp.copy(out, y * w * 4, srcStart, srcStart + w * 4)
    }
    return { data: out, width: w, height: h }
  } catch (err) {
    if (process.env.SCALPEL_DEBUG_LOG) console.error('[panel-detection] capture failed', err)
    return null
  }
}

/** Start detecting panel state and pushing changes to the overlay renderer.
 *  No-op for unsupported versions (PANEL_SAMPLES null) so PoE2 incurs no cost. */
export function startPanelDetection(overlayWindow: BrowserWindow): void {
  if (detector) return
  if (!PANEL_SAMPLES[getPoeVersion()]) return
  detector = new PanelDetector({
    capture: captureGameWindow,
    samples: () => PANEL_SAMPLES[getPoeVersion()],
    onChange: (state) => {
      lastPanelState = state
      if (!overlayWindow.isDestroyed()) overlayWindow.webContents.send('panel-state', state)
    },
  })
  detector.start()
}

export function stopPanelDetection(): void {
  detector?.stop()
  detector = null
  lastPanelState = { leftPanelOpen: false, rightPanelOpen: false }
}
