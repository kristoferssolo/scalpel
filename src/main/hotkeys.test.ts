import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MainPanelMode } from '../shared/types'

interface KeyEvent {
  keycode: number
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

const mode = vi.hoisted<{ value: MainPanelMode }>(() => ({ value: 'standalone' }))
const typingInOverlay = vi.hoisted<{ value: boolean }>(() => ({ value: false }))
const keydownListeners = vi.hoisted<Array<(event: KeyEvent) => void>>(() => [])
const registerShortcut = vi.hoisted(() => vi.fn(() => true))
const unregisterShortcut = vi.hoisted(() => vi.fn())
const unregisterAllShortcuts = vi.hoisted(() => vi.fn())
const clipboardWriteText = vi.hoisted(() => vi.fn())
const uiohookStart = vi.hoisted(() => vi.fn())
const uiohookStop = vi.hoisted(() => vi.fn())
const uiohookKeyTap = vi.hoisted(() => vi.fn())
const uiohookKeyToggle = vi.hoisted(() => vi.fn())
const uiohookOn = vi.hoisted(() =>
  vi.fn((event: string, listener: (event: KeyEvent) => void) => {
    if (event === 'keydown') keydownListeners.push(listener)
  }),
)
const key = vi.hoisted<Record<string, number>>(() => {
  const letters = Object.fromEntries(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, index) => [letter, 100 + index]),
  )
  return {
    ...letters,
    F1: 201,
    F2: 202,
    F3: 203,
    F4: 204,
    F5: 205,
    F6: 206,
    F7: 207,
    F8: 208,
    F9: 209,
    F10: 210,
    F11: 211,
    F12: 212,
    Space: 213,
    Tab: 214,
    Escape: 215,
    Delete: 216,
    Home: 217,
    End: 218,
    PageUp: 219,
    PageDown: 220,
    Ctrl: 221,
    CtrlRight: 222,
    Shift: 223,
    ShiftRight: 224,
    Alt: 225,
    AltRight: 226,
    ArrowRight: 227,
    ArrowLeft: 228,
    Enter: 229,
    V: 121,
    A: 100,
    C: 102,
    '0': 230,
    '1': 231,
    '2': 232,
    '3': 233,
    '4': 234,
    '5': 235,
    '6': 236,
    '7': 237,
    '8': 238,
    '9': 239,
  }
})

vi.mock('electron', () => ({
  clipboard: {
    writeText: clipboardWriteText,
  },
  globalShortcut: {
    register: registerShortcut,
    unregister: unregisterShortcut,
    unregisterAll: unregisterAllShortcuts,
  },
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('electron-overlay-window', () => ({
  OverlayController: {
    targetBounds: null,
    targetHasFocus: false,
  },
}))

vi.mock('uiohook-napi', () => ({
  UiohookKey: key,
  uIOhook: {
    on: uiohookOn,
    start: uiohookStart,
    stop: uiohookStop,
    keyTap: uiohookKeyTap,
    keyToggle: uiohookKeyToggle,
  },
}))

vi.mock('./clipboard-preserve', () => ({
  snapshotClipboard: () => vi.fn(),
}))

vi.mock('./diagnostics', () => ({
  guardNativeListener: (_name: string, listener: unknown) => listener,
  recordMainBreadcrumb: vi.fn(),
  recordMainDiagnostic: vi.fn(),
  registerDiagnosticProvider: vi.fn(),
}))

vi.mock('./game-state', () => ({
  getPoeVersion: () => 1,
}))

vi.mock('./overlay', () => ({
  focusGameWindow: vi.fn(),
  getMainPanelMode: () => mode.value,
  getOverlayWindow: () => null,
  isTypingInOverlay: () => typingInOverlay.value,
}))

vi.mock('./windowing', () => ({
  hideFocusedOrAnyVisibleSecondaryOverlay: () => false,
}))

function emitKeydown(event: KeyEvent): void {
  for (const listener of keydownListeners) listener(event)
}

async function loadHotkeys(): Promise<typeof import('./hotkeys')> {
  vi.resetModules()
  keydownListeners.length = 0
  return import('./hotkeys')
}

describe('passive standalone Linux hotkeys', () => {
  beforeEach(() => {
    mode.value = 'standalone'
    typingInOverlay.value = false
    keydownListeners.length = 0
    registerShortcut.mockClear()
    unregisterShortcut.mockClear()
    unregisterAllShortcuts.mockClear()
    clipboardWriteText.mockClear()
    uiohookStart.mockClear()
    uiohookStop.mockClear()
    uiohookKeyTap.mockClear()
    uiohookKeyToggle.mockClear()
    uiohookOn.mockClear()
  })

  it('skips globalShortcut registration in standalone mode', async () => {
    const hotkeys = await loadHotkeys()

    hotkeys.setHotkey('F5')
    hotkeys.setPriceCheckHotkey('F6')
    hotkeys.setChatCommands([{ hotkey: 'CommandOrControl+H', command: '/hideout' }])
    hotkeys.setAppMacros([{ hotkey: 'CommandOrControl+M', action: 'openSettings' }])

    expect(registerShortcut).not.toHaveBeenCalled()
  })

  it('stores standalone hotkey combos for uiohook dispatch', async () => {
    const hotkeys = await loadHotkeys()
    const onTrigger = vi.fn()

    hotkeys.startHotkeyListener(onTrigger)
    hotkeys.setHotkey('F5')
    emitKeydown({ keycode: key.F5, ctrlKey: false, shiftKey: false, altKey: false })

    expect(onTrigger).toHaveBeenCalledOnce()
    expect(registerShortcut).not.toHaveBeenCalled()
  })

  it('dispatches main, price-check, chat, and app macro hotkeys via uiohook', async () => {
    vi.useFakeTimers()
    const hotkeys = await loadHotkeys()
    const onTrigger = vi.fn()
    const onPriceCheck = vi.fn()
    const onAppMacro = vi.fn()

    hotkeys.startHotkeyListener(onTrigger)
    hotkeys.setPriceCheckHandler(onPriceCheck)
    hotkeys.setAppMacroHandler(onAppMacro)
    hotkeys.setHotkey('F5')
    hotkeys.setPriceCheckHotkey('F6')
    hotkeys.setChatCommands([{ hotkey: 'CommandOrControl+H', command: '/hideout' }])
    hotkeys.setAppMacros([{ hotkey: 'CommandOrControl+M', action: 'openSettings', tag: 'setup' }])

    emitKeydown({ keycode: key.F5, ctrlKey: false, shiftKey: false, altKey: false })
    emitKeydown({ keycode: key.F6, ctrlKey: false, shiftKey: false, altKey: false })
    emitKeydown({ keycode: key.H, ctrlKey: true, shiftKey: false, altKey: false })
    await vi.advanceTimersByTimeAsync(60)
    emitKeydown({ keycode: key.M, ctrlKey: true, shiftKey: false, altKey: false })

    expect(onTrigger).toHaveBeenCalledOnce()
    expect(onPriceCheck).toHaveBeenCalledOnce()
    expect(clipboardWriteText).toHaveBeenCalledWith('/hideout')
    expect(onAppMacro).toHaveBeenCalledWith('openSettings', 'setup', undefined)
    expect(registerShortcut).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('blocks passive chat and app macro dispatch while typing in the overlay', async () => {
    const hotkeys = await loadHotkeys()
    const onAppMacro = vi.fn()

    hotkeys.startHotkeyListener(vi.fn())
    hotkeys.setAppMacroHandler(onAppMacro)
    hotkeys.setChatCommands([{ hotkey: 'CommandOrControl+H', command: '/hideout' }])
    hotkeys.setAppMacros([{ hotkey: 'CommandOrControl+M', action: 'openSettings' }])

    typingInOverlay.value = true
    emitKeydown({ keycode: key.H, ctrlKey: true, shiftKey: false, altKey: false })
    emitKeydown({ keycode: key.M, ctrlKey: true, shiftKey: false, altKey: false })

    expect(clipboardWriteText).not.toHaveBeenCalled()
    expect(onAppMacro).not.toHaveBeenCalled()
  })
})
