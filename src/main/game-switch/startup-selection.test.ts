import { describe, expect, it, vi, beforeEach } from 'vitest'
import type Store from 'electron-store'
import type { AppSettings } from '../../shared/types'
import type { GameVariant } from '../../shared/game-variant'

const mockDetectFocused = vi.fn<() => Promise<GameVariant | null>>()
const mockDetectOpen = vi.fn<() => Promise<Array<{ title: string; variant: GameVariant }>>>()
const mockExistsSync = vi.fn<(p: string) => boolean>()

vi.mock('./detector', () => ({
  detectFocusedPoeVersion: () => mockDetectFocused(),
  detectOpenPoeWindows: () => mockDetectOpen(),
}))

vi.mock('node:fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
}))

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => (key === 'documents' ? '/docs' : ''),
  },
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

// Because the module caches the result, each test needs a fresh import
// to avoid cross-test contamination from the cached __cached variable.
async function freshModule() {
  const { _resetStartupSelectionForTesting } = await import('./startup-selection')
  _resetStartupSelectionForTesting()
  return import('./startup-selection')
}

describe('chooseStartupGameVariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetMocks()
  })

  function _resetMocks() {
    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockReturnValue(false)
  }

  // Focused window overrides everything
  it('returns focused PoE2 over persisted PoE1', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(2)

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(2)
  })

  it('returns focused PoE1 over persisted PoE2', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 2, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(1)

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(1)
  })

  // Only one open variant
  it('returns the only open variant PoE2 when nothing is focused', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([{ title: 'Path of Exile 2', variant: 2 }])

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(2)
  })

  it('returns the only open variant PoE1 when nothing is focused', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 2, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([{ title: 'Path of Exile', variant: 1 }])

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(1)
  })

  // Both open: keep persisted
  it('keeps persisted when both games are open and nothing is focused', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 2, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([
      { title: 'Path of Exile', variant: 1 },
      { title: 'Path of Exile 2', variant: 2 },
    ])

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(2)
  })

  // Focused beats open
  it('prefers focused over open windows when both are available', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(2)
    mockDetectOpen.mockResolvedValue([
      { title: 'Path of Exile', variant: 1 },
      { title: 'Path of Exile 2', variant: 2 },
    ])

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(2)
  })

  // No games open: fall through to persisted
  it('falls back to persisted when nothing is open', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 2, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(2)
  })

  // --- installed/config fallback (first run only) ---

  it('picks PoE2 from config evidence on first run when nothing is open', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: false })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockImplementation((p: string) => p.includes('Path of Exile 2'))

    const result = await chooseStartupGameVariant(store, { isFirstRun: true })
    expect(result).toBe(2)
  })

  it('picks PoE1 from config evidence on first run when nothing is open', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 2, onboardingCompleted: false })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockImplementation((p: string) => p.includes('Path of Exile') && !p.includes('Path of Exile 2'))

    const result = await chooseStartupGameVariant(store, { isFirstRun: true })
    expect(result).toBe(1)
  })

  it('keeps persisted on first run when both configs exist', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: false })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockReturnValue(true)

    const result = await chooseStartupGameVariant(store, { isFirstRun: true })
    expect(result).toBe(1)
  })

  it('skips config fallback for returning users', async () => {
    const { chooseStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1, onboardingCompleted: true })

    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockImplementation((p: string) => p.includes('Path of Exile 2'))

    const result = await chooseStartupGameVariant(store, { isFirstRun: false })
    expect(result).toBe(1)
  })
})

describe('onceStartupGameVariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectFocused.mockResolvedValue(null)
    mockDetectOpen.mockResolvedValue([])
    mockExistsSync.mockReturnValue(false)
  })

  it('caches the result across repeated calls', async () => {
    const { onceStartupGameVariant } = await freshModule()
    const store = makeStore({ poeVersion: 1 })

    mockDetectFocused.mockResolvedValue(2)

    const first = await onceStartupGameVariant(store, { isFirstRun: false })
    expect(first).toBe(2)

    // Even if detection changes mid-process, the cached result is returned.
    mockDetectFocused.mockResolvedValue(1)

    const second = await onceStartupGameVariant(store, { isFirstRun: false })
    expect(second).toBe(2)
  })
})
