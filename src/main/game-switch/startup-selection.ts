import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'
import { detectFocusedPoeVersion, detectOpenPoeWindows } from './detector'

function configPath(variant: GameVariant, documentsDir: string): string {
  return variant === 2
    ? join(documentsDir, 'My Games', 'Path of Exile 2', 'poe2_production_Config.ini')
    : join(documentsDir, 'My Games', 'Path of Exile', 'production_Config.ini')
}

/** True when the user's Documents folder contains a config file for exactly this
 *  variant, indicating they've launched/configured this game before. */
export function hasConfigFor(variant: GameVariant, documentsDir: string): boolean {
  try {
    return existsSync(configPath(variant, documentsDir))
  } catch {
    return false
  }
}

interface SelectionOptions {
  /** Whether this is the first time the app has been set up. Only when true will
   *  the installed/config fallback override a persisted version with no game
   *  running. */
  isFirstRun: boolean
}

/**
 * Pick the best PoE game variant to attach to at startup.
 *
 * Priority:
 * 1. Focused PoE window (the game the user is actively playing right now).
 * 2. Only open PoE variant (one game is running, the other isn't).
 * 3. Installed/config evidence on first run (user has only ever launched one game).
 * 4. Persisted setting (keep what the user last chose).
 */
export async function chooseStartupGameVariant(
  store: Store<AppSettings>,
  opts: SelectionOptions,
): Promise<GameVariant> {
  const persisted = store.get('poeVersion') === 2 ? 2 : 1

  const focused = await detectFocusedPoeVersion()
  if (focused !== null) return focused

  const open = await detectOpenPoeWindows()
  const openVariants = new Set(open.map((w) => w.variant))
  if (openVariants.size === 1) return open[0]!.variant
  if (openVariants.size === 2) return persisted

  if (opts.isFirstRun) {
    const docs = app.getPath('documents')
    const has1 = hasConfigFor(1, docs)
    const has2 = hasConfigFor(2, docs)
    if (has1 && !has2) return 1
    if (has2 && !has1) return 2
  }

  return persisted
}

let __cached: GameVariant | null = null

/** Resolve once at startup and cache the result. Repeated calls return the
 *  cached value so subsequent checks in the same process can't drift. */
export async function onceStartupGameVariant(store: Store<AppSettings>, opts: SelectionOptions): Promise<GameVariant> {
  if (__cached !== null) return __cached
  __cached = await chooseStartupGameVariant(store, opts)
  return __cached
}

/** Reset the cached startup variant. Only exposed for test isolation. */
export function _resetStartupSelectionForTesting(): void {
  __cached = null
}
