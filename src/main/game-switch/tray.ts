import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'
import { performGameSwitch } from './context'

/** Switch the overlay to a different PoE version in-process — no restart, no modal.
 *  Applies the setting persistently and tells the native tracker to look for the
 *  new game title. Broadcasts setting/profile changes to all renderers. */
export function requestGameSwitch(store: Store<AppSettings>, target: GameVariant): void {
  performGameSwitch(store, target)
}
