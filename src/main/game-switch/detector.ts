// active-win is ESM-only; dynamic import lets us consume it from our CJS main.
// The module and its native binding load once, then we reuse the cached fn.
type ActiveWindowFn = () => Promise<{ title?: string } | undefined>
let activeWindow: ActiveWindowFn | null = null

async function getActiveWindow(): Promise<ActiveWindowFn> {
  if (activeWindow) return activeWindow
  const mod = (await import('active-win')) as { activeWindow: ActiveWindowFn }
  activeWindow = mod.activeWindow
  return activeWindow
}

import { TITLE_TO_VARIANT, type GameVariant } from '../../shared/game-variant'

/** Returns the PoE version of whichever window currently has OS foreground focus,
 *  or null if it's not a PoE window (or the OS lookup failed). Called on hotkey
 *  fire to decide whether we need to swap which game the overlay is attached to. */
export async function detectFocusedPoeVersion(): Promise<GameVariant | null> {
  try {
    const fn = await getActiveWindow()
    const win = await fn()
    const title = win?.title
    return title ? (TITLE_TO_VARIANT[title] ?? null) : null
  } catch {
    return null
  }
}
