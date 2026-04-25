import { ipcMain } from 'electron'
import Store from 'electron-store'
import { loadFilter, getColorFrequencies } from '../filter-state'
import { getOverlayWindow, setCloseOnClickOutside } from '../overlay'
import { getAppWindow } from '../app-window'
import { setHotkey, setPriceCheckHotkey, setChatCommands, setAppMacros, setStashScrollEnabled } from '../hotkeys'
import { setOpenSide } from '../evaluation'
import { refreshPrices } from '../trade/prices'
import type { AppSettings, RegexPreset } from '../../shared/types'

export function register(store: Store<AppSettings>): void {
  ipcMain.handle('get-settings', () => store.store)

  ipcMain.handle('get-color-frequencies', () => getColorFrequencies())

  ipcMain.handle('refresh-prices', async () => {
    await refreshPrices(store.get('league'))
  })

  // Map flat active keys -> their per-version mirror key, filled at write time so
  // settings UI edits persist to the right PoE1/PoE2 namespace. Consumers keep
  // reading the flat fields; boot sync in main/index.ts handles the reverse.
  const MIRROR_KEYS = {
    league: ['leaguePoe1', 'leaguePoe2'],
    filterPath: ['filterPathPoe1', 'filterPathPoe2'],
    filterDir: ['filterDirPoe1', 'filterDirPoe2'],
    tradePriceOption: ['tradePriceOptionPoe1', 'tradePriceOptionPoe2'],
  } as const satisfies Partial<Record<keyof AppSettings, readonly [keyof AppSettings, keyof AppSettings]>>

  ipcMain.handle('set-setting', (event, key: keyof AppSettings, value: AppSettings[typeof key]) => {
    // poeVersion is intentionally not writable through this path. The boot sync
    // in main/index.ts seeds the flat league/filterPath/filterDir/tradePriceOption
    // fields from whichever per-version mirror matches `poeVersion` -- flipping
    // it here without also relaunching would leave the flat fields pointing at
    // the wrong game's data. requestGameSwitch() in main/game-switch.ts owns
    // the toggle and triggers a relaunch after writing.
    if (key === 'poeVersion') {
      console.warn('[settings] ignoring set-setting(poeVersion) -- use requestGameSwitch')
      return
    }
    const prev = store.get(key)
    store.set(key, value)
    const mirror = MIRROR_KEYS[key as keyof typeof MIRROR_KEYS]
    if (mirror) {
      const v = store.get('poeVersion')
      store.set(mirror[v === 2 ? 1 : 0], value as string)
    }
    if (key === 'filterPath' && value !== prev) loadFilter(value as string, 'Switched Filters')
    if (key === 'hotkey') setHotkey(value as string)
    if (key === 'priceCheckHotkey') setPriceCheckHotkey(value as string)
    if (key === 'closeOnClickOutside') setCloseOnClickOutside(value as boolean)
    if (key === 'league') refreshPrices(value as string)
    if (key === 'chatCommands') setChatCommands(value as Array<{ hotkey: string; command: string }>)
    if (key === 'appMacros') setAppMacros(value as Array<{ action: string; hotkey: string; tag?: string }>)
    if (key === 'stashScrollEnabled') setStashScrollEnabled(value as boolean)
    if (key === 'openSide') setOpenSide(value as AppSettings['openSide'])

    // Broadcast setting change to all windows except the sender
    const sender = event.sender
    for (const win of [getOverlayWindow(), getAppWindow()]) {
      if (win && win.webContents !== sender) {
        win.webContents.send('setting-updated', key, value)
      }
    }
  })

  ipcMain.handle('get-regex-presets', () => {
    return (store.get('regexPresets') as RegexPreset[] | undefined) ?? []
  })

  ipcMain.handle('save-regex-preset', (_event, preset: RegexPreset) => {
    const presets = (store.get('regexPresets') as RegexPreset[] | undefined) ?? []
    const existingIdx = presets.findIndex((p) => p.id === preset.id)
    if (existingIdx >= 0) {
      presets[existingIdx] = preset
    } else {
      presets.push(preset)
    }
    store.set('regexPresets', presets)
    return presets
  })

  ipcMain.handle('delete-regex-preset', (_event, id: string) => {
    const presets = (store.get('regexPresets') as RegexPreset[] | undefined) ?? []
    const filtered = presets.filter((p) => p.id !== id)
    store.set('regexPresets', filtered)
    return filtered
  })

  ipcMain.handle('reorder-regex-presets', (_event, ids: string[]) => {
    const presets = (store.get('regexPresets') as RegexPreset[] | undefined) ?? []
    const byId = new Map(presets.map((p) => [p.id, p]))
    const reordered = ids.map((id) => byId.get(id)).filter(Boolean) as RegexPreset[]
    store.set('regexPresets', reordered)
    return reordered
  })
}
