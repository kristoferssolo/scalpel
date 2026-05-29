/** Bounded buffer (trimmed to the most recent MAX_LINES) of raw Client.txt
 *  lines, plus a subscriber ref-count so the watcher can skip IPC forwarding
 *  when no renderer is listening. Module-level singleton: one Client.txt, one
 *  buffer. */

const MAX_LINES = 200

let buffer: string[] = []
let subscriberCount = 0

/** Append a raw line, trimming the buffer to the most recent MAX_LINES. */
export function pushLogLine(line: string): void {
  buffer.push(line)
  if (buffer.length > MAX_LINES) buffer = buffer.slice(buffer.length - MAX_LINES)
}

/** The most recent buffered lines. With no argument returns every buffered
 *  line (up to MAX_LINES); with `count` returns the last `count`. */
export function getRecentLogLines(count?: number): string[] {
  if (count === undefined) return [...buffer]
  if (count <= 0) return []
  return buffer.slice(Math.max(0, buffer.length - count))
}

export function hasLogLineSubscribers(): boolean {
  return subscriberCount > 0
}

export function addLogLineSubscriberRef(): void {
  subscriberCount++
}

export function removeLogLineSubscriberRef(): void {
  if (subscriberCount > 0) subscriberCount--
}

export function _resetForTests(): void {
  buffer = []
  subscriberCount = 0
}
