import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, powerMonitor, screen, protocol } from 'electron'

// Prevent unhandled JS exceptions from crashing the native overlay thread
// electron-overlay-window's tsfn_to_js_proxy calls napi_fatal_error if napi_call_function
// returns non-ok, which happens when there's a pending exception on the JS isolate
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err)
})

import { existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import Store from 'electron-store'
import {
  createOverlayWindow,
  hideOverlay,
  showOverlay,
  getOverlayWindow,
  setCloseOnClickOutside,
  setGameFocusHandlers,
} from './overlay'
import { createAppWindow, showAppWindow, getAppWindow } from './app-window'
import {
  startHotkeyListener,
  setHotkey,
  setPriceCheckHotkey,
  setPriceCheckHandler,
  setEscapeHandler,
  stopHotkeyListener,
  setChatCommands,
  setAppMacros,
  setAppMacroHandler,
  suspendHotkeys,
  resumeHotkeys,
  setStashScrollEnabled,
} from './hotkeys'
import { refreshPrices, invalidatePriceCache } from './trade/prices'
import { onRateLimitUpdate } from './trade/trade'
import { startOnlineSync, stopOnlineSync } from './online-sync'
import { initUpdater } from './update/updater'
import { applyPendingUpdate } from './update/update-swap'
import { loadFilter } from './filter-state'
import { createHotkeyHandler, createPriceCheckHandler, setOpenSide } from './evaluation'
import { snapshotClipboard } from './clipboard-preserve'
import * as tradeHandlers from './handlers/trade'
import * as settingsHandlers from './handlers/settings'
import * as filesHandlers from './handlers/files'
import * as editingHandlers from './handlers/editing'
import * as versionsHandlers from './handlers/versions'
import * as onlineSyncHandlers from './handlers/online-sync'
import * as pricesHandlers from './handlers/prices'
import { register as registerCheatSheets } from './handlers/cheat-sheets'
import {
  categoryDir,
  setLastBounds,
  onBoundsChanged,
  setCheatSheetHotkeys,
  hideOnPoeBlur,
  restoreOnPoeFocus,
} from './cheat-sheets'
import type { AppSettings } from '../shared/types'

// ---- Elevation detection ---------------------------------------------------

function isElevated(): boolean {
  try {
    execSync('net session', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ---- Persistent settings ---------------------------------------------------

const store = new Store<AppSettings>({
  defaults: {
    filterPath: '',
    filterDir: '',
    filterPathPoe1: '',
    filterPathPoe2: '',
    filterDirPoe1: '',
    filterDirPoe2: '',
    league: 'Mirage',
    leaguePoe1: 'Mirage',
    leaguePoe2: 'Fate of the Vaal',
    hotkey: 'CommandOrControl+Shift+D',
    priceCheckHotkey: 'CommandOrControl+Shift+A',
    overlayOpacity: 0.95,
    overlayScale: 1,
    openSide: 'both',
    closeOnClickOutside: false,
    reloadOnSave: true,
    updateChannel: 'stable',
    tradeStatus: 'available',
    tradeCollapseListings: true,
    previewVolume: 0.25,
    tradePriceOption: 'chaos_divine',
    tradePriceOptionPoe1: 'chaos_divine',
    tradePriceOptionPoe2: 'exalted_divine',
    priceCheckDefaultPercent: 90,
    tradeDefaultToBase: false,
    chatCommands: [],
    appMacros: [],
    cheatSheets: { globalHotkey: '', categories: [] },
    stashScrollEnabled: false,
    poeVersion: 1,
    regexPresets: [],
  },
})

// Backfill defaults for keys added after initial release
if (store.get('reloadOnSave') === undefined) store.set('reloadOnSave', true)
if (store.get('stashScrollEnabled') === undefined) store.set('stashScrollEnabled', false)
if (store.get('openSide') === undefined) store.set('openSide', 'both')
if ((store.get('tradeStatus') as string) === 'any') store.set('tradeStatus', 'available')

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

// Migrate: seed per-version fields from the pre-existing flat values. Before this
// change everyone had a single league/filter/price-option -- treat that as their
// PoE1 setup. Guarded by empty-check so we only migrate once.
if (!store.get('leaguePoe1')) store.set('leaguePoe1', store.get('league'))
if (!store.get('filterPathPoe1')) store.set('filterPathPoe1', store.get('filterPath'))
if (!store.get('filterDirPoe1')) store.set('filterDirPoe1', store.get('filterDir'))
if (!store.get('tradePriceOptionPoe1')) store.set('tradePriceOptionPoe1', store.get('tradePriceOption'))

// On startup, sync the flat active fields to match whichever version is current.
// The relaunch-on-game-switch flow (ensureCorrectGameForHotkey) means this runs
// with the right version after the user confirms a switch in the modal. Writes
// from the settings UI mirror in the other direction -- see handlers/settings.ts.
{
  const suffix: 'Poe1' | 'Poe2' = store.get('poeVersion') === 2 ? 'Poe2' : 'Poe1'
  store.set('league', store.get(`league${suffix}`))
  store.set('filterPath', store.get(`filterPath${suffix}`))
  store.set('filterDir', store.get(`filterDir${suffix}`))
  store.set('tradePriceOption', store.get(`tradePriceOption${suffix}`))
}

// ---- Register IPC handlers -------------------------------------------------

tradeHandlers.register(store)
settingsHandlers.register(store)
filesHandlers.register(store)
editingHandlers.register(store)
versionsHandlers.register(store)
onlineSyncHandlers.register(store)
pricesHandlers.register(store)
registerCheatSheets()

ipcMain.on('close-overlay', () => hideOverlay())
ipcMain.on('open-devtools', (event) => {
  // Only open devtools on the app window (overlay devtools breaks the transparent overlay)
  const app = getAppWindow()
  if (app && !app.isDestroyed()) {
    app.webContents.openDevTools({ mode: 'detach' })
  } else {
    event.sender.openDevTools({ mode: 'detach' })
  }
})

// ---- System tray -----------------------------------------------------------

let tray: Tray | null = null

function getAppIcon(): Electron.NativeImage {
  // In packaged app, resources/ is at process.resourcesPath; in dev, it's at project root
  const devPath = join(__dirname, '../../resources/icon.ico')
  const prodPath = join(process.resourcesPath, 'icon.ico')
  const iconPath = existsSync(prodPath) ? prodPath : devPath
  return nativeImage.createFromPath(iconPath)
}

function createTray(): void {
  const icon = getAppIcon()
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

app.whenReady().then(() => {
  // Seed the overlay with the last-known game version so attachByTitle waits for
  // that window. The hotkey handler re-detects the focused PoE on every fire and
  // relaunches to swap versions if needed (ensureCorrectGameForHotkey).
  createOverlayWindow(store.get('poeVersion') ?? 1)
  createAppWindow()
  createTray()

  // Serve cheat sheet images via a custom protocol so the renderer can load local files
  protocol.handle('cheatsheet', (request) => {
    const url = request.url.replace('cheatsheet://', '')
    const [categoryId, file] = url.split('/')
    const filePath = join(categoryDir(categoryId), file ?? '')
    return new Response(require('fs').createReadStream(filePath) as unknown as ReadableStream)
  })

  // Broadcast rate limit state to overlay
  onRateLimitUpdate((state) => {
    getOverlayWindow()?.webContents.send('rate-limit', state)
  })

  const filterPath = store.get('filterPath')
  if (filterPath) loadFilter(filterPath, 'App Launch')

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
  let currentRegex = ''
  ipcMain.on('report-regex', (_event, regex: string) => {
    currentRegex = regex
  })
  const APP_MACRO_VIEWS: Record<string, string> = {
    openSettings: 'setup',
    openDust: 'dust',
    openDivCards: 'divcards',
    openRegex: 'regex',
  }
  const pasteRegexToSearch = (regex: string): void => {
    const { clipboard } = require('electron') as typeof import('electron')
    const restoreClip = snapshotClipboard()
    clipboard.writeText(regex)
    const { uIOhook, UiohookKey } = require('uiohook-napi') as typeof import('uiohook-napi')
    // Open search box first (Ctrl+F)
    uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
    uIOhook.keyTap(UiohookKey.F)
    uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
    // Paste the regex
    uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
    uIOhook.keyTap(UiohookKey.V)
    uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
    // Restore the user's previous clipboard after PoE consumes the paste
    setTimeout(restoreClip, 100)
  }

  setAppMacroHandler((action, tag) => {
    if (action === 'pasteRegex') {
      if (currentRegex) pasteRegexToSearch(currentRegex)
      return
    }
    if (action === 'useSavedRegex') {
      if (!tag) return
      const presets = (store.get('regexPresets') as import('../shared/types').RegexPreset[] | undefined) ?? []
      const preset = presets.find((p) => p.tags?.some((t) => t.text === tag && (!t.source || t.source === 'custom')))
      if (preset?.regex) pasteRegexToSearch(preset.regex)
      return
    }
    if (action === 'closeOverlay') {
      hideOverlay()
      return
    }
    const overlayWin = getOverlayWindow()
    if (!overlayWin || overlayWin.isDestroyed()) return
    if (action === 'openAudit') {
      onHotkeyFired()
      overlayWin.webContents.send('open-view', 'audit')
    } else if (action === 'openWiki' || action === 'openPoeDb') {
      onHotkeyFired()
      const target = action === 'openWiki' ? 'wiki' : 'poedb'
      overlayWin.webContents.send('open-link-pending', target)
    } else {
      const view = APP_MACRO_VIEWS[action] ?? 'setup'
      overlayWin.webContents.send('open-view', view)
      showOverlay()
    }
  })
  setAppMacros(store.get('appMacros') ?? [])
  setLastBounds(store.get('cheatSheets')?.windowBounds)
  onBoundsChanged((bounds) => {
    const cs = store.get('cheatSheets') ?? { globalHotkey: '', categories: [] }
    store.set('cheatSheets', { ...cs, windowBounds: bounds })
  })
  setCheatSheetHotkeys(store.get('cheatSheets'))
  setStashScrollEnabled(store.get('stashScrollEnabled') ?? false)
  setOpenSide(store.get('openSide') ?? 'both')

  // Suspend/resume hotkeys while the hotkey recorder is active
  ipcMain.on('suspend-hotkeys', () => suspendHotkeys())
  ipcMain.on('resume-hotkeys', () => resumeHotkeys())

  // Apply close-on-click-outside setting
  setCloseOnClickOutside(store.get('closeOnClickOutside'))
  setGameFocusHandlers(
    () => {
      resumeHotkeys()
      restoreOnPoeFocus()
    },
    () => {
      suspendHotkeys()
      hideOnPoeBlur()
    },
  )

  // Start with hotkeys suspended until PoE actually gains focus.
  // Without this, hotkeys fire globally (e.g. in other games) before PoE opens.
  suspendHotkeys()

  // Fetch prices in background, refresh every 10 minutes
  refreshPrices(store.get('league'))
  setInterval(() => refreshPrices(store.get('league')), 10 * 60 * 1000)

  // After the OS wakes from sleep, Electron's network stack often bails on pending
  // requests with ERR_NETWORK_IO_SUSPENDED. Invalidate the price cache and re-fetch so
  // we don't sit on stale/empty prices for up to 10 minutes.
  powerMonitor.on('resume', () => {
    invalidatePriceCache()
    refreshPrices(store.get('league'))
  })

  // Wire the updater unconditionally so broadcasts (update-available, update-rescinded)
  // can fire in dev for fake-update testing. The periodic GitHub check and destructive
  // install actions internally bail when ELECTRON_RENDERER_URL is set so a dev session
  // doesn't overwrite source with a packaged ASAR.
  const overlayWin = getOverlayWindow()
  if (overlayWin)
    initUpdater([getOverlayWindow, getAppWindow], installDir, store.get('updateChannel'), () => showOverlay())

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

  // Show onboarding on first launch, otherwise stay in tray
  if (!filterPath) {
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
