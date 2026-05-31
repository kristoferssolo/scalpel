import { describe, expect, it } from 'vitest'
import type Store from 'electron-store'
import type { AppSettings } from '../shared/types'
import { DEFAULT_APP_SETTINGS, backfillAppSettings } from './settings-defaults'

function makeStore(initial: Record<string, unknown>): Store<AppSettings> {
  const data = { ...initial }
  return {
    get: (key: keyof AppSettings) => data[key],
    set: (key: keyof AppSettings, value: unknown) => {
      data[key] = value
    },
  } as unknown as Store<AppSettings>
}

describe('settings defaults', () => {
  it('defaults mainPanelMode to overlay', () => {
    expect(DEFAULT_APP_SETTINGS.mainPanelMode).toBe('overlay')
  })

  it('backfills missing mainPanelMode', () => {
    const store = makeStore({})

    backfillAppSettings(store)

    expect(store.get('mainPanelMode')).toBe('overlay')
  })
})
