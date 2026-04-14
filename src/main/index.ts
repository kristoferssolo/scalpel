import { app, type BrowserWindow, ipcMain, Menu, screen, Tray } from 'electron'

// Prevent unhandled JS exceptions from crashing the native overlay thread
// electron-overlay-window's tsfn_to_js_proxy calls napi_fatal_error if napi_call_function
// returns non-ok, which happens when there's a pending exception on the JS isolate
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err)
})

import { execSync } from 'child_process'
import Store from 'electron-store'
import type { AppSettings } from '../shared/types'
import { createAppWindow, getAppWindow, showAppWindow } from './app-window'
import { createHotkeyHandler, createPriceCheckHandler } from './evaluation'
import { loadFilter } from './filter-state'
import * as editingHandlers from './handlers/editing'
import * as filesHandlers from './handlers/files'
import * as onlineSyncHandlers from './handlers/online-sync'
import * as pricesHandlers from './handlers/prices'
import * as settingsHandlers from './handlers/settings'
import * as tradeHandlers from './handlers/trade'
import * as versionsHandlers from './handlers/versions'
import {
  resumeHotkeys,
  setAppMacroHandler,
  setAppMacros,
  setChatCommands,
  setEscapeHandler,
  setHotkey,
  setPriceCheckHandler,
  setPriceCheckHotkey,
  setStashScrollEnabled,
  startHotkeyListener,
  stopHotkeyListener,
  suspendHotkeys,
} from './hotkeys'
import { startOnlineSync, stopOnlineSync } from './online-sync'
import {
  createOverlayWindow,
  getOverlayWindow,
  hideOverlay,
  setCloseOnClickOutside,
  setGameFocusHandlers,
  setOverlayScale,
  showOverlay,
} from './overlay'
import { getAppIcon } from './platform'
import { refreshPrices } from './trade/prices'
import { onRateLimitUpdate } from './trade/trade'
import { applyPendingUpdate } from './update/update-swap'
import { initUpdater } from './update/updater'

// ---- Elevation detection ---------------------------------------------------

function isElevated(): boolean {
  if (process.platform !== 'win32') return false
  try {
    execSync('net session', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isWaylandSession(): boolean {
  return process.platform === 'linux' && process.env['XDG_SESSION_TYPE'] === 'wayland'
}

function isOverlaySupported(): boolean {
  return !isWaylandSession() || process.env['ELECTRON_OZONE_PLATFORM_HINT'] === 'x11'
}

// ---- Persistent settings ---------------------------------------------------

const store = new Store<AppSettings>({
  defaults: {
    filterPath: '',
    filterDir: '',
    hotkey: 'CommandOrControl+Shift+D',
    priceCheckHotkey: 'CommandOrControl+Shift+A',
    overlayOpacity: 0.95,
    overlayScale: 1,
    closeOnClickOutside: false,
    league: 'Mirage',
    reloadOnSave: true,
    updateChannel: 'stable',
    tradeStatus: 'available',
    tradePriceOption: 'chaos_divine',
    priceCheckDefaultPercent: 90,
    chatCommands: [],
    stashScrollEnabled: false,
  },
})

// Backfill defaults for keys added after initial release
if (store.get('reloadOnSave') === undefined) store.set('reloadOnSave', true)
if (store.get('stashScrollEnabled') === undefined) store.set('stashScrollEnabled', false)

// Auto-detect overlay scale on first run (deferred until app ready since screen API requires it)
app.whenReady().then(() => {
  if (store.get('overlayScale') === 1 && !store.get('overlayScaleSet' as keyof AppSettings)) {
    const height = screen.getPrimaryDisplay().workAreaSize.height
    if (height >= 2160)
      store.set('overlayScale', 2) // 4K
    else if (height >= 1440) store.set('overlayScale', 1.5) // 1440p
    // 1080p and below stays at 1
    store.set('overlayScaleSet' as keyof AppSettings, true)
  }
})

// Migrate: derive filterDir from existing filterPath for users upgrading
if (!store.get('filterDir') && store.get('filterPath')) {
  const { dirname } = require('path')
  store.set('filterDir', dirname(store.get('filterPath')))
} else if (!store.get('filterDir')) {
  store.set('filterDir', '')
}

// ---- Register IPC handlers -------------------------------------------------

tradeHandlers.register(store)
settingsHandlers.register(store)
filesHandlers.register(store)
editingHandlers.register(store)
versionsHandlers.register(store)
onlineSyncHandlers.register(store)
pricesHandlers.register(store)

ipcMain.on('close-overlay', () => hideOverlay())

// ---- System tray -----------------------------------------------------------

let tray: Tray | null = null

function createTray(): void {
  const icon = getAppIcon()
  if (!icon) return
  tray = new Tray(icon)
  tray.setToolTip('Scalpel')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => showAppWindow(),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setContextMenu(contextMenu)

  // Left-click opens app window
  tray.on('click', () => showAppWindow())
}

// ---- App lifecycle ---------------------------------------------------------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showAppWindow())
}

const installDir = applyPendingUpdate()
const overlaySupported = isOverlaySupported()

app.whenReady().then(() => {
  createAppWindow()
  if (overlaySupported) createOverlayWindow()
  createTray()

  // Broadcast rate limit state to overlay
  onRateLimitUpdate((state) => {
    getOverlayWindow()?.webContents.send('rate-limit', state)
  })

  const filterPath = store.get('filterPath')
  if (filterPath) loadFilter(filterPath, 'App Launch')

  if (overlaySupported) {
    // Start low-level keyboard hook
    const onHotkeyFired = createHotkeyHandler(store, isElevated)
    const onPriceCheckFired = createPriceCheckHandler(store, isElevated)
    const hotkey = store.get('hotkey')
    startHotkeyListener(onHotkeyFired)
    setHotkey(hotkey)
    setPriceCheckHandler(onPriceCheckFired)
    setPriceCheckHotkey(store.get('priceCheckHotkey'))
    setEscapeHandler(() => hideOverlay())
    setChatCommands(store.get('chatCommands') ?? [])
    const APP_MACRO_VIEWS: Record<string, string> = {
      openSettings: 'setup',
      openDust: 'dust',
      openDivCards: 'divcards',
    }
    setAppMacroHandler((action) => {
      const overlayWin = getOverlayWindow()
      if (!overlayWin || overlayWin.isDestroyed()) return
      if (action === 'openAudit') {
        onHotkeyFired()
        overlayWin.webContents.send('open-view', 'audit')
      } else {
        const view = APP_MACRO_VIEWS[action] ?? 'setup'
        overlayWin.webContents.send('open-view', view)
        showOverlay()
      }
    })
    setAppMacros(store.get('appMacros') ?? [])
    setStashScrollEnabled(store.get('stashScrollEnabled') ?? false)

    // Suspend/resume hotkeys while the hotkey recorder is active
    ipcMain.on('suspend-hotkeys', () => suspendHotkeys())
    ipcMain.on('resume-hotkeys', () => resumeHotkeys())
  }

  // Apply close-on-click-outside setting
  setCloseOnClickOutside(store.get('closeOnClickOutside'))
  setOverlayScale(store.get('overlayScale'))
  setGameFocusHandlers(
    () => resumeHotkeys(),
    () => suspendHotkeys(),
  )

  // Fetch prices in background, refresh every 10 minutes
  refreshPrices(store.get('league'))
  setInterval(() => refreshPrices(store.get('league')), 10 * 60 * 1000)

  // Auto-update check (skip in dev mode to avoid overwriting source with packaged ASAR)
  const overlayWin = getOverlayWindow()
  if (overlayWin && !process.env['ELECTRON_RENDERER_URL'])
    initUpdater(overlayWin, installDir, store.get('updateChannel'), () => showOverlay())

  if (process.env.NODE_ENV === 'development') {
    const ow = getOverlayWindow()
    ow?.webContents.openDevTools({ mode: 'detach' })
    ow?.webContents.on('context-menu', (_e, params) => {
      ow.webContents.inspectElement(params.x, params.y)
    })
  }

  // Start online filter sync
  const filterDir = store.get('filterDir')
  if (filterDir) {
    startOnlineSync(filterDir, () => {
      const wins: BrowserWindow[] = []
      const ow = getOverlayWindow()
      const aw = getAppWindow()
      if (ow) wins.push(ow)
      if (aw) wins.push(aw)
      return wins
    })
  }

  if (!filterPath || !overlaySupported) {
    // Show onboarding on first launch or when running on Wayland, otherwise stay in tray
    showAppWindow()
  }
})

app.on('will-quit', () => {
  stopHotkeyListener()
  stopOnlineSync()
})

// Keep app alive even with no windows (overlay hides, not closes)
app.on('window-all-closed', () => {
  /* intentional - overlay is hidden, not destroyed */
})
