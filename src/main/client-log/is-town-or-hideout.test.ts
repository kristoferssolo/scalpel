import { describe, it, expect } from 'vitest'
import { isTownOrHideout } from './is-town-or-hideout'

describe('isTownOrHideout', () => {
  describe('hideouts', () => {
    it('matches personal hideout', () => {
      expect(isTownOrHideout('HideoutLuxurious', 1)).toBe(true)
      expect(isTownOrHideout('HideoutLuxurious', 2)).toBe(true)
    })

    it('matches guild hideout', () => {
      expect(isTownOrHideout('GuildHideout', 1)).toBe(true)
    })

    it('matches case-insensitively', () => {
      expect(isTownOrHideout('foohideoutbar', 1)).toBe(true)
    })
  })

  describe('PoE1 towns', () => {
    it.each([
      '1_1_town',
      '1_2_town',
      '2_1_town',
      '3_town',
      '4_town',
      '5_town',
      '6_town',
      '7_town',
      '8_town',
      '9_town',
      '10_town',
      'EpilogueTown',
    ])('matches %s', (code) => {
      expect(isTownOrHideout(code, 1)).toBe(true)
    })

    it('does not match PoE1 town codes when checking against PoE2', () => {
      expect(isTownOrHideout('1_1_town', 2)).toBe(false)
    })
  })

  describe('PoE2 towns', () => {
    it.each(['G1_town', 'G2_town', 'G3_town', 'C_G1_town', 'C_G2_town', 'C_G3_town'])('matches %s', (code) => {
      expect(isTownOrHideout(code, 2)).toBe(true)
    })
  })

  describe('real zones', () => {
    it('does not match a campaign zone', () => {
      expect(isTownOrHideout('1_1_1', 1)).toBe(false)
      expect(isTownOrHideout('G1_1_2', 2)).toBe(false)
    })

    it('does not match a map zone', () => {
      expect(isTownOrHideout('MapWorldsAtoll', 1)).toBe(false)
    })

    it('safe-fails to false on unknown codes', () => {
      expect(isTownOrHideout('SomeUnknownCode', 1)).toBe(false)
      expect(isTownOrHideout('', 1)).toBe(false)
    })
  })
})
