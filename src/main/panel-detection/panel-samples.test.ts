import { describe, expect, it } from 'vitest'
import { PANEL_SAMPLES } from './panel-samples'

describe('PANEL_SAMPLES', () => {
  it('PoE1 has 4 left and 4 right indicators', () => {
    const t = PANEL_SAMPLES[1]
    expect(t).not.toBeNull()
    expect(t?.filter((s) => s.side === 'left')).toHaveLength(4)
    expect(t?.filter((s) => s.side === 'right')).toHaveLength(4)
  })

  it('PoE2 is null (uncalibrated -> detector stays idle)', () => {
    expect(PANEL_SAMPLES[2]).toBeNull()
  })
})
