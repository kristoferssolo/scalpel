import { describe, expect, it } from 'vitest'
import { PANEL_SAMPLES } from './panel-samples'

describe('PANEL_SAMPLES', () => {
  it('PoE1 has 4 left and 4 right indicators', () => {
    const t = PANEL_SAMPLES[1]
    expect(t).not.toBeNull()
    expect(t?.filter((s) => s.side === 'left')).toHaveLength(4)
    expect(t?.filter((s) => s.side === 'right')).toHaveLength(4)
  })

  it('PoE2 has >=2 left and >=2 right indicators (enough for the >=2-of-N vote)', () => {
    const t = PANEL_SAMPLES[2]
    expect(t).not.toBeNull()
    expect((t ?? []).filter((s) => s.side === 'left').length).toBeGreaterThanOrEqual(2)
    expect((t ?? []).filter((s) => s.side === 'right').length).toBeGreaterThanOrEqual(2)
  })
})
