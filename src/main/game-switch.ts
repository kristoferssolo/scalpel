import type Store from 'electron-store'
import type { AppSettings } from '../shared/types'
import type { GameVariant } from '../shared/game-variant'
import { applySetting } from './settings-write'
import { retargetForGame } from './overlay'

/** Switch the overlay to a different PoE version in-process — no restart, no modal.
 *  Applies the setting persistently and tells the native tracker to look for the
 *  new game title. */
export function requestGameSwitch(store: Store<AppSettings>, target: GameVariant): void {
  applySetting(store, 'poeVersion', target, null)
  retargetForGame(target)
}
