import { describe, it, expect } from 'vitest'
import { getTrendDirection } from './price-trend'

describe('getTrendDirection', () => {
  it("returns 'up' when the last entry exceeds the threshold", () => {
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, 16])).toBe('up')
  })

  it("returns 'down' when the last entry is below the negative threshold", () => {
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, -16])).toBe('down')
  })

  it("returns 'flat' when the last entry is within the threshold band", () => {
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, 5])).toBe('flat')
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, -5])).toBe('flat')
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, 15])).toBe('flat')
    expect(getTrendDirection([0, 0, 0, 0, 0, 0, -15])).toBe('flat')
  })

  it("returns 'flat' when graph is undefined", () => {
    expect(getTrendDirection(undefined)).toBe('flat')
  })

  it("returns 'flat' when graph is empty", () => {
    expect(getTrendDirection([])).toBe('flat')
  })

  it("returns 'flat' when the last entry is null", () => {
    expect(getTrendDirection([10, 20, null])).toBe('flat')
  })
})
