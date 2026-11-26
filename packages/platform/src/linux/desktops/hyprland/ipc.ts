import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { currentEnv } from '@platform/select'
import type { PlatformEnv } from '@platform/types'

const execFileAsync = promisify(execFile)

/** A Hyprland client as reported by `hyprctl -j clients`. Only the fields the
 *  geometry/game-mode paths rely on are listed; Hyprland adds more over time. */
export interface HyprlandClient {
  readonly address?: string
  readonly mapped?: boolean
  readonly hidden?: boolean
  /** Global layout/logical coordinates; the same space layer-shell uses. */
  readonly at?: [number, number]
  readonly size?: [number, number]
  readonly workspace?: { id?: number; name?: string }
  readonly floating?: boolean
  readonly monitor?: number
  /** `class` is the app id on Wayland and WM_CLASS on XWayland. */
  readonly class?: string
  readonly initialClass?: string
  readonly title?: string
  readonly initialTitle?: string
  readonly pid?: number
  /** Present on Hyprland releases that report XWayland clients explicitly. */
  readonly xwayland?: boolean
  readonly fullscreen?: number
  readonly fullscreenClient?: number
  /** 0 is the currently focused window (newer Hyprland releases). */
  readonly focusHistoryID?: number
}

export interface HyprlandMonitor {
  readonly id?: number
  readonly name?: string
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly scale?: number
  readonly focused?: boolean
}

/** Backwards-compatible name used by the archived XWayland backend and older
 *  callers that only need the client shape. */
export type HyprClient = HyprlandClient

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/** Synchronous client snapshot for the settings game-mode probe, which renders
 *  synchronously. Geometry polling uses the async helpers below instead. */
export function readHyprlandClients(env: NodeJS.ProcessEnv = process.env): readonly HyprlandClient[] {
  const output = execFileSync('hyprctl', ['-j', 'clients'], {
    encoding: 'utf8',
    timeout: 750,
    stdio: ['ignore', 'pipe', 'ignore'],
    env,
  })
  return parseJson<HyprlandClient[]>(output) ?? []
}

async function hyprctlJson<T>(args: readonly string[], env: PlatformEnv): Promise<T | null> {
  return parseJson<T>(await runHyprctl(['-j', ...args], env))
}

/** Run one `hyprctl` command. Callers own error handling; geometry/overlay
 *  helpers treat a missing compositor as "feature unavailable", not fatal. */
export async function runHyprctl(args: readonly string[], env: PlatformEnv = currentEnv()): Promise<string> {
  const { stdout } = await execFileAsync('hyprctl', args, {
    encoding: 'utf8',
    timeout: 750,
    env: env.env,
  })
  return stdout
}

export async function readHyprlandClientsAsync(env: PlatformEnv = currentEnv()): Promise<readonly HyprlandClient[]> {
  return (await hyprctlJson<HyprlandClient[]>(['clients'], env)) ?? []
}

/** `{}` when no window is focused. */
export async function readHyprlandActiveWindow(env: PlatformEnv = currentEnv()): Promise<HyprlandClient | null> {
  return hyprctlJson<HyprlandClient>(['activewindow'], env)
}

export async function readHyprlandMonitors(env: PlatformEnv = currentEnv()): Promise<readonly HyprlandMonitor[]> {
  return (await hyprctlJson<HyprlandMonitor[]>(['monitors'], env)) ?? []
}
