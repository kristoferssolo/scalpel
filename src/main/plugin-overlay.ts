import type { OverlayAnchor } from '../shared/types'
import { forwardLogLinesTo, onZoneChanged, sendCurrentZoneTo } from './client-log'
import { registerSecondaryOverlay, type SecondaryOverlay } from './windowing'

export interface PluginOverlayOptions {
  title: string
  defaultSize?: { width: number; height: number }
}

// One secondary-overlay handle per plugin id. Registered lazily the first time
// the plugin calls registerOverlay (via IPC). Survives for the process
// lifetime - Scalpel relaunches on game-version switch so no invalidation.
const overlays = new Map<string, SecondaryOverlay>()
let zoneFanoutWired = false

/** Centered default anchor sized from defaultSize (falling back to 380x520
 *  CSS px against a nominal 1920x1080 game). The secondary-overlay system
 *  re-derives real bounds from PoE at show time; these fractions only set the
 *  initial placement + snap-home target. */
function defaultAnchorFor(opts: PluginOverlayOptions): OverlayAnchor {
  const w = opts.defaultSize?.width ?? 380
  const h = opts.defaultSize?.height ?? 520
  const fracW = Math.min(0.9, w / 1920)
  const fracH = Math.min(0.9, h / 1080)
  return { fracX: (1 - fracW) / 2, fracY: (1 - fracH) / 2, fracW, fracH }
}

/** Register exactly one zone-change listener that fans out to every plugin
 *  overlay window. Per-plugin forwardZoneChangesTo would add one EventEmitter
 *  listener per plugin and trip Node's max-listeners warning past ~7 plugins;
 *  a single fan-out keeps it constant. */
function ensureZoneFanout(): void {
  if (zoneFanoutWired) return
  zoneFanoutWired = true
  onZoneChanged((zone) => {
    for (const ov of overlays.values()) {
      const win = ov.getWindow()
      if (win && !win.isDestroyed()) win.webContents.send('zone-changed', zone)
    }
  })
}

export function registerPluginOverlay(pluginId: string, opts: PluginOverlayOptions): SecondaryOverlay {
  const existing = overlays.get(pluginId)
  if (existing) return existing
  const overlay = registerSecondaryOverlay({
    id: `plugin-overlay:${pluginId}`,
    htmlEntry: 'plugin-overlay.html',
    defaultAnchor: () => defaultAnchorFor(opts),
    onFirstShow: (win) => {
      // did-finish-load already fired, so the renderer's init subscription is
      // live: tell it which plugin module to import, then push the current zone.
      win.webContents.send('plugin-overlay:init', pluginId)
      sendCurrentZoneTo(win)
    },
  })
  overlays.set(pluginId, overlay)
  ensureZoneFanout()
  // Log lines forward through a plain array (no EventEmitter listener limit),
  // so a per-plugin getter is fine. Lazy getter is safe before the window exists.
  forwardLogLinesTo(() => overlays.get(pluginId)?.getWindow() ?? null)
  return overlay
}

export function getPluginOverlay(pluginId: string): SecondaryOverlay | null {
  return overlays.get(pluginId) ?? null
}

export function togglePluginOverlay(pluginId: string): void {
  overlays.get(pluginId)?.toggle()
}

export function showPluginOverlay(pluginId: string): void {
  overlays.get(pluginId)?.show()
}

export function hidePluginOverlay(pluginId: string): void {
  overlays.get(pluginId)?.hide()
}

/** Tear down on uninstall: hide the window so it does not linger. The handle
 *  stays in the map (registerSecondaryOverlay throws on re-register of the same
 *  id), which is fine - a reinstall in the same session reuses it. */
export function disposePluginOverlay(pluginId: string): void {
  overlays.get(pluginId)?.hide()
}

/** Test-only: clear the registry and re-arm the zone fan-out. */
export function _resetForTests(): void {
  overlays.clear()
  zoneFanoutWired = false
}
