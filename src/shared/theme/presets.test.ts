import { describe, it, expect } from 'vitest'
import { PRESETS, PRESETS_BY_ID, DEFAULT_PALETTE } from './presets'
import type { ThemePalette } from './palette'

const KEYS: Array<keyof ThemePalette> = [
  'bgSolid',
  'bgCard',
  'accent',
  'match',
  'secondaryMatch',
  'text',
  'textDim',
  'border',
  'danger',
  'warn',
  'dangerBg',
  'hideColor',
  'showColor',
  'minimalColor',
]
const HEX = /^#[0-9a-f]{6}$/

describe('presets', () => {
  it('ships a default preset whose palette is DEFAULT_PALETTE', () => {
    const def = PRESETS_BY_ID['default']
    expect(def).toBeDefined()
    expect(def.palette).toEqual(DEFAULT_PALETTE)
  })

  it('every preset has all 14 keys with valid lowercase hex', () => {
    for (const preset of PRESETS) {
      for (const k of KEYS) {
        expect(preset.palette[k], `${preset.id}.${k}`).toMatch(HEX)
      }
      expect(Object.keys(preset.palette).sort()).toEqual([...KEYS].sort())
    }
  })

  it('preset ids are unique and PRESETS_BY_ID is consistent', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of PRESETS) expect(PRESETS_BY_ID[p.id]).toBe(p)
  })
})
