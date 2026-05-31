import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcHandlers = vi.hoisted(() => new Map<string, () => unknown>())
const browserWindowInstances = vi.hoisted(() => new Set<MockBrowserWindow>())
const showInactive = vi.hoisted(() => vi.fn())
const hide = vi.hoisted(() => vi.fn())
const restore = vi.hoisted(() => vi.fn())
const loadFile = vi.hoisted(() => vi.fn())
const loadURL = vi.hoisted(() => vi.fn())
const webContentsSend = vi.hoisted(() => vi.fn())
const webContentsOn = vi.hoisted(() => vi.fn())

interface MockBrowserWindow {
  webContents: {
    send: typeof webContentsSend
    on: typeof webContentsOn
  }
  isDestroyed: () => boolean
  isMinimized: () => boolean
  restore: typeof restore
  showInactive: typeof showInactive
  hide: typeof hide
  loadFile: typeof loadFile
  loadURL: typeof loadURL
  on: (event: string, listener: () => void) => void
}

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow implements MockBrowserWindow {
    static fromWebContents(): null {
      return null
    }

    webContents = {
      send: webContentsSend,
      on: webContentsOn,
    }

    constructor() {
      browserWindowInstances.add(this)
    }

    isDestroyed(): boolean {
      return false
    }

    isMinimized(): boolean {
      return false
    }

    restore = restore
    showInactive = showInactive
    hide = hide
    loadFile = loadFile
    loadURL = loadURL

    on(): void {}
  },
  ipcMain: {
    on: vi.fn(),
    handle: (channel: string, handler: () => unknown) => {
      ipcHandlers.set(channel, handler)
    },
  },
  screen: {
    getPrimaryDisplay: () => ({ scaleFactor: 1 }),
    getDisplayNearestPoint: () => ({ scaleFactor: 1 }),
  },
  webContents: {
    fromId: () => null,
  },
}))

vi.mock('electron-overlay-window', () => ({
  OVERLAY_WINDOW_OPTS: {},
  OverlayController: {
    targetBounds: null,
    targetHasFocus: false,
    activateOverlay: vi.fn(),
    focusTarget: vi.fn(),
    attachByTitle: vi.fn(),
    events: { on: vi.fn() },
  },
}))

vi.mock('uiohook-napi', () => ({
  uIOhook: { on: vi.fn() },
}))

vi.mock('./client-log', () => ({
  startClientLogWatcher: vi.fn(),
}))

vi.mock('./diagnostics', () => ({
  guardNativeListener: (_name: string, listener: unknown) => listener,
  registerDiagnosticProvider: vi.fn(),
}))

vi.mock('./game-state', () => ({
  getPoeVersion: () => 1,
  setPoeVersion: vi.fn(),
}))

vi.mock('./windowing', () => ({
  closeAllOverlaysOnPoeExit: vi.fn(),
  isAnyScalpelWindowFocused: () => false,
  isInsideAnySecondaryOverlay: () => false,
}))

describe('overlay state IPC', () => {
  beforeEach(() => {
    ipcHandlers.clear()
    browserWindowInstances.clear()
    showInactive.mockClear()
    hide.mockClear()
    restore.mockClear()
    loadFile.mockClear()
    loadURL.mockClear()
    webContentsSend.mockClear()
    webContentsOn.mockClear()
    vi.resetModules()
  })

  it('includes mainPanelMode', async () => {
    await import('./overlay')
    const handler = ipcHandlers.get('get-overlay-state')

    expect(handler?.()).toMatchObject({ mainPanelMode: 'overlay' })
  })

  it('creates and shows a standalone window without using OverlayController', async () => {
    const { OverlayController } = await import('electron-overlay-window')
    const { createStandaloneOverlayWindow, getMainPanelMode, showOverlay } = await import('./overlay')

    createStandaloneOverlayWindow()
    showOverlay()

    expect(browserWindowInstances.size).toBe(1)
    expect(getMainPanelMode()).toBe('standalone')
    expect(showInactive).toHaveBeenCalledOnce()
    expect(webContentsSend).toHaveBeenCalledWith('poe-version', 1)
    expect(OverlayController.attachByTitle).not.toHaveBeenCalled()
    expect(OverlayController.focusTarget).not.toHaveBeenCalled()
  })
})
