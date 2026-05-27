import { desktopCapturer, screen } from 'electron'
import { OverlayController } from 'electron-overlay-window'
import type { PanelState } from '../../shared/panel-state'
import { getPoeVersion } from '../game-state'
import { getWhiteboardOverlay } from '../whiteboard'
import { PanelDetector } from './detector'
import type { BitmapView } from './match'
import { PANEL_SAMPLES } from './panel-samples'

let detector: PanelDetector | null = null
let lastPanelState: PanelState = { leftPanelOpen: false, rightPanelOpen: false }

/** Last detected panel state; returned by get-overlay-state for the initial pull. */
export function getCurrentPanelState(): PanelState {
  return lastPanelState
}

/** Cap the captured game-window height so the synchronous toBitmap copy stays
 *  bounded on high-res displays. That copy runs on the main-process event loop,
 *  so an oversized one hitches the overlay's mouse handling. 1080 preserves the
 *  reference patch size (round(h/360) = 3px, as validated in-game) and is a
 *  no-op at <= 1080p. */
const MAX_CAPTURE_HEIGHT = 1080

/** Capture the display the game is on and crop to the game-window rect, returning
 *  BGRA pixels with (0,0) at the window top-left. Null when the whiteboard (the
 *  only consumer) is hidden, the game isn't focused, or no usable frame is
 *  available. Physical-pixel assumptions are validated in-game. */
async function captureGameWindow(): Promise<BitmapView | null> {
  // The distance overlay is the only consumer; skip the expensive screen grab
  // entirely while the whiteboard is hidden so normal play never pays for it.
  if (!getWhiteboardOverlay()?.isVisible()) return null
  if (!OverlayController.targetHasFocus) return null
  const tb = OverlayController.targetBounds
  if (!tb?.width || !tb.height) return null

  try {
    const display = screen.getDisplayNearestPoint({ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 })
    const sf = display.scaleFactor
    // Downscale the request when the game window is taller than the cap, shrinking
    // the synchronous toBitmap copy. thumbnailSize is advisory, so the real scale
    // is recomputed from the returned frame below.
    const capScale = Math.min(1, MAX_CAPTURE_HEIGHT / tb.height)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * sf * capScale),
        height: Math.round(display.size.height * sf * capScale),
      },
    })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (!source) return null

    const img = source.thumbnail
    const full = img.getSize()
    if (full.width === 0 || full.height === 0) return null
    const bmp = img.toBitmap() // BGRA, row-major

    // Actual capture scale from the returned thumbnail (drivers may clamp/round
    // the requested size), so the crop offsets land on the right pixels.
    const scaleX = full.width / (display.size.width * sf)
    const scaleY = full.height / (display.size.height * sf)
    const ox = Math.round((tb.x - display.bounds.x * sf) * scaleX)
    const oy = Math.round((tb.y - display.bounds.y * sf) * scaleY)
    const w = Math.round(tb.width * scaleX)
    const h = Math.round(tb.height * scaleY)
    if (w <= 0 || h <= 0 || ox < 0 || oy < 0 || ox + w > full.width || oy + h > full.height) return null

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

/** Start detecting panel state and pushing changes to the whiteboard renderer
 *  (the only consumer). No-op for unsupported versions (PANEL_SAMPLES null) so
 *  PoE2 incurs no cost. The capture is gated on the whiteboard being visible. */
export function startPanelDetection(): void {
  if (detector) return
  if (!PANEL_SAMPLES[getPoeVersion()]) return
  detector = new PanelDetector({
    capture: captureGameWindow,
    samples: () => PANEL_SAMPLES[getPoeVersion()],
    onChange: (state) => {
      lastPanelState = state
      const win = getWhiteboardOverlay()?.getWindow()
      if (win && !win.isDestroyed()) win.webContents.send('panel-state', state)
    },
  })
  detector.start()
}

export function stopPanelDetection(): void {
  detector?.stop()
  detector = null
  lastPanelState = { leftPanelOpen: false, rightPanelOpen: false }
}
