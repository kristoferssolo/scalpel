import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetForTests,
  addLogLineSubscriberRef,
  getRecentLogLines,
  hasLogLineSubscribers,
  pushLogLine,
  removeLogLineSubscriberRef,
} from './tail-buffer'

describe('tail-buffer', () => {
  afterEach(() => _resetForTests())

  it('returns buffered lines in order', () => {
    pushLogLine('a')
    pushLogLine('b')
    expect(getRecentLogLines()).toEqual(['a', 'b'])
  })

  it('caps the buffer at 200 lines, dropping oldest', () => {
    for (let i = 0; i < 250; i++) pushLogLine(`line-${i}`)
    const lines = getRecentLogLines()
    expect(lines).toHaveLength(200)
    expect(lines[0]).toBe('line-50')
    expect(lines[199]).toBe('line-249')
  })

  it('getRecentLogLines(n) returns only the last n', () => {
    for (let i = 0; i < 10; i++) pushLogLine(`l${i}`)
    expect(getRecentLogLines(3)).toEqual(['l7', 'l8', 'l9'])
  })

  it('ref-count gates hasLogLineSubscribers', () => {
    expect(hasLogLineSubscribers()).toBe(false)
    addLogLineSubscriberRef()
    addLogLineSubscriberRef()
    expect(hasLogLineSubscribers()).toBe(true)
    removeLogLineSubscriberRef()
    expect(hasLogLineSubscribers()).toBe(true)
    removeLogLineSubscriberRef()
    expect(hasLogLineSubscribers()).toBe(false)
  })

  it('ref-count never goes negative', () => {
    removeLogLineSubscriberRef()
    expect(hasLogLineSubscribers()).toBe(false)
  })
})
