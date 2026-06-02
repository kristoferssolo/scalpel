import { describe, it, expect } from 'vitest'
import { scrubAccumulate, snapToStep } from './scrub-math'

describe('scrubAccumulate', () => {
  it('moves slowly for small magnitudes', () => {
    // magnitude 0 -> speed 0.5, step 1: dx 30 -> +30*0.5*1/3 = +5
    expect(scrubAccumulate(0, 30, 1)).toBeCloseTo(5)
  })
  it('moves faster for large magnitudes', () => {
    // magnitude 1000 -> speed 5: dx 30 -> +30*5*1/3 = +50
    expect(scrubAccumulate(1000, 30, 1)).toBeCloseTo(1050)
  })
  it('honors fractional step', () => {
    // magnitude 0 -> speed 0.5, step 0.1: dx 30 -> +30*0.5*0.1/3 = +0.5
    expect(scrubAccumulate(0, 30, 0.1)).toBeCloseTo(0.5)
  })
})

describe('snapToStep', () => {
  it('removes floating-point junk from fractional steps', () => {
    expect(snapToStep(1.45000001, 0.1, 1)).toBeCloseTo(1.5)
  })
  it('rounds to the nearest step for integer steps', () => {
    expect(snapToStep(63.7, 1, 0)).toBe(64)
  })
})
