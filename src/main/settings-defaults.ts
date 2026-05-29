import type Store from 'electron-store'
import type { AppSettings } from '../shared/types'
import { ACTIVE_PROFILE_ID_KEY, LAST_PROFILE_ID_POE1_KEY, LAST_PROFILE_ID_POE2_KEY } from './profiles/profile-settings'

export const DEFAULT_APP_SETTINGS = {
  hotkey: 'CommandOrControl+Shift+D',
  priceCheckHotkey: 'CommandOrControl+Shift+A',
  overlayOpacity: 0.95,
  overlayScale: 1,
  mainPanelMode: 'overlay',
  openSide: 'both',
  closeOnClickOutside: false,
  useCurrentZoneAreaLevel: false,
  reloadOnSave: true,
  updateChannel: 'stable',
  tradeStatus: 'available',
  tradeCollapseListings: true,
  previewVolume: 0.25,
  priceCheckDefaultPercent: 90,
  adaptiveDefaultsMode: 'eager',
  tradeDefaultToBase: false,
  chatCommands: [],
  appMacros: [],
  stashScrollEnabled: false,
  stashScrollModifier: 'Ctrl',
  poeVersion: 1,
  regexPresetsPoe1: [],
  regexPresetsPoe2: [],
  leaguesPoe1: [],
  leaguesPoe2: [],
  developerMode: false,
  themeId: 'default',
  customThemePalette: null,
  pluginRegistryUrl: undefined,
  startInTray: true,
  appWindowPosition: undefined,
  [ACTIVE_PROFILE_ID_KEY]: '',
  [LAST_PROFILE_ID_POE1_KEY]: '',
  [LAST_PROFILE_ID_POE2_KEY]: '',
  onboardingCompleted: false,
  currencyLabelsAsText: false,
} satisfies AppSettings

export function backfillAppSettings(store: Store<AppSettings>): void {
  if (store.get('reloadOnSave') === undefined) store.set('reloadOnSave', true)
  if (store.get('useCurrentZoneAreaLevel') === undefined) store.set('useCurrentZoneAreaLevel', false)
  if (store.get('stashScrollEnabled') === undefined) store.set('stashScrollEnabled', false)
  if (store.get('stashScrollModifier') === undefined) store.set('stashScrollModifier', 'Ctrl')
  if (store.get('openSide') === undefined) store.set('openSide', 'both')
  if (store.get('mainPanelMode') === undefined) store.set('mainPanelMode', 'overlay')
  if ((store.get('tradeStatus') as string) === 'any') store.set('tradeStatus', 'available')
  if (store.get('themeId') === undefined) store.set('themeId', 'default')
  if (store.get('customThemePalette') === undefined) store.set('customThemePalette', null)
  if (store.get('adaptiveDefaultsMode') === undefined) store.set('adaptiveDefaultsMode', 'eager')
  if (store.get('startInTray') === undefined) store.set('startInTray', true)
  if (store.get('currencyLabelsAsText') === undefined) store.set('currencyLabelsAsText', false)
}
