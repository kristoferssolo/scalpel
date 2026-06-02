import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'
import { setPoeVersion } from './state'

const mockPerformGameSwitch = vi.fn()

vi.mock('./context', () => ({
  performGameSwitch: (s: Store<AppSettings>, t: GameVariant) => mockPerformGameSwitch(s, t),
  switchGameContext: () => {
    throw new Error('unit tests must use performGameSwitch for broadcast coverage')
  },
}))

const mockDetectFocused = vi.fn<() => Promise<GameVariant | null>>()

vi.mock('./detector', () => ({
  detectFocusedPoeVersion: () => mockDetectFocused(),
  isPoeWindowTitle: (t: string) => t === 'Path of Exile' || t === 'Path of Exile 2',
  titleToVariant: (t: string) => (t === 'Path of Exile 2' ? 2 : t === 'Path of Exile' ? 1 : null),
  detectOpenPoeWindows: async () => [],
}))

function makeStore(initial: Record<string, unknown>): Store<AppSettings> {
  const data: Record<string, unknown> = { ...initial }
  return {
    get: (key: string) => data[key],
    set: (key: string, value: unknown) => {
      data[key] = value
    },
    store: data,
  } as unknown as Store<AppSettings>
}

// The watcher polls every 500ms. Use a step just over that to trigger one cycle.
const POLL_STEP_MS = 510

// Use fake timers so we control when the interval fires
describe('auto game watcher', () => {
  beforeEach(async () => {
    const { _resetWatcherForTesting } = await import('./watcher')
    _resetWatcherForTesting()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(Date.now())
    mockPerformGameSwitch.mockReset()
    mockDetectFocused.mockReset()
    setPoeVersion(1)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not switch when focused window is not a PoE title', async () => {
    const { startAutoGameWatcher, isAutoGameWatcherRunning } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })

    mockDetectFocused.mockResolvedValue(null)
    startAutoGameWatcher(store)
    expect(isAutoGameWatcherRunning()).toBe(true)

    await vi.advanceTimersByTimeAsync(POLL_STEP_MS)
    expect(mockPerformGameSwitch).not.toHaveBeenCalled()
  })

  it('does not switch when focused version matches current version', async () => {
    const { startAutoGameWatcher } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })
    setPoeVersion(1)

    mockDetectFocused.mockResolvedValue(1)
    startAutoGameWatcher(store)

    await vi.advanceTimersByTimeAsync(POLL_STEP_MS)
    expect(mockPerformGameSwitch).not.toHaveBeenCalled()
  })

  it('switches when focused version differs from current version', async () => {
    const { startAutoGameWatcher } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })
    setPoeVersion(1)

    mockDetectFocused.mockResolvedValue(2)
    startAutoGameWatcher(store)

    await vi.advanceTimersByTimeAsync(POLL_STEP_MS)
    expect(mockPerformGameSwitch).toHaveBeenCalledTimes(1)
    expect(mockPerformGameSwitch).toHaveBeenCalledWith(store, 2)
  })

  it('debounces: does not switch again within cooldown', async () => {
    const { startAutoGameWatcher } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })
    setPoeVersion(1)

    // First switch: PoE2 focused
    mockDetectFocused.mockResolvedValue(2)
    startAutoGameWatcher(store)
    await vi.advanceTimersByTimeAsync(POLL_STEP_MS)
    expect(mockPerformGameSwitch).toHaveBeenCalledTimes(1)

    // Update state so it looks like we're now on PoE2
    setPoeVersion(2)

    // Immediately focus PoE1 — but within 1s cooldown
    mockDetectFocused.mockResolvedValue(1)
    await vi.advanceTimersByTimeAsync(POLL_STEP_MS) // within cooldown
    expect(mockPerformGameSwitch).toHaveBeenCalledTimes(1) // still 1

    // After cooldown, should switch
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockPerformGameSwitch).toHaveBeenCalledTimes(2)
    expect(mockPerformGameSwitch).toHaveBeenLastCalledWith(store, 1)
  })

  it('stops polling after stopAutoGameWatcher', async () => {
    const { startAutoGameWatcher, stopAutoGameWatcher, isAutoGameWatcherRunning } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })

    mockDetectFocused.mockResolvedValue(2)
    startAutoGameWatcher(store)
    expect(isAutoGameWatcherRunning()).toBe(true)

    stopAutoGameWatcher()
    expect(isAutoGameWatcherRunning()).toBe(false)

    await vi.advanceTimersByTimeAsync(POLL_STEP_MS * 3)
    expect(mockPerformGameSwitch).not.toHaveBeenCalled()
  })

  it('startAutoGameWatcher is idempotent', async () => {
    const { startAutoGameWatcher, isAutoGameWatcherRunning } = await import('./watcher')
    const store = makeStore({ poeVersion: 1 })
    setPoeVersion(1)

    mockDetectFocused.mockResolvedValue(2)
    startAutoGameWatcher(store)
    startAutoGameWatcher(store) // second call, should be no-op
    expect(isAutoGameWatcherRunning()).toBe(true)

    await vi.advanceTimersByTimeAsync(POLL_STEP_MS)
    expect(mockPerformGameSwitch).toHaveBeenCalledTimes(1) // only one interval
  })
})
