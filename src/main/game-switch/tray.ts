import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'
import { switchGameContext } from './context'
import { broadcastSettingUpdates } from '../settings/broadcast'

/** Switch the overlay to a different PoE version in-process — no restart, no modal.
 *  Applies the setting persistently and tells the native tracker to look for the
 *  new game title. */
export function requestGameSwitch(store: Store<AppSettings>, target: GameVariant): void {
  const result = switchGameContext(store, target)
  broadcastSettingUpdates(null, result.changes, result.previous, result.current)
}
