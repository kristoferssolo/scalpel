import { describe, it, expect } from 'vitest'
import { buildWaystoneRegex } from './waystone-engine'
import { generateWaystoneRegex } from './__fixtures__/poe2re/WaystoneResult'
import type { SelectOption } from './__fixtures__/poe2re/SelectOption'
import type { Settings } from './__fixtures__/poe2re/Settings'
import { WAYSTONE_MODS } from '../../../../shared/data/regex/waystone-mods'

/**
 * Parity tests against poe2.re's reference implementation. We import poe2.re's
 * `generateWaystoneRegex` (copied verbatim into __fixtures__/poe2re/) and run
 * matched inputs through both engines, asserting the output strings are equal.
 *
 * This is the empirical-validation approach: rather than hand-tracing expected
 * regex outputs, we compare ours to theirs directly. Any future drift caused by
 * upstream changes or our own refactors gets caught here.
 *
 * The parity is deliberately scoped to the path our UI exercises today: prefixes
 * and suffixes are toggled on without per-mod magnitude values (i.e. SelectOption
 * `value` always null). When we add a per-mod value picker, extend these tests to
 * exercise that path too.
 */

// ----- helpers ---------------------------------------------------------------

/** Build a poe2.re-shaped Settings object with overrides. Sensible defaults
 *  match poe2.re's `defaultSettings.waystone` so untouched flags don't perturb
 *  the comparison. */
function makeSettings(overrides: {
  tierMin?: number
  tierMax?: number
  corrupted?: boolean
  uncorrupted?: boolean
  dropOverEnabled?: boolean
  dropOverValue?: number
  delirious?: boolean
  anyPack?: boolean
  prefixSelectType?: 'any' | 'all'
  prefixIds?: number[]
  suffixIds?: number[]
  customText?: string
}): Settings {
  const allMods = WAYSTONE_MODS
  const prefixes: SelectOption[] = allMods
    .filter((m) => m.affix === 'PREFIX')
    .map((m) => ({
      name: m.text,
      value: null,
      isSelected: (overrides.prefixIds ?? []).includes(m.id),
      ranges: m.ranges,
      regex: m.regex,
    }))
  const suffixes: SelectOption[] = allMods
    .filter((m) => m.affix === 'SUFFIX')
    .map((m) => ({
      name: m.text,
      value: null,
      isSelected: (overrides.suffixIds ?? []).includes(m.id),
      ranges: m.ranges,
      regex: m.regex,
    }))
  return {
    waystone: {
      resultSettings: { customText: overrides.customText ?? '', autoCopy: false },
      tier: { min: overrides.tierMin ?? 1, max: overrides.tierMax ?? 16 },
      rarity: {
        corrupted: overrides.corrupted ?? false,
        uncorrupted: overrides.uncorrupted ?? false,
      },
      modifier: {
        over100: false,
        round10: false,
        dropOverX: overrides.dropOverEnabled ?? false,
        dropOverValue: overrides.dropOverValue ?? 100,
        delirious: overrides.delirious ?? false,
        anyPack: overrides.anyPack ?? false,
        prefixSelectType: overrides.prefixSelectType ?? 'any',
        prefixes,
        suffixes,
      },
    },
  }
}

/** Run the equivalent inputs through our engine. */
function ours(overrides: Parameters<typeof makeSettings>[0]): string {
  return buildWaystoneRegex({
    mods: WAYSTONE_MODS,
    tier: { min: overrides.tierMin ?? 1, max: overrides.tierMax ?? 16 },
    rarity: {
      corrupted: overrides.corrupted ?? false,
      uncorrupted: overrides.uncorrupted ?? false,
    },
    qualifiers: {
      dropOverEnabled: overrides.dropOverEnabled ?? false,
      dropOverValue: overrides.dropOverValue ?? 100,
      delirious: overrides.delirious ?? false,
      anyPack: overrides.anyPack ?? false,
    },
    selections: {
      want: new Set(overrides.prefixIds ?? []),
      avoid: new Set(overrides.suffixIds ?? []),
      wantMode: overrides.prefixSelectType ?? 'any',
    },
    customText: overrides.customText,
  })
}

function theirs(overrides: Parameters<typeof makeSettings>[0]): string {
  return generateWaystoneRegex(makeSettings(overrides))
}

// ----- mod id lookups (so test cases stay readable) --------------------------

function findId(textIncludes: string, affix: 'PREFIX' | 'SUFFIX'): number {
  const m = WAYSTONE_MODS.find(
    (mod) => mod.affix === affix && mod.text.toLowerCase().includes(textIncludes.toLowerCase()),
  )
  if (!m) throw new Error(`No ${affix} mod containing "${textIncludes}"`)
  return m.id
}

const FIRE = findId('Extra Fire', 'PREFIX')
const ENFEEBLE = findId('Enfeeble', 'PREFIX')
const BLEEDING = findId('Bleeding', 'SUFFIX')
const STUN = findId('Stun Buildup', 'SUFFIX')

// ----- parity table ----------------------------------------------------------

interface Case {
  label: string
  args: Parameters<typeof makeSettings>[0]
}

const CASES: Case[] = [
  // Empty / no-op cases
  { label: 'all defaults (no filter)', args: {} },
  { label: 'full tier 1-16 is no-op', args: { tierMin: 1, tierMax: 16 } },
  { label: 'tier 0/0 is no-op', args: { tierMin: 0, tierMax: 0 } },

  // Tier slicing
  { label: 'tier 2-16 (user example)', args: { tierMin: 2, tierMax: 16, prefixIds: [FIRE, ENFEEBLE] } },
  { label: 'tier 1-10 (no over-10 chunk)', args: { tierMin: 1, tierMax: 10 } },
  { label: 'tier 5-10 (single under-10 range)', args: { tierMin: 5, tierMax: 10 } },
  { label: 'tier 12-15 (only over-10 chunk)', args: { tierMin: 12, tierMax: 15 } },
  { label: 'tier 16-16 (single value)', args: { tierMin: 16, tierMax: 16 } },
  { label: 'tier 8-9 (two-value under-10)', args: { tierMin: 8, tierMax: 9 } },
  { label: 'tier 7-13 (spans the boundary)', args: { tierMin: 7, tierMax: 13 } },

  // Rarity
  { label: 'corrupted only', args: { corrupted: true } },
  { label: 'uncorrupted only', args: { uncorrupted: true } },
  { label: 'both rarity (no-op)', args: { corrupted: true, uncorrupted: true } },

  // Prefixes (any vs all)
  { label: 'one prefix any', args: { prefixIds: [FIRE], prefixSelectType: 'any' } },
  { label: 'two prefixes any', args: { prefixIds: [FIRE, ENFEEBLE], prefixSelectType: 'any' } },
  { label: 'one prefix all', args: { prefixIds: [FIRE], prefixSelectType: 'all' } },
  { label: 'two prefixes all', args: { prefixIds: [FIRE, ENFEEBLE], prefixSelectType: 'all' } },

  // Suffixes
  { label: 'one suffix', args: { suffixIds: [BLEEDING] } },
  { label: 'two suffixes', args: { suffixIds: [BLEEDING, STUN] } },

  // Mixed prefix + suffix
  {
    label: 'prefix + suffix any',
    args: { prefixIds: [FIRE], suffixIds: [BLEEDING], prefixSelectType: 'any' },
  },
  {
    label: 'prefix + suffix all',
    args: { prefixIds: [FIRE, ENFEEBLE], suffixIds: [BLEEDING], prefixSelectType: 'all' },
  },

  // goodSpecial qualifiers (any/all variants)
  { label: 'delirious only', args: { delirious: true } },
  { label: 'anyPack only', args: { anyPack: true } },
  { label: 'dropOver 200%', args: { dropOverEnabled: true, dropOverValue: 200 } },
  { label: 'dropOver 700%', args: { dropOverEnabled: true, dropOverValue: 700 } },
  {
    label: 'all goodSpecial any',
    args: { delirious: true, anyPack: true, dropOverEnabled: true, dropOverValue: 300, prefixSelectType: 'any' },
  },
  {
    label: 'all goodSpecial all',
    args: { delirious: true, anyPack: true, dropOverEnabled: true, dropOverValue: 300, prefixSelectType: 'all' },
  },
  {
    label: 'goodSpecial + prefix any',
    args: { delirious: true, prefixIds: [FIRE], prefixSelectType: 'any' },
  },
  {
    label: 'goodSpecial + prefix all',
    args: { delirious: true, anyPack: true, prefixIds: [FIRE, ENFEEBLE], prefixSelectType: 'all' },
  },

  // Combined kitchen sink
  {
    label: 'tier + rarity + good + bad + special (any)',
    args: {
      tierMin: 5,
      tierMax: 12,
      corrupted: true,
      delirious: true,
      anyPack: true,
      dropOverEnabled: true,
      dropOverValue: 200,
      prefixIds: [FIRE, ENFEEBLE],
      suffixIds: [BLEEDING, STUN],
      prefixSelectType: 'any',
    },
  },
  {
    label: 'tier + rarity + good + bad + special (all)',
    args: {
      tierMin: 4,
      tierMax: 11,
      uncorrupted: true,
      delirious: true,
      dropOverEnabled: true,
      dropOverValue: 500,
      prefixIds: [FIRE],
      suffixIds: [BLEEDING],
      prefixSelectType: 'all',
    },
  },

  // Custom text
  { label: 'custom text only', args: { customText: 'foo' } },
  { label: 'custom text + tier', args: { tierMin: 2, tierMax: 16, customText: 'bar' } },
]

describe('waystone-engine: parity with poe2.re reference implementation', () => {
  for (const c of CASES) {
    it(c.label, () => {
      expect(ours(c.args)).toBe(theirs(c.args))
    })
  }

  it('user-reported case: tier 2-16 + fire + enfeeble matches poe2.re exactly', () => {
    const args = { tierMin: 2, tierMax: 16, prefixIds: [FIRE, ENFEEBLE] }
    const expected = '"r [2-9]\\)|1[0123456]\\)" "fire$|eble"'
    expect(theirs(args)).toBe(expected)
    expect(ours(args)).toBe(expected)
  })
})
