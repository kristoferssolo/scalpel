// active-win is ESM-only; dynamic import lets us consume it from our CJS main.
// The module and its native binding load once, then we reuse the cached fn.
type ActiveWindowFn = () => Promise<{ title?: string } | undefined>
type OpenWindowsFn = () => Promise<Array<{ title: string; owner: { name: string; processId: number; path: string } }>>
let activeWindow: ActiveWindowFn | null = null
let openWindowsFn: OpenWindowsFn | null = null

async function getActiveWindowFn(): Promise<ActiveWindowFn> {
  if (activeWindow) return activeWindow
  const mod = (await import('active-win')) as { activeWindow: ActiveWindowFn; openWindows: OpenWindowsFn }
  activeWindow = mod.activeWindow
  openWindowsFn = mod.openWindows
  return activeWindow
}

async function getOpenWindowsFn(): Promise<OpenWindowsFn> {
  if (openWindowsFn) return openWindowsFn
  await getActiveWindowFn() // primes both caches
  return openWindowsFn!
}

import { TITLE_TO_VARIANT, type GameVariant } from '../../shared/game-variant'

/** Returns true when the window title text matches either PoE1 or PoE2. */
export function isPoeWindowTitle(title: string): boolean {
  return title in TITLE_TO_VARIANT
}

/** Map a known PoE window title to its variant; null otherwise. */
export function titleToVariant(title: string): GameVariant | null {
  return TITLE_TO_VARIANT[title] ?? null
}

/** Returns the PoE version of whichever window currently has OS foreground focus,
 *  or null if it's not a PoE window (or the OS lookup failed). Called on hotkey
 *  fire to decide whether we need to swap which game the overlay is attached to. */
export async function detectFocusedPoeVersion(): Promise<GameVariant | null> {
  try {
    const fn = await getActiveWindowFn()
    const win = await fn()
    const title = win?.title
    return title ? titleToVariant(title) : null
  } catch {
    return null
  }
}

/** All currently open PoE windows (both PoE1 and PoE2), sorted front-to-back
 *  by z-order. Used by the auto-switch watcher to confirm a game is open before
 *  attempting a retarget. */
export async function detectOpenPoeWindows(): Promise<Array<{ title: string; variant: GameVariant }>> {
  try {
    const fn = await getOpenWindowsFn()
    const windows = await fn()
    return windows
      .filter((w) => isPoeWindowTitle(w.title))
      .map((w) => ({ title: w.title, variant: TITLE_TO_VARIANT[w.title]! }))
  } catch {
    return []
  }
}
