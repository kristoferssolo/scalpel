import { describe, expect, it } from 'vitest'
import type { RuntimeSettings } from '../../../shared/types'
import { getStandaloneStartupView } from './App'

describe('standalone overlay startup view', () => {
  it('uses no-filter when there is no active filter path', () => {
    const settings = { activeProfile: null } as unknown as RuntimeSettings

    expect(getStandaloneStartupView(settings)).toBe('no-filter')
  })

  it('uses no-item when an active filter path exists', () => {
    const settings = { activeProfile: { filterPath: '/tmp/example.filter' } } as unknown as RuntimeSettings

    expect(getStandaloneStartupView(settings)).toBe('no-item')
  })
})
