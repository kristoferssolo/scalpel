/** Process-wide "which PoE game are we attached to" flag. Lives in its own file
 *  (not overlay.ts) so that modules like trade/prices can read it without pulling
 *  electron-overlay-window / uiohook-napi into their import graphs -- those native
 *  modules would otherwise fail to load in Vitest. Updated in-process by
 *  retargetForGame when switching games; no longer requires an app relaunch.
 *
 *  Exposed via a getter (instead of a `let`-export) so consumers can never
 *  cache the value at import time -- every read goes through the function and
 *  reflects the current state, not whatever was set when the module loaded. */
import type { GameVariant } from '../shared/game-variant'

let _poeVersion: GameVariant = 1

export function getPoeVersion(): GameVariant {
  return _poeVersion
}

export function setPoeVersion(v: GameVariant): void {
  _poeVersion = v
}
