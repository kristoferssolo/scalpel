import { reportBreadcrumb } from '@platform/common/diagnostics'
import { matchGameWindow, type GameWindowMatch } from '@platform/common/game-window-identity'
import { currentEnv, detectDesktopEnvironment } from '@platform/select'
import type { PlatformEnv } from '@platform/types'
import type { LinuxGameDisplayMode } from '@platform/linux/common/game-display-mode'
import type {
  GeometryConfidence,
  WindowGeometryInfo,
  WindowGeometryProvider,
} from '@platform/linux/common/wayland/geometry-provider'
import type { WindowBounds } from '@platform/linux/common/wayland/window-geometry'
import {
  type HyprlandClient,
  type HyprlandMonitor,
  readHyprlandActiveWindow,
  readHyprlandClientsAsync,
  readHyprlandMonitors,
} from './ipc'

export interface HyprlandWindowInfo {
  bounds: WindowBounds
  /** Hyprland reports XWayland clients directly; absent means "not reported". */
  mode: LinuxGameDisplayMode | null
  fullscreen: boolean
  outputs: readonly string[]
  /** Stable compositor id so the tracker does not swap between windows. */
  identity?: string
  identityScore?: number
  confidence: GeometryConfidence
  /** Compact debug trace for geometry breadcrumbs. */
  detail: string
}

interface Candidate {
  readonly info: HyprlandWindowInfo
  readonly rank: number
  readonly order: number
}

interface ActiveWindow {
  readonly address?: string
}

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function validPoint(pair: [number, number] | undefined): pair is [number, number] {
  return !!pair && pair.length === 2 && pair.every((value) => typeof value === 'number' && Number.isFinite(value))
}

function modeOf(client: HyprlandClient): LinuxGameDisplayMode | null {
  if (typeof client.xwayland === 'boolean') return client.xwayland ? 'x11' : 'wayland'
  return null
}

function isFullscreen(client: HyprlandClient): boolean {
  return (client.fullscreen ?? 0) > 0 || (client.fullscreenClient ?? 0) > 0
}

/** Hyprland exposes `class` for both native app ids and XWayland WM_CLASS. */
function gameMatch(client: HyprlandClient, titles: readonly string[]): GameWindowMatch {
  return matchGameWindow(
    {
      title: client.title ?? client.initialTitle ?? null,
      appId: client.class ?? client.initialClass ?? null,
      className: client.class ?? client.initialClass ?? null,
    },
    titles,
  )
}

function detailOf(
  client: HyprlandClient,
  match: GameWindowMatch,
  bounds: WindowBounds,
  mode: LinuxGameDisplayMode | null,
  level: GeometryConfidence,
  output: string | null,
): string {
  const workspace = client.workspace?.id ?? client.workspace?.name ?? '-'
  return (
    `address=${client.address ?? '-'} title=${client.title ?? '-'} class=${client.class ?? client.initialClass ?? '-'} ` +
    `gameMode=${mode ?? '-'} xwayland=${client.xwayland ?? '-'} workspace=${workspace} ` +
    `monitor=${client.monitor ?? '-'} output=${output ?? '-'} mapped=${client.mapped !== false} ` +
    `hidden=${client.hidden === true} fullscreen=${isFullscreen(client)} confidence=${level} ` +
    `match=${match.reason} variant=${match.variant ?? '-'} score=${match.score} ` +
    `at=${client.at?.join(',') ?? '-'} size=${client.size?.join('x') ?? '-'} ` +
    `bounds=${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`
  )
}

/**
 * Parse `hyprctl -j clients` (and optionally `activewindow`/`monitors`) into
 * the exact logical geometry layer-shell needs.
 *
 * Hyprland's `at`/`size` are already global layout coordinates, so no X11
 * origin or monitor-scale conversion applies. The active window and the shared
 * matcher rank candidates; a launcher that borrowed the game title is rejected
 * before it can own the overlay.
 */
export function parseHyprlandClients(
  clientsJson: string,
  titles: readonly string[],
  activeWindowJson?: string | null,
  preferredIdentity?: string,
  monitorsJson?: string | null,
): HyprlandWindowInfo | null {
  const clients = parseJson<HyprlandClient[]>(clientsJson)
  if (!Array.isArray(clients) || !titles.length) return null

  const active = parseJson<ActiveWindow>(activeWindowJson)
  const activeAddress = active?.address || undefined
  const monitors = parseJson<HyprlandMonitor[]>(monitorsJson) ?? []
  const outputOf = (client: HyprlandClient): string | null =>
    monitors.find((monitor) => monitor.id === client.monitor)?.name ?? null

  const candidates: Candidate[] = []
  let order = 0
  for (const client of clients) {
    if (!client || typeof client !== 'object') continue
    if (!validPoint(client.at) || !validPoint(client.size)) continue
    const [x, y] = client.at
    const [width, height] = client.size
    if (width <= 0 || height <= 0) continue

    const match = gameMatch(client, titles)
    if (!match.accepted) continue

    const focused =
      (activeAddress !== undefined && activeAddress === client.address) ||
      (activeAddress === undefined && client.focusHistoryID === 0)
    const visible = client.mapped !== false && client.hidden !== true
    const level: GeometryConfidence = focused ? 'focused' : visible ? 'visible' : 'hidden'
    const mode = modeOf(client)
    const bounds = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
    const output = outputOf(client)
    const identity = client.address ? `hyprland:${client.address}` : undefined
    candidates.push({
      info: {
        bounds,
        mode,
        fullscreen: isFullscreen(client),
        outputs: output ? [output] : [],
        identity,
        identityScore: match.score,
        confidence: level,
        detail: detailOf(client, match, bounds, mode, level, output),
      },
      // Identity outranks focus, matching the other compositor providers: a
      // focused launcher can borrow the title while the real game is hidden.
      rank: match.score * 10 + (focused ? 4 : visible ? 2 : 1),
      order: order++,
    })
  }
  candidates.sort((a, b) => b.rank - a.rank || a.order - b.order)
  const pinned = preferredIdentity
    ? candidates.find((candidate) => candidate.info.identity === preferredIdentity)
    : null
  return (pinned ?? candidates[0])?.info ?? null
}

/** Alias matching the naming of the other compositor geometry parsers. */
export const parseHyprlandWindowInfo = parseHyprlandClients

let available: boolean | undefined

function hyprlandAvailable(env: PlatformEnv): boolean {
  if (available !== undefined) return available
  available = !!env.env.HYPRLAND_INSTANCE_SIGNATURE || detectDesktopEnvironment(env) === 'hyprland'
  return available
}

export async function readHyprlandWindowInfo(
  titles: readonly string[],
  env: PlatformEnv = currentEnv(),
  preferredIdentity?: string,
  onError?: (error: unknown) => void,
): Promise<HyprlandWindowInfo | null> {
  if (!titles.length || !hyprlandAvailable(env)) return null
  try {
    const [clients, active, monitors] = await Promise.all([
      readHyprlandClientsAsync(env),
      // Focus and output metadata are optional: clients alone still carry the
      // exact geometry, and a failed supplementary query must not hide it.
      readHyprlandActiveWindow(env).catch(() => null),
      readHyprlandMonitors(env).catch(() => [] as readonly HyprlandMonitor[]),
    ])
    return parseHyprlandClients(
      JSON.stringify(clients),
      titles,
      active ? JSON.stringify(active) : null,
      preferredIdentity,
      JSON.stringify(monitors),
    )
  } catch (error) {
    onError?.(error)
    return null
  }
}

export function createHyprlandGeometryProvider(env: PlatformEnv = currentEnv()): WindowGeometryProvider {
  /** Only pin a candidate Hyprland marks focused. Until then, keep re-evaluating
   *  so a stale hidden window cannot trap the overlay. */
  let pinnedIdentity: string | null = null
  let lastIdentity: string | null = null
  let lastFailure: string | null = null

  return {
    id: 'hyprland',
    reportSource: 'hyprland',
    phase: 'preferred',
    read: async (titles) => {
      const info = await readHyprlandWindowInfo(titles, env, pinnedIdentity ?? undefined, (error) => {
        const message = String(error)
        if (message === lastFailure) return
        lastFailure = message
        reportBreadcrumb(`hyprland geometry IPC failed error=${message}`, 'debug')
      })

      if (!info) {
        if (lastFailure === null) {
          lastFailure = 'no-match'
          reportBreadcrumb(`hyprland geometry no match titles=${JSON.stringify(titles)}`, 'debug')
        }
        return null
      }
      lastFailure = null

      const identity = info.identity ?? null
      if (identity !== lastIdentity) {
        lastIdentity = identity
        reportBreadcrumb(`hyprland geometry candidate ${info.detail}`, 'debug')
      }
      if (pinnedIdentity && identity !== pinnedIdentity) {
        reportBreadcrumb(`hyprland geometry pin lost old=${pinnedIdentity} new=${identity ?? '-'}`, 'debug')
        pinnedIdentity = null
      }
      // A title-only match can be a launcher borrowing the game name. Only a
      // strong identity (executable/app id/class) is safe to pin across polls.
      if (info.confidence === 'focused' && (info.identityScore ?? 0) >= 4 && identity && pinnedIdentity !== identity) {
        pinnedIdentity = identity
        reportBreadcrumb(`hyprland geometry pinned identity=${identity} score=${info.identityScore}`, 'debug')
      }
      const geometry: WindowGeometryInfo = {
        bounds: info.bounds,
        logical: true,
        mode: info.mode,
        fullscreen: info.fullscreen,
        outputs: info.outputs,
        identity: info.identity,
        identityScore: info.identityScore,
        confidence: info.confidence,
        detail: info.detail,
      }
      return geometry
    },
  }
}

/** @internal Test-only reset. */
export function __resetHyprlandAvailabilityForTests(): void {
  available = undefined
}
