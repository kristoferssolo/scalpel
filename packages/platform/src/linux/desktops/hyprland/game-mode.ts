import { detectDesktopEnvironment } from '@platform/select'
import type { PlatformEnv } from '@platform/types'
import { readHyprlandClients } from './ipc'

export type PlatformGameMode = 'x11' | 'wayland'

/** Minimal client facts the Hyprland probe needs; `hyprctl` may omit them. */
export interface HyprlandGameClient {
  readonly title?: string
  readonly xwayland?: boolean
}

type ReadClients = () => readonly HyprlandGameClient[]

/** Pure matching helper so tests can exercise the policy without a compositor. */
export function gameModeFromClients(
  clients: readonly HyprlandGameClient[],
  titles: readonly string[],
): PlatformGameMode | null {
  const wanted = titles.map((title) => title.toLowerCase())
  const game = clients.find((client) => wanted.includes((client.title ?? '').toLowerCase()))
  if (!game || typeof game.xwayland !== 'boolean') return null
  return game.xwayland ? 'x11' : 'wayland'
}

/**
 * Compositor-backed detection for the PoE game-mode warning. Hyprland can say
 * whether the game window is XWayland; every other compositor returns null and
 * the user can still override the mode in settings.
 */
export function detectHyprlandGameMode(
  titles: readonly string[],
  env: PlatformEnv,
  readClients: ReadClients = () => readHyprlandClients(env.env),
): PlatformGameMode | null {
  if (!env.env.HYPRLAND_INSTANCE_SIGNATURE && detectDesktopEnvironment(env) !== 'hyprland') return null
  try {
    return gameModeFromClients(readClients(), titles)
  } catch {
    return null
  }
}
