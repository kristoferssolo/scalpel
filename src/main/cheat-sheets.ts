import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { AppSettings } from '../shared/types'

function rootDir(): string {
  return join(app.getPath('userData'), 'cheat-sheets')
}

export function categoryDir(categoryId: string): string {
  return join(rootDir(), categoryId)
}

export function sheetFilePath(categoryId: string, sheetId: string, ext: string): string {
  return join(categoryDir(categoryId), `${sheetId}.${ext}`)
}

export function generateSheetId(): string {
  return randomBytes(6).toString('hex')
}

export function generateCategoryId(): string {
  return `cat-${randomBytes(4).toString('hex')}`
}

export function saveSheetBuffer(categoryId: string, sheetId: string, ext: string, data: Buffer): string {
  const dir = categoryDir(categoryId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = sheetFilePath(categoryId, sheetId, ext)
  writeFileSync(path, data)
  return path
}

export function removeSheetFile(categoryId: string, sheetId: string, ext: string): void {
  const path = sheetFilePath(categoryId, sheetId, ext)
  if (existsSync(path)) unlinkSync(path)
}

export function removeCategoryDir(categoryId: string): void {
  const dir = categoryDir(categoryId)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

const ALLOWED_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; ext: string }> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) throw new Error('Invalid data URL')
    const mime = m[1].toLowerCase()
    const ext = ALLOWED_EXT_BY_MIME[mime]
    if (!ext) throw new Error(`URL is not an image (mime: ${mime})`)
    const buffer = Buffer.from(m[2], 'base64')
    if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image exceeds 10MB')
    return { buffer, ext }
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Scalpel-CheatSheet' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const ext = ALLOWED_EXT_BY_MIME[mime]
  if (!ext) throw new Error(`URL is not an image (mime: ${mime || 'unknown'})`)
  const arr = await res.arrayBuffer()
  if (arr.byteLength > MAX_IMAGE_BYTES) throw new Error('Image exceeds 10MB')
  return { buffer: Buffer.from(arr), ext }
}

// ---- Grid window lifecycle --------------------------------------------------

let gridWin: BrowserWindow | null = null
let lastBounds: { x: number; y: number; width: number; height: number } | null = null

export function setLastBounds(bounds: { x: number; y: number; width: number; height: number } | undefined): void {
  if (bounds) lastBounds = bounds
}

let boundsListener: ((b: { x: number; y: number; width: number; height: number }) => void) | null = null

export function onBoundsChanged(cb: (b: { x: number; y: number; width: number; height: number }) => void): void {
  boundsListener = cb
}

function persistBounds(): void {
  if (!gridWin || gridWin.isDestroyed()) return
  const b = gridWin.getBounds()
  lastBounds = b
  boundsListener?.(b)
}

export function showGridWindow(focusCategoryId?: string): void {
  if (gridWin && !gridWin.isDestroyed()) {
    if (gridWin.isVisible()) {
      gridWin.hide()
    } else {
      gridWin.show()
      gridWin.webContents.send('cheat-sheet:focus-category', focusCategoryId)
    }
    return
  }
  gridWin = new BrowserWindow({
    width: lastBounds?.width ?? 400,
    height: lastBounds?.height ?? 300,
    x: lastBounds?.x,
    y: lastBounds?.y,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    void gridWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/cheat-sheets-grid.html`)
  } else {
    void gridWin.loadFile(join(__dirname, '../renderer/cheat-sheets-grid.html'))
  }
  // Send the focus category once the window is ready (loadURL is async).
  gridWin.webContents.once('did-finish-load', () => {
    gridWin?.webContents.send('cheat-sheet:focus-category', focusCategoryId)
  })
  gridWin.on('close', (e) => {
    e.preventDefault()
    gridWin?.hide()
  })
  gridWin.on('moved', () => persistBounds())
  gridWin.on('resized', () => persistBounds())
}

export function hideGridWindow(): void {
  gridWin?.hide()
}

// ---- Hotkey registration ---------------------------------------------------

let registered: string[] = []

export function setCheatSheetHotkeys(cs: AppSettings['cheatSheets']): void {
  for (const acc of registered) globalShortcut.unregister(acc)
  registered = []
  if (!cs) return
  if (cs.globalHotkey) {
    if (globalShortcut.register(cs.globalHotkey, () => showGridWindow())) {
      registered.push(cs.globalHotkey)
    }
  }
  for (const cat of cs.categories) {
    if (cat.hotkey) {
      const id = cat.id
      if (globalShortcut.register(cat.hotkey, () => showGridWindow(id))) {
        registered.push(cat.hotkey)
      }
    }
  }
}

// ---- Preview window lifecycle -----------------------------------------------

let previewWin: BrowserWindow | null = null

function ensurePreviewWindow(): BrowserWindow {
  if (previewWin && !previewWin.isDestroyed()) return previewWin
  const display = screen.getPrimaryDisplay()
  previewWin = new BrowserWindow({
    width: display.workAreaSize.width,
    height: display.workAreaSize.height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  previewWin.setIgnoreMouseEvents(true)
  if (process.env['ELECTRON_RENDERER_URL']) {
    void previewWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/cheat-sheets-preview.html`)
  } else {
    void previewWin.loadFile(join(__dirname, '../renderer/cheat-sheets-preview.html'))
  }
  return previewWin
}

export function showPreview(src: string, anchor: { x: number; y: number; width: number; height: number }): void {
  const win = ensurePreviewWindow()
  win.show()
  const display = screen.getPrimaryDisplay()
  win.webContents.send('cheat-sheet-preview:render', {
    src,
    anchor,
    screen: display.workAreaSize,
  })
}

export function hidePreview(): void {
  previewWin?.hide()
}
