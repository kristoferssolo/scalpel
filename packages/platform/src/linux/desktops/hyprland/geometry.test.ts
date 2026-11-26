import { describe, expect, it } from 'vitest'
import { createHyprlandGeometryProvider, parseHyprlandClients } from './geometry'
import type { HyprlandClient } from './ipc'

const TITLES = ['Path of Exile', 'Path of Exile 2']
const MONITORS = JSON.stringify([{ id: 1, name: 'DP-2', x: 1920, y: 0, width: 2560, height: 1440, scale: 1.6 }])

const client = (overrides: Partial<HyprlandClient> = {}): HyprlandClient => ({
  address: '0x1',
  mapped: true,
  hidden: false,
  at: [2400, 0],
  size: [2400, 1350],
  workspace: { id: 2, name: '2' },
  floating: false,
  monitor: 1,
  class: 'pathofexilesteam.exe',
  title: 'Path of Exile 2',
  xwayland: false,
  fullscreen: 0,
  ...overrides,
})

const json = (clients: HyprlandClient[]): string => JSON.stringify(clients)
const active = (entry: HyprlandClient | null): string | null => (entry ? JSON.stringify(entry) : null)

describe('parseHyprlandClients', () => {
  it('uses Hyprland layout coordinates directly as logical bounds', () => {
    const game = client()
    const info = parseHyprlandClients(json([game]), TITLES, active(game), undefined, MONITORS)
    expect(info).toMatchObject({
      bounds: { x: 2400, y: 0, width: 2400, height: 1350 },
      mode: 'wayland',
      fullscreen: false,
      outputs: ['DP-2'],
      identity: 'hyprland:0x1',
      identityScore: 5,
      confidence: 'focused',
    })
    expect(info?.detail).toContain('gameMode=wayland')
    expect(info?.detail).toContain('variant=2')
  })

  it('reports an XWayland game as X11 and a fullscreen client', () => {
    const game = client({ xwayland: true, fullscreen: 2 })
    const info = parseHyprlandClients(json([game]), TITLES, active(game))
    expect(info).toMatchObject({ mode: 'x11', fullscreen: true })
    expect(info?.detail).toContain('gameMode=x11')
  })

  it('derives focus from the active window and falls back to focusHistoryID', () => {
    const focused = client({ address: '0x2', at: [10, 20], focusHistoryID: 0 })
    const other = client({ address: '0x1', at: [300, 200], focusHistoryID: 1 })
    const info = parseHyprlandClients(json([other, focused]), TITLES, active(focused))
    expect(info?.identity).toBe('hyprland:0x2')
    expect(info?.confidence).toBe('focused')

    const fromHistory = client({ focusHistoryID: 0 })
    expect(parseHyprlandClients(json([fromHistory]), TITLES, null)?.confidence).toBe('focused')
  })

  it('prefers a visible window over a hidden or unmapped one', () => {
    const hidden = client({ address: '0x1', hidden: true, at: [0, 0] })
    const unmapped = client({ address: '0x2', mapped: false, at: [30, 40] })
    const visible = client({ address: '0x3', at: [50, 60] })
    const info = parseHyprlandClients(json([hidden, unmapped, visible]), TITLES, null)
    expect(info).toMatchObject({ identity: 'hyprland:0x3', confidence: 'visible' })
  })

  it('rejects launcher windows that borrowed the game title', () => {
    const steam = client({ class: 'steam', title: 'Path of Exile 2' })
    expect(parseHyprlandClients(json([steam]), TITLES, active(steam))).toBeNull()
  })

  it('keeps a preferred identity even when another matching window is focused', () => {
    const windowed = client({ address: '0x72', at: [2661, 579], size: [842, 601] })
    const fullscreen = client({ address: '0x110', at: [0, 0], size: [2560, 1440], fullscreen: 2 })
    expect(
      parseHyprlandClients(json([fullscreen, windowed]), TITLES, active(fullscreen), 'hyprland:0x72'),
    ).toMatchObject({
      identity: 'hyprland:0x72',
      bounds: { x: 2661, y: 579, width: 842, height: 601 },
    })
  })

  it('returns null for invalid JSON, missing geometry and unrelated windows', () => {
    expect(parseHyprlandClients('not json', TITLES, null)).toBeNull()
    expect(parseHyprlandClients(json([client({ size: [0, 100] })]), TITLES, null)).toBeNull()
    expect(parseHyprlandClients(json([client({ title: 'Other app', class: 'other' })]), TITLES, null)).toBeNull()
    expect(parseHyprlandClients(json([client()]), [], null)).toBeNull()
  })
})

describe('createHyprlandGeometryProvider', () => {
  it('runs before the title-only X11 geometry hook', () => {
    const provider = createHyprlandGeometryProvider()
    expect(provider.phase).toBe('preferred')
    expect(provider.reportSource).toBe('hyprland')
    expect(provider.id).toBe('hyprland')
  })
})
