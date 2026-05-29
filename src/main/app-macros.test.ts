import { beforeEach, describe, expect, it, vi } from 'vitest'

// app-macros.ts imports setAppMacros from ./hotkeys which pulls in Electron;
// mock it at the module boundary so the test stays in Node.
vi.mock('./hotkeys', () => ({
  setAppMacros: vi.fn(),
}))

import { withPluginHotkeys } from './app-macros'
import { _resetForTests, setPluginHotkey, setPluginOverlayHotkey } from './plugins/hotkey-registry'

describe('withPluginHotkeys', () => {
  beforeEach(() => {
    _resetForTests()
  })

  it('appends stub rows for both action and overlay hotkeys', () => {
    setPluginHotkey('my-plugin', 'Action Label')
    setPluginOverlayHotkey('my-plugin', 'Overlay Label')

    const result = withPluginHotkeys([])

    const actions = result.map((r) => r.action)
    expect(actions).toContain('plugin:my-plugin')
    expect(actions).toContain('plugin-overlay:my-plugin')
  })

  it('does not duplicate rows already present in the macro list', () => {
    setPluginHotkey('existing', 'Label')
    setPluginOverlayHotkey('existing', 'Overlay Label')

    const result = withPluginHotkeys([
      { action: 'plugin:existing', hotkey: 'F1' },
      { action: 'plugin-overlay:existing', hotkey: 'F2' },
    ])

    const actionCounts = result.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1
      return acc
    }, {})
    expect(actionCounts['plugin:existing']).toBe(1)
    expect(actionCounts['plugin-overlay:existing']).toBe(1)
  })
})
