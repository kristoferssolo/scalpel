import * as fs from 'node:fs'

const POLL_INTERVAL_MS = 500
const MAX_READ_BYTES = 1_000_000

let lastFilePosition = 0
let watchedPath: string | null = null

/** Start polling `path` for appended content. Calls `onLine` for each
 *  non-empty new line written since the previous tick. Seeks to the
 *  current end of the file on startup so we never replay historical log
 *  content. Handles truncation (size < lastPosition resets to 0) and
 *  caps per-tick reads at 1 MB to protect against an idle session
 *  followed by a huge append. */
export function startWatcher(path: string, onLine: (line: string) => void): void {
  if (watchedPath !== null) return
  watchedPath = path
  lastFilePosition = fs.statSync(path).size
  fs.watchFile(path, { interval: POLL_INTERVAL_MS }, (curr, prev) => {
    if (curr.mtime <= prev.mtime) return
    if (curr.size < lastFilePosition) lastFilePosition = 0
    let readFrom = lastFilePosition
    let bytesToRead = curr.size - readFrom
    if (bytesToRead <= 0) return
    if (bytesToRead > MAX_READ_BYTES) {
      readFrom = curr.size - MAX_READ_BYTES
      bytesToRead = MAX_READ_BYTES
    }
    const buf = Buffer.alloc(bytesToRead)
    const fd = fs.openSync(path, 'r')
    try {
      fs.readSync(fd, buf, 0, bytesToRead, readFrom)
    } finally {
      fs.closeSync(fd)
    }
    lastFilePosition = curr.size
    for (const line of buf.toString('utf8').split(/\r?\n/)) {
      if (line.length > 0) onLine(line)
    }
  })
}

/** Vitest-only: clear module state between cases. */
export function _resetForTests(): void {
  if (watchedPath) {
    try {
      fs.unwatchFile(watchedPath)
    } catch {
      /* mocked in tests */
    }
  }
  lastFilePosition = 0
  watchedPath = null
}
