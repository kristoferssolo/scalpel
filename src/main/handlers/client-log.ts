import { ipcMain } from 'electron'
import { addLogLineSubscriberRef, getRecentLogLines, removeLogLineSubscriberRef } from '../client-log/tail-buffer'

/** IPC for the plugin log-tail surface. The renderer increments the subscriber
 *  ref-count on first onLogLine subscribe and decrements on last unsubscribe,
 *  so the main process only forwards lines when someone is listening. */
export function registerClientLogHandlers(): void {
  ipcMain.handle('client-log:recent-lines', (_evt, count?: number): string[] => {
    return getRecentLogLines(typeof count === 'number' ? count : undefined)
  })
  ipcMain.on('client-log:subscribe', () => addLogLineSubscriberRef())
  ipcMain.on('client-log:unsubscribe', () => removeLogLineSubscriberRef())
}
