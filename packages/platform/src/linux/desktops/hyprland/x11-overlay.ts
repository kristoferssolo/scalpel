import { reportBreadcrumb } from '@platform/common/diagnostics'
import type { X11OverlayIntegration } from '@platform/linux/common/layer-shell/adapter'
import { currentEnv, detectDesktopEnvironment } from '@platform/select'
import type { PlatformEnv } from '@platform/types'
import type { BrowserWindow } from 'electron'
import { readHyprlandClientsAsync, runHyprctl } from './ipc'

/**
 * Hyprland blurs behind transparent XWayland windows. Scalpel's X11 overlay is
 * a full-game transparent window, so without these properties Hyprland blurs
 * the game while the overlay is open and keeps doing so while the hidden window
 * is still mapped.
 */
const WINDOW_STYLE = [
  ['no_blur', '1'],
  ['no_shadow', '1'],
  ['no_dim', '1'],
  ['decorate', '0'],
  ['border_size', '0'],
  ['rounding', '0'],
] as const

/** Hyprland's pre-Lua property names. */
const LEGACY_PROPERTY: Record<(typeof WINDOW_STYLE)[number][0], string> = {
  no_blur: 'noblur',
  no_shadow: 'noshadow',
  no_dim: 'nodim',
  decorate: 'decorate',
  border_size: 'bordersize',
  rounding: 'rounding',
}

type StyleMethod = 'lua' | 'legacy' | null

const pending = new WeakSet<BrowserWindow>()
let method: StyleMethod | undefined

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}

function validAddress(address: string | undefined): address is string {
  return typeof address === 'string' && /^0x[0-9a-f]+$/i.test(address)
}

function luaStyleScript(address: string): string {
  const window = `address:${address}`
  return [
    'if not hl or not hl.dsp or not hl.dsp.window or not hl.dsp.window.set_prop then',
    '  error("Hyprland window property dispatcher unavailable")',
    'end',
    ...WINDOW_STYLE.map(
      ([prop, value]) =>
        `pcall(function() hl.dispatch(hl.dsp.window.set_prop({ prop = "${prop}", value = "${value}", window = "${window}" })) end)`,
    ),
  ].join('\n')
}

async function applyLuaStyle(address: string, env: PlatformEnv): Promise<void> {
  await runHyprctl(['eval', luaStyleScript(address)], env)
}

async function applyLegacyStyle(address: string, env: PlatformEnv): Promise<boolean> {
  let applied = false
  for (const [prop, value] of WINDOW_STYLE) {
    try {
      await runHyprctl(['dispatch', 'setprop', `address:${address}`, LEGACY_PROPERTY[prop], value, 'lock'], env)
      applied = true
    } catch {
      // Older releases know different property names; apply what they accept.
    }
  }
  return applied
}

async function applyStyle(address: string, env: PlatformEnv): Promise<boolean> {
  if (method === null) return false
  if (method === 'lua') {
    try {
      await applyLuaStyle(address, env)
      return true
    } catch {
      return false
    }
  }
  if (method === 'legacy') return applyLegacyStyle(address, env)

  // First window: Hyprland 0.56+ speaks the Lua dispatcher; older releases
  // (if they reach this path) use the legacy setprop command.
  try {
    await applyLuaStyle(address, env)
    method = 'lua'
    return true
  } catch {}
  try {
    if (await applyLegacyStyle(address, env)) {
      method = 'legacy'
      return true
    }
  } catch {}
  method = null
  reportBreadcrumb('hyprland x11 overlay styling unavailable', 'debug')
  return false
}

async function configureOnce(env: PlatformEnv): Promise<boolean> {
  const clients = await readHyprlandClientsAsync(env)
  const own = clients.filter((client) => client.pid === process.pid && client.xwayland === true)
  if (!own.length) return false

  let complete = true
  for (const client of own) {
    const address = client.address
    if (!validAddress(address)) continue
    if (await applyStyle(address, env)) {
      reportBreadcrumb(`hyprland x11 overlay styled address=${address}`, 'debug')
    } else {
      complete = false
    }
    // The compositor has no supported styling API; do not retry every show.
    if (method === null) return true
  }
  return complete
}

/** Apply the compositor-side decorations for one overlay window. Retries briefly
 *  because Electron emits `show` just before Hyprland lists the new client. */
export function prepareHyprlandX11Overlay(win: BrowserWindow): void {
  if (process.platform !== 'linux') return
  const env = currentEnv()
  if (!env.env.HYPRLAND_INSTANCE_SIGNATURE && detectDesktopEnvironment(env) !== 'hyprland') return
  if (pending.has(win)) return
  pending.add(win)
  void (async () => {
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (win.isDestroyed()) return
        if (await configureOnce(env)) return
        await delay(80 + attempt * 80)
      }
    } catch (error) {
      reportBreadcrumb(`hyprland x11 overlay styling failed error=${String(error)}`, 'debug')
    } finally {
      pending.delete(win)
    }
  })()
}

export const hyprlandX11Overlay: X11OverlayIntegration = {
  prepare: prepareHyprlandX11Overlay,
}
