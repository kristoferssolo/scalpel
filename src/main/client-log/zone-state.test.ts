import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../game-state', () => ({
  getPoeVersion: vi.fn(() => 1 as 1 | 2),
}))

import { getPoeVersion } from '../game-state'
import { getCurrentZone, onZoneChanged, ingestZoneEvent, _resetForTests } from './zone-state'

describe('zone-state', () => {
  beforeEach(() => {
    _resetForTests()
    vi.mocked(getPoeVersion).mockReturnValue(1)
  })

  it('starts with null current zone', () => {
    expect(getCurrentZone()).toBeNull()
  })

  it('stores and exposes a real-zone event', () => {
    ingestZoneEvent({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
    expect(getCurrentZone()).toEqual({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
  })

  it('clears current zone on town/hideout event', () => {
    ingestZoneEvent({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
    ingestZoneEvent({ areaLevel: 1, areaCode: 'HideoutLuxurious' })
    expect(getCurrentZone()).toBeNull()
  })

  it('emits to subscribers on real zone change', () => {
    const cb = vi.fn()
    onZoneChanged(cb)
    ingestZoneEvent({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
  })

  it('emits null to subscribers on town/hideout', () => {
    const cb = vi.fn()
    onZoneChanged(cb)
    ingestZoneEvent({ areaLevel: 1, areaCode: '3_town' })
    expect(cb).toHaveBeenCalledWith(null)
  })

  it('unsubscribe stops further emissions', () => {
    const cb = vi.fn()
    const off = onZoneChanged(cb)
    off()
    ingestZoneEvent({ areaLevel: 68, areaCode: 'MapWorldsAtoll' })
    expect(cb).not.toHaveBeenCalled()
  })

  it('uses game-state to pick the right town list', () => {
    vi.mocked(getPoeVersion).mockReturnValue(2)
    ingestZoneEvent({ areaLevel: 1, areaCode: 'G1_town' })
    expect(getCurrentZone()).toBeNull()
  })
})
