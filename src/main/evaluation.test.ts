import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Store from 'electron-store'
import type { AppSettings, GameVariant, MainPanelMode } from '../shared/types'

const mode = vi.hoisted<{ value: MainPanelMode }>(() => ({ value: 'standalone' }))
const focusedVersion = vi.hoisted<{ value: GameVariant | null }>(() => ({ value: null }))
const currentVersion = vi.hoisted<{ value: GameVariant }>(() => ({ value: 1 }))
const passiveHotkeys = vi.hoisted<{ value: boolean }>(() => ({ value: false }))
const requestGameSwitch = vi.hoisted(() => vi.fn<(store: Store<AppSettings>, version: GameVariant) => Promise<void>>())

vi.mock('electron', () => ({
  clipboard: { clear: vi.fn() },
  screen: { getCursorScreenPoint: () => ({ x: 0 }), getPrimaryDisplay: () => ({ workAreaSize: { width: 1920 } }) },
}))

vi.mock('electron-overlay-window', () => ({
  OverlayController: { targetHasFocus: false },
}))

vi.mock('./overlay', () => ({
  focusGameWindow: vi.fn(),
  getMainPanelMode: () => mode.value,
  getOverlayWindow: () => null,
  isTypingInOverlay: () => false,
  showOverlay: vi.fn(),
}))

vi.mock('./game-detector', () => ({
  detectFocusedPoeVersion: () => Promise.resolve(focusedVersion.value),
}))

vi.mock('./game-state', () => ({
  getPoeVersion: () => currentVersion.value,
}))

vi.mock('./game-switch', () => ({
  requestGameSwitch,
}))

vi.mock('./hotkeys', () => ({
  recordHotkeyFocusDetectionResult: vi.fn(),
  sendCtrlCToPoE: vi.fn(),
  shouldUsePassiveHotkeys: () => passiveHotkeys.value,
}))

vi.mock('./client-log', () => ({
  getCurrentZone: () => null,
}))

vi.mock('./filter-state', () => ({
  getCurrentFilter: () => null,
}))

vi.mock('./profiles/profile-settings', () => ({
  getProfileBackedSetting: () => '',
}))

vi.mock('./trade/clipboard', () => ({
  readItemFromClipboard: () => null,
}))

vi.mock('./trade/prices', () => ({
  getUniquesByBase: () => ({}),
  lookupBestUniquePrice: () => null,
  lookupPrice: () => null,
  lookupPriceForItem: () => null,
  lookupUniquePriceForBase: () => null,
  refreshPrices: () => Promise.resolve(),
}))

vi.mock('./trade/trade', () => ({
  ensureStatsLoaded: () => Promise.resolve(),
  matchItemMods: () => [],
}))

vi.mock('./learning', () => ({
  beginSession: () => 1,
  decisionsForSession: () => ({}),
}))

vi.mock('./filter/matcher', () => ({
  evaluateBlock: () => ({ evaluatedConditions: [], hasUnknowns: false, matches: false }),
  findMatchingBlocks: () => [],
  findQualityBreakpoints: () => undefined,
  findStackSizeBreakpoints: () => undefined,
  findStrandBreakpoints: () => undefined,
}))

import { ensureCorrectGameForHotkey } from './evaluation'

const store = {} as Store<AppSettings>

describe('ensureCorrectGameForHotkey', () => {
  beforeEach(() => {
    mode.value = 'standalone'
    focusedVersion.value = null
    currentVersion.value = 1
    passiveHotkeys.value = false
    requestGameSwitch.mockReset()
    requestGameSwitch.mockResolvedValue()
  })

  it('accepts the focused current PoE in standalone mode', async () => {
    focusedVersion.value = 1

    await expect(ensureCorrectGameForHotkey(store)).resolves.toBe(true)
    expect(requestGameSwitch).not.toHaveBeenCalled()
  })

  it('rejects non-PoE focus in standalone mode', async () => {
    focusedVersion.value = null

    await expect(ensureCorrectGameForHotkey(store)).resolves.toBe(false)
    expect(requestGameSwitch).not.toHaveBeenCalled()
  })

  it('allows unknown focus in passive standalone mode', async () => {
    focusedVersion.value = null
    passiveHotkeys.value = true

    await expect(ensureCorrectGameForHotkey(store)).resolves.toBe(true)
    expect(requestGameSwitch).not.toHaveBeenCalled()
  })

  it('requests a game switch for the other focused PoE version in standalone mode', async () => {
    focusedVersion.value = 2

    await expect(ensureCorrectGameForHotkey(store)).resolves.toBe(false)
    expect(requestGameSwitch).toHaveBeenCalledWith(store, 2)
  })
})
