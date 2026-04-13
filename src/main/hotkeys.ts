import { uIOhook, UiohookKey } from 'uiohook-napi'
import { clipboard, globalShortcut } from 'electron'
import { OverlayController } from 'electron-overlay-window'
import { focusGameWindow } from './overlay'

// ─── Accelerator → uiohook keycode mapping ────────────────────────────────────

const LETTER_KEYS: Record<string, number> = Object.fromEntries(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, UiohookKey[c as keyof typeof UiohookKey]]),
)

const EXTRA_KEYS: Record<string, number> = {
  F1: UiohookKey.F1,
  F2: UiohookKey.F2,
  F3: UiohookKey.F3,
  F4: UiohookKey.F4,
  F5: UiohookKey.F5,
  F6: UiohookKey.F6,
  F7: UiohookKey.F7,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9,
  F10: UiohookKey.F10,
  F11: UiohookKey.F11,
  F12: UiohookKey.F12,
  Space: UiohookKey.Space,
  Tab: UiohookKey.Tab,
  Escape: UiohookKey.Escape,
  Delete: UiohookKey.Delete,
  Home: UiohookKey.Home,
  End: UiohookKey.End,
  PageUp: UiohookKey.PageUp,
  PageDown: UiohookKey.PageDown,
  '0': UiohookKey['0'],
  '1': UiohookKey['1'],
  '2': UiohookKey['2'],
  '3': UiohookKey['3'],
  '4': UiohookKey['4'],
  '5': UiohookKey['5'],
  '6': UiohookKey['6'],
  '7': UiohookKey['7'],
  '8': UiohookKey['8'],
  '9': UiohookKey['9'],
}

const KEY_MAP = { ...LETTER_KEYS, ...EXTRA_KEYS }

interface ParsedHotkey {
  keyCode: number
  ctrl: boolean
  alt: boolean
  shift: boolean
}

/** Parse an Electron accelerator string into uiohook-compatible components.
 *  e.g. "CommandOrControl+G" → { keyCode: UiohookKey.G, ctrl: true, ... } */
function parseAccelerator(acc: string): ParsedHotkey | null {
  const parts = acc.split('+')
  const keyName = parts.pop()!.trim()
  const mods = parts.map((p) => p.trim().toLowerCase())

  const keyCode = KEY_MAP[keyName] ?? KEY_MAP[keyName.toUpperCase()]
  if (!keyCode) {
    console.error(`[hotkeys] Unrecognised key in accelerator: "${keyName}"`)
    return null
  }

  // On Windows, CommandOrControl = Ctrl
  const ctrl = mods.some((m) => ['control', 'ctrl', 'commandorcontrol'].includes(m))
  const alt = mods.includes('alt')
  const shift = mods.includes('shift')

  return { keyCode, ctrl, alt, shift }
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentAccelerator: string | null = null
let currentHotkey: ParsedHotkey | null = null // Keep parsed version for modifier release in sendCtrlCViaKeyTap
let priceCheckAccelerator: string | null = null
let chatCommandHotkeys: Array<{ accelerator: string; command: string; autoSubmit: boolean }> = []
let appMacroAccelerators: string[] = []
let lastAppMacros: Array<{ action: string; hotkey: string }> = []
let onAppMacro: ((action: string) => void) | null = null
let onTrigger: (() => void) | null = null
let onPriceCheck: (() => void) | null = null
let onEscape: (() => void) | null = null
let hookStarted = false
let injecting = false
let stashScrollEnabled = false

// ─── Public API ───────────────────────────────────────────────────────────────

/** Start the low-level keyboard hook (for Escape only) and register the trigger callback. */
export function startHotkeyListener(handler: () => void): void {
  onTrigger = handler

  // uiohook is only used for Escape (overlay close), stash scroll, and modifier tracking
  initModifierTracking()
  uIOhook.on('keydown', (e) => {
    if (injecting) return
    if (e.keycode === UiohookKey.Escape && onEscape) {
      onEscape()
    }
  })

  // Stash tab scrolling: Ctrl+scroll outside stash grid -> arrow key taps
  uIOhook.on('wheel', (e) => {
    if (!stashScrollEnabled || !e.ctrlKey) return
    const tb = OverlayController.targetBounds
    if (!tb || !tb.width) return
    // Only act when cursor is inside the PoE window but outside the stash grid area
    if (e.x < tb.x || e.x > tb.x + tb.width || e.y < tb.y || e.y > tb.y + tb.height) return
    if (isStashGridArea(e.x, e.y, tb)) return
    if (e.rotation > 0) {
      uIOhook.keyTap(UiohookKey.ArrowRight)
    } else if (e.rotation < 0) {
      uIOhook.keyTap(UiohookKey.ArrowLeft)
    }
  })

  if (!hookStarted) {
    uIOhook.start()
    hookStarted = true
  }
}

/** Temporarily unregister all global shortcuts so the hotkey recorder can capture keys. */
export function suspendHotkeys(): void {
  globalShortcut.unregisterAll()
}

/** Re-register all global shortcuts after the hotkey recorder finishes. */
export function resumeHotkeys(): void {
  if (currentAccelerator) setHotkey(currentAccelerator)
  if (priceCheckAccelerator) setPriceCheckHotkey(priceCheckAccelerator)
  const cmds = chatCommandHotkeys.map((c) => ({ hotkey: c.accelerator, command: c.command, autoSubmit: c.autoSubmit }))
  setChatCommands(cmds)
  setAppMacros(lastAppMacros)
}

/** Update the active hotkey using globalShortcut (suppresses key from reaching other apps). */
export function setHotkey(accelerator: string): void {
  if (currentAccelerator) {
    try {
      globalShortcut.unregister(currentAccelerator)
    } catch {}
  }
  currentAccelerator = accelerator
  currentHotkey = parseAccelerator(accelerator)
  try {
    globalShortcut.register(accelerator, () => {
      if (onTrigger) onTrigger()
    })
  } catch (e) {
    console.error(`[hotkeys] Failed to register hotkey "${accelerator}":`, e)
  }
}

export function setPriceCheckHotkey(accelerator: string): void {
  if (priceCheckAccelerator) {
    try {
      globalShortcut.unregister(priceCheckAccelerator)
    } catch {}
  }
  priceCheckAccelerator = accelerator
  try {
    globalShortcut.register(accelerator, () => {
      if (onPriceCheck) onPriceCheck()
    })
  } catch (e) {
    console.error(`[hotkeys] Failed to register price check hotkey "${accelerator}":`, e)
  }
}

export function setPriceCheckHandler(handler: (() => void) | null): void {
  onPriceCheck = handler
}

export function setEscapeHandler(handler: (() => void) | null): void {
  onEscape = handler
}

export function setChatCommands(commands: Array<{ hotkey: string; command: string; autoSubmit?: boolean }>): void {
  // Unregister previous chat command shortcuts
  for (const ch of chatCommandHotkeys) {
    try {
      globalShortcut.unregister(ch.accelerator)
    } catch {}
  }
  chatCommandHotkeys = []

  for (const c of commands) {
    if (!c.hotkey || !c.command) continue
    const autoSubmit = c.autoSubmit !== false
    try {
      globalShortcut.register(c.hotkey, () => {
        sendChatCommand(c.command, autoSubmit)
      })
      chatCommandHotkeys.push({ accelerator: c.hotkey, command: c.command, autoSubmit })
    } catch (e) {
      console.error(`[hotkeys] Failed to register chat command "${c.hotkey}":`, e)
    }
  }
}

export function setAppMacroHandler(handler: (action: string) => void): void {
  onAppMacro = handler
}

export function setAppMacros(macros: Array<{ action: string; hotkey: string }>): void {
  lastAppMacros = macros
  for (const acc of appMacroAccelerators) {
    try {
      globalShortcut.unregister(acc)
    } catch {}
  }
  appMacroAccelerators = []

  for (const { action, hotkey } of macros) {
    if (!hotkey || !action) continue
    try {
      globalShortcut.register(hotkey, () => {
        if (onAppMacro) onAppMacro(action)
      })
      appMacroAccelerators.push(hotkey)
    } catch (e) {
      console.error(`[hotkeys] Failed to register app macro "${action}" (${hotkey}):`, e)
    }
  }
}

/**
 * Paste text into PoE chat via clipboard + uiohook keyTaps.
 * Layout-independent, near-instant.
 */
let chatLocked = false
function pasteToPoEChat(text: string, submit: boolean): Promise<void> {
  if (chatLocked) return Promise.resolve()
  chatLocked = true

  const prevClip = clipboard.readText()
  clipboard.writeText(text)

  // Suspend our own hotkeys so the keystrokes we send don't trigger our own handlers
  // (e.g. Ctrl+A in the paste sequence would fire a Ctrl+A filter hotkey)
  suspendHotkeys()

  // Focus PoE so keystrokes reach the game (only if it doesn't already have focus)
  if (!OverlayController.targetHasFocus) focusGameWindow()

  // All keystrokes fire synchronously within ~5ms so the chat window
  // opens and closes in a single frame, preventing visible flash
  uIOhook.keyTap(UiohookKey.Enter)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  uIOhook.keyTap(UiohookKey.A)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  uIOhook.keyTap(UiohookKey.Delete)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  uIOhook.keyTap(UiohookKey.V)
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  if (submit) {
    uIOhook.keyTap(UiohookKey.Enter)
  }

  // Restore clipboard and re-register hotkeys after paste completes
  return new Promise((resolve) =>
    setTimeout(() => {
      clipboard.writeText(prevClip)
      chatLocked = false
      resumeHotkeys()
      resolve()
    }, 50),
  )
}

export function sendChatCommand(command: string, autoSubmit = true): Promise<void> {
  const held = snapshotModifiers()
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')
  uIOhook.keyToggle(UiohookKey.Shift, 'up')
  uIOhook.keyToggle(UiohookKey.Alt, 'up')
  return pasteToPoEChat(command, autoSubmit).then(() => restoreModifiers(held))
}

/** Track physically held modifier keys via uiohook (ignores synthetic key events during injection) */
const heldModifiers = { ctrl: false, shift: false, alt: false }

function initModifierTracking(): void {
  uIOhook.on('keydown', (e) => {
    if (injecting) return
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) heldModifiers.ctrl = true
    if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) heldModifiers.shift = true
    if (e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight) heldModifiers.alt = true
  })
  uIOhook.on('keyup', (e) => {
    if (injecting) return
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) heldModifiers.ctrl = false
    if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) heldModifiers.shift = false
    if (e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight) heldModifiers.alt = false
  })
}

function snapshotModifiers(): { ctrl: boolean; shift: boolean; alt: boolean } {
  return { ...heldModifiers }
}

function restoreModifiers(held: { ctrl: boolean; shift: boolean; alt: boolean }): void {
  if (held.ctrl) uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  if (held.shift) uIOhook.keyToggle(UiohookKey.Shift, 'down')
  if (held.alt) uIOhook.keyToggle(UiohookKey.Alt, 'down')
}

export function stopHotkeyListener(): void {
  if (hookStarted) {
    uIOhook.stop()
    hookStarted = false
  }
  globalShortcut.unregisterAll()
}

export function setStashScrollEnabled(enabled: boolean): void {
  stashScrollEnabled = enabled
}

// PoE stash grid area (physical pixels) - if cursor is here, don't intercept scroll
const POE_SIDEBAR_RATIO = 370 / 600
function isStashGridArea(x: number, y: number, tb: { x: number; y: number; width: number; height: number }): boolean {
  const sidebarWidth = tb.height * POE_SIDEBAR_RATIO
  if (x > tb.x + sidebarWidth) return false
  const gridTop = tb.y + (tb.height * 154) / 1600
  const gridBottom = tb.y + (tb.height * 1192) / 1600
  return y > gridTop && y < gridBottom
}

/**
 * Send /reloaditemfilter to PoE's chat to reload the loot filter in-game.
 */
export function sendReloadFilterToPoE(): Promise<void> {
  return pasteToPoEChat('/reloaditemfilter', true)
}

/**
 * Send /itemfilter {name} to PoE's chat to switch the active filter in-game.
 */
export async function sendItemFilterCommand(filterName: string, currentFilter?: string): Promise<void> {
  if (currentFilter) {
    // Switch to the current filter first to force PoE to rescan its filter directory,
    // so it discovers the newly created file before we switch to it
    await pasteToPoEChat(`/itemfilter ${currentFilter}`, true)
    await new Promise((r) => setTimeout(r, 500))
  }
  await pasteToPoEChat(`/itemfilter ${filterName}`, true)
}

// ─── Ctrl+C sender ───────────────────────────────────────────────────────────

/**
 * Send Ctrl+Alt+C to PoE via uiohook (OS-level SendInput).
 * Releases any modifier keys the user is holding from their hotkey combo
 * so PoE receives a clean Ctrl+Alt+C.
 */
export function sendCtrlCToPoE(): Promise<void> {
  injecting = true
  const held = snapshotModifiers()

  if (currentHotkey?.shift) uIOhook.keyToggle(UiohookKey.Shift, 'up')
  if (currentHotkey?.alt) uIOhook.keyToggle(UiohookKey.Alt, 'up')

  uIOhook.keyToggle(UiohookKey.Ctrl, 'down')
  uIOhook.keyToggle(UiohookKey.Alt, 'down')
  uIOhook.keyTap(UiohookKey.C)
  uIOhook.keyToggle(UiohookKey.Alt, 'up')
  uIOhook.keyToggle(UiohookKey.Ctrl, 'up')

  return new Promise((resolve) =>
    setTimeout(() => {
      injecting = false
      restoreModifiers(held)
      resolve()
    }, 100),
  )
}
