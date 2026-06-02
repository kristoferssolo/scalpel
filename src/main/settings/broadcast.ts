import type { WebContents } from 'electron'
import type { PoeProfile, RuntimeSettings } from '../../shared/types'
import { getAppWindow } from '../app-window'
import { getCheatSheetsOverlay } from '../cheat-sheets/index'
import { getOverlayWindow } from '../overlay/index'
import { getPinnedZoneOverlay } from '../pinned-zone/index'
import type { ProfileChangedSetting, SettingChangeKey } from '../profiles/profile-settings'

export function broadcastSettingUpdate(sender: WebContents | null, key: SettingChangeKey, value: unknown): void {
  const csWin = getCheatSheetsOverlay()?.getWindow() ?? null
  const pinnedWin = getPinnedZoneOverlay()?.getWindow() ?? null
  for (const win of [getOverlayWindow(), getAppWindow(), csWin, pinnedWin]) {
    if (win && win.webContents !== sender) {
      win.webContents.send('setting-updated', key, value)
    }
  }
  void import('../whiteboard/index')
    .then(({ getWhiteboardOverlay }) => {
      const wbWin = getWhiteboardOverlay()?.getWindow() ?? null
      if (wbWin && wbWin.webContents !== sender) {
        wbWin.webContents.send('setting-updated', key, value)
      }
    })
    .catch(() => {})
}

export function broadcastSettingUpdates(
  sender: WebContents | null,
  changes: ProfileChangedSetting[],
  previous?: RuntimeSettings,
  current?: RuntimeSettings,
): void {
  for (const change of changes) {
    broadcastSettingUpdate(sender, change.key, change.value)
  }

  if (changes.some((change) => change.key === 'activeProfile')) {
    const previousLeague = previous?.activeProfile?.league ?? ''
    const changedProfile = changes.find((change) => change.key === 'activeProfile')?.value as
      | PoeProfile
      | null
      | undefined
    const currentLeague = current?.activeProfile?.league ?? changedProfile?.league ?? ''
    if (!previous || previousLeague !== currentLeague) broadcastLeagueUpdate(sender, currentLeague)
  }
}

export function broadcastLeagueUpdate(sender: WebContents | null, league: string): void {
  const csWin = getCheatSheetsOverlay()?.getWindow() ?? null
  const pinnedWin = getPinnedZoneOverlay()?.getWindow() ?? null
  for (const win of [getOverlayWindow(), getAppWindow(), csWin, pinnedWin]) {
    if (win && win.webContents !== sender) {
      win.webContents.send('league-updated', league)
    }
  }
  void import('../whiteboard/index')
    .then(({ getWhiteboardOverlay }) => {
      const wbWin = getWhiteboardOverlay()?.getWindow() ?? null
      if (wbWin && wbWin.webContents !== sender) {
        wbWin.webContents.send('league-updated', league)
      }
    })
    .catch(() => {})
}
