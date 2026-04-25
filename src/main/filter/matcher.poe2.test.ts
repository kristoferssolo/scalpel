import { describe, it, expect } from 'vitest'
import { evaluatePoe2Condition } from './matcher.poe2'
import type { PoeItem, FilterCondition } from '../../shared/types'

function makeItem(overrides: Partial<PoeItem> = {}): PoeItem {
  return {
    itemClass: 'Rings',
    rarity: 'Rare',
    name: '',
    baseType: 'Ruby Ring',
    mapTier: 0,
    itemLevel: 75,
    quality: 0,
    sockets: '',
    linkedSockets: 0,
    armour: 0,
    evasion: 0,
    energyShield: 0,
    ward: 0,
    block: 0,
    reqStr: 0,
    reqDex: 0,
    reqInt: 0,
    corrupted: false,
    identified: true,
    mirrored: false,
    synthesised: false,
    fractured: false,
    transfigured: false,
    blighted: false,
    scourged: false,
    zanaMemory: false,
    implicitCount: 0,
    gemLevel: 0,
    stackSize: 1,
    influence: [],
    explicits: [],
    implicits: [],
    enchants: [],
    imbues: [],
    ...overrides,
  } as PoeItem
}

function cond(type: string, values: string[], operator: FilterCondition['operator'] = '='): FilterCondition {
  return { type, operator, values }
}

describe('evaluatePoe2Condition', () => {
  it('returns "unknown" for unknown condition types so the engine doesn\'t poison or auto-pass blocks', () => {
    expect(evaluatePoe2Condition(cond('SomeRandomCondition', ['True']), makeItem())).toBe('unknown')
  })

  // The following conditions were declared ahead of parser support; until
  // clipboard.ts populates the underlying flags the matcher must report
  // 'unknown' rather than hardcoding 'false', otherwise "X False" filter rules
  // silently match every item.
  it('returns "unknown" for IsVaalUnique (parser does not surface the flag yet)', () => {
    expect(evaluatePoe2Condition(cond('IsVaalUnique', ['True']), makeItem())).toBe('unknown')
    expect(evaluatePoe2Condition(cond('IsVaalUnique', ['False']), makeItem())).toBe('unknown')
  })

  it('returns "unknown" for HasVaalUniqueMod', () => {
    expect(evaluatePoe2Condition(cond('HasVaalUniqueMod', ['True']), makeItem())).toBe('unknown')
  })

  it('returns "unknown" for TwiceCorrupted', () => {
    expect(evaluatePoe2Condition(cond('TwiceCorrupted', ['True']), makeItem())).toBe('unknown')
  })

  describe('UnidentifiedItemTier', () => {
    it('returns "unknown" when the field isn\'t populated', () => {
      expect(evaluatePoe2Condition(cond('UnidentifiedItemTier', ['1'], '>='), makeItem())).toBe('unknown')
    })

    it('compares numerically when the field is set', () => {
      const item = makeItem({ unidentifiedItemTier: 3 })
      expect(evaluatePoe2Condition(cond('UnidentifiedItemTier', ['2'], '>='), item)).toBe('pass')
      expect(evaluatePoe2Condition(cond('UnidentifiedItemTier', ['5'], '>='), item)).toBe('fail')
      expect(evaluatePoe2Condition(cond('UnidentifiedItemTier', ['3'], '='), item)).toBe('pass')
    })
  })
})
