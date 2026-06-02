import type { WebContents } from 'electron'
import type Store from 'electron-store'
import type { AppSettings, RuntimeSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'
import { applyCheatSheetHotkeys } from '../cheat-sheets/index'
import { clearFilterState, loadFilter } from '../filter/state'
import { invalidateBaseToClass } from '../handlers/base-to-class-cache'
import { updateOnlineSyncDir } from '../online-sync/index'
import { retargetForGame } from '../overlay/index'
import { applyPinnedZoneEnabled } from '../pinned-zone/index'
import {
  getActiveProfile,
  getEffectiveSettings,
  switchActiveProfileByGameVariant,
  type ProfileChangedSetting,
} from '../profiles/profile-settings'
import { broadcastSettingUpdates } from '../settings/broadcast'
import { refreshLeagues } from '../trade/leagues'
import { refreshPrices } from '../trade/prices'
import { invalidateStatsCache } from '../trade/stat-matcher/stats-cache'

export interface GameSwitchResult {
  changes: ProfileChangedSetting[]
  previous: RuntimeSettings
  current: RuntimeSettings
}

/** Single coordinator for every game-switch path. Updates the persistent
 *  settings / active profile synchronously, retargets the overlay, invalidates
 *  trade caches, then fires background network / disk work. */
export function switchGameContext(store: Store<AppSettings>, target: GameVariant): GameSwitchResult {
  const previous = getEffectiveSettings(store)

  const changes = switchActiveProfileByGameVariant(store, target)

  const profile = getActiveProfile(store)
  if (profile) {
    if (profile.filterPath) loadFilter(profile.filterPath, 'Profile Activation')
    else clearFilterState()
    if (profile.league) void refreshPrices(profile.league)
    updateOnlineSyncDir(profile.filterDir)
    if (profile.cheatSheets) applyCheatSheetHotkeys(profile.cheatSheets)
    applyPinnedZoneEnabled(profile.cheatSheets?.pinned === true)
  } else {
    clearFilterState()
    updateOnlineSyncDir('')
    applyPinnedZoneEnabled(false)
  }

  retargetForGame(target)

  invalidateStatsCache()
  invalidateBaseToClass()

  const lastFetched = (store.get('leaguesFetchedAt' as keyof AppSettings) as number) ?? 0
  if (Date.now() - lastFetched > 60 * 60 * 1000) {
    void refreshLeagues(store)
  }

  const current = getEffectiveSettings(store)
  return { changes, previous, current }
}

/** Switch game context and broadcast setting/profile changes to all renderers.
 *  Use this instead of raw `switchGameContext` whenever settings changes must be
 *  visible in the UI (tray switch, hotkey auto-detect, startup attach, watcher). */
export function performGameSwitch(
  store: Store<AppSettings>,
  target: GameVariant,
  sender?: WebContents | null,
): GameSwitchResult {
  const result = switchGameContext(store, target)
  broadcastSettingUpdates(sender ?? null, result.changes, result.previous, result.current)
  return result
}
