// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyPalette, applyCachedVars, bootstrapTheme, THEME_CACHE_KEY } from './apply-theme'
import { DEFAULT_PALETTE, PRESETS_BY_ID } from '../../../shared/theme/presets'
import { resolveCssVars } from '../../../shared/theme/derive'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})

describe('applyPalette', () => {
  it('sets every resolved var on documentElement and caches it', () => {
    applyPalette(PRESETS_BY_ID['abyssal'].palette)
    const expected = resolveCssVars(PRESETS_BY_ID['abyssal'].palette)
    for (const [k, v] of Object.entries(expected)) {
      expect(document.documentElement.style.getPropertyValue(k)).toBe(v)
    }
    expect(JSON.parse(localStorage.getItem(THEME_CACHE_KEY)!)).toEqual(expected)
  })
})

describe('applyCachedVars', () => {
  it('applies a previously cached var map', () => {
    const map = resolveCssVars(DEFAULT_PALETTE)
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(map))
    applyCachedVars()
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(map['--accent'])
  })

  it('no-ops with no cache and bad json', () => {
    expect(() => applyCachedVars()).not.toThrow()
    localStorage.setItem(THEME_CACHE_KEY, 'not json')
    expect(() => applyCachedVars()).not.toThrow()
  })
})

describe('bootstrapTheme', () => {
  it('applies the resolved settings palette and re-applies on setting-updated', async () => {
    let updatedCb: ((key: string, value: unknown) => void) | undefined
    ;(window as unknown as { api: unknown }).api = {
      getSettings: vi.fn().mockResolvedValue({ themeId: 'abyssal', customThemePalette: null }),
      onSettingUpdated: (cb: (k: string, v: unknown) => void) => {
        updatedCb = cb
        return () => {}
      },
    }

    await bootstrapTheme()
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(
      resolveCssVars(PRESETS_BY_ID['abyssal'].palette)['--accent'],
    )

    updatedCb!('themeId', 'mono')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(
      resolveCssVars(PRESETS_BY_ID['mono'].palette)['--accent'],
    )
  })
})
