import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import { detectFocusedPoeVersion } from './detector'
import { getPoeVersion } from './state'
import { performGameSwitch } from './context'

const POLL_INTERVAL_MS = 500
const SWITCH_COOLDOWN_MS = 1000

let intervalId: ReturnType<typeof setInterval> | null = null
let lastSwitchAt = 0
let switching = false

/** Start polling the OS foreground window. When the user focuses a different PoE
 *  game than the one Scalpel is currently attached to, automatically switch the
 *  active profile, filter, prices, and overlay retargeting in-process. Switches
 *  are debounced (1s cooldown) and serialised so rapid alt-tabbing between games
 *  cannot trigger overlapping side effects. */
export function startAutoGameWatcher(store: Store<AppSettings>): void {
  if (intervalId) return

  intervalId = setInterval(async () => {
    if (switching) return
    if (Date.now() - lastSwitchAt < SWITCH_COOLDOWN_MS) return

    try {
      const focused = await detectFocusedPoeVersion()
      if (focused === null) return // not a PoE window
      if (focused === getPoeVersion()) return // already on this game

      switching = true
      try {
        performGameSwitch(store, focused)
        lastSwitchAt = Date.now()
        notifyWatcherSwitch(focused)
      } finally {
        switching = false
      }
    } catch {
      // active-win may throw transient OS errors; skip this poll
    }
  }, POLL_INTERVAL_MS)
}

/** Stop the polling interval. Idempotent. */
export function stopAutoGameWatcher(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

type WatcherListener = (variant: 1 | 2) => void
let watcherListeners: WatcherListener[] = []

function notifyWatcherSwitch(variant: 1 | 2): void {
  for (const fn of watcherListeners) {
    try {
      fn(variant)
    } catch {
      // listener errors must not break the polling loop
    }
  }
}

/** Register a callback invoked after *every* automatic watcher-driven game
 *  switch (not manual tray or hotkey-triggered switches). Use this to rebuild
 *  the tray menu, update diagnostics, etc. */
export function onAutoGameSwitch(fn: WatcherListener): () => void {
  watcherListeners.push(fn)
  return () => {
    watcherListeners = watcherListeners.filter((f) => f !== fn)
  }
}

/** True while the polling interval is active. */
export function isAutoGameWatcherRunning(): boolean {
  return intervalId !== null
}

/** Reset all module-level state. Only exposed for test isolation. */
export function _resetWatcherForTesting(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  lastSwitchAt = 0
  switching = false
  watcherListeners = []
}
