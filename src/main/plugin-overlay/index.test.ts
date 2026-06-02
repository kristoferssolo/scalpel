import { beforeEach, describe, expect, it, vi } from 'vitest'

const registered: Array<{ id: string; htmlEntry: string }> = []
const fakeOverlay = {
  show: vi.fn(),
  hide: vi.fn(),
  toggle: vi.fn(),
  isVisible: vi.fn(() => false),
  send: vi.fn(),
  getWindow: vi.fn(() => null),
  setBoundsProgrammatic: vi.fn(),
  setSizeProgrammatic: vi.fn(),
  hideKeepingRestore: vi.fn(),
}

vi.mock('../windowing', () => ({
  registerSecondaryOverlay: (spec: { id: string; htmlEntry: string }) => {
    registered.push({ id: spec.id, htmlEntry: spec.htmlEntry })
    return fakeOverlay
  },
}))
vi.mock('../client-log', () => ({
  forwardLogLinesTo: vi.fn(),
  onZoneChanged: vi.fn(),
  sendCurrentZoneTo: vi.fn(),
}))

import { _resetForTests, getPluginOverlay, registerPluginOverlay, togglePluginOverlay } from '../plugin-overlay'

describe('plugin-overlay registry', () => {
  beforeEach(() => {
    _resetForTests()
    registered.length = 0
    vi.clearAllMocks()
  })

  it('registers a secondary overlay keyed by plugin id with the shared html entry', () => {
    registerPluginOverlay('demo', { title: 'Demo' })
    expect(registered).toEqual([{ id: 'plugin-overlay:demo', htmlEntry: 'plugin-overlay.html' }])
  })

  it('is idempotent per plugin id', () => {
    registerPluginOverlay('demo2', { title: 'Demo2' })
    registerPluginOverlay('demo2', { title: 'Demo2' })
    expect(registered.filter((r) => r.id === 'plugin-overlay:demo2')).toHaveLength(1)
  })

  it('toggle is a no-op when the plugin has no registered overlay', () => {
    expect(() => togglePluginOverlay('never-registered')).not.toThrow()
  })

  it('toggle calls through to the overlay handle', () => {
    registerPluginOverlay('demo3', { title: 'Demo3' })
    togglePluginOverlay('demo3')
    expect(fakeOverlay.toggle).toHaveBeenCalled()
  })

  it('exposes the overlay handle via getPluginOverlay', () => {
    registerPluginOverlay('demo4', { title: 'Demo4' })
    expect(getPluginOverlay('demo4')).toBe(fakeOverlay)
    expect(getPluginOverlay('nope')).toBeNull()
  })
})
