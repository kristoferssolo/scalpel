import type { BrowserWindow } from 'electron'
import { parseClientLogLine } from './parse-client-log'
import { resolveClientLogPath } from './path-resolver'
import { startWatcher } from './watcher'
import { ingestZoneEvent, onZoneChanged, getCurrentZone } from './zone-state'

let started = false

/** Boot the Client.txt watcher and pipe zone changes to the overlay
 *  webContents. Idempotent (re-attach events shouldn't restart the
 *  watcher). Silent on resolve failure - the watcher just doesn't start
 *  and the toggle never renders. */
export function startClientLogWatcher(overlayWindow: BrowserWindow): void {
  if (started) return
  const path = resolveClientLogPath()
  if (!path) return
  started = true
  startWatcher(path, (line) => {
    const parsed = parseClientLogLine(line)
    if (parsed) ingestZoneEvent(parsed)
  })
  onZoneChanged((zone) => {
    if (overlayWindow.isDestroyed()) return
    overlayWindow.webContents.send('zone-changed', zone)
  })
  // Send the current state immediately so a renderer that mounts after
  // the first zone change picks up the existing state instead of waiting
  // for the next one.
  if (!overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('zone-changed', getCurrentZone())
  }
}

export { getCurrentZone } from './zone-state'
