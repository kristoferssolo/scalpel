import { describe, it, expect } from 'vitest'
import { applyProxyResponse, fetchPoe2PricesFromProxy } from './prices.poe2'
import type { PriceInfo } from '../../shared/types'

// Helper: minimal valid Ee2OverviewResponse shape for the parts applyProxyResponse
// reads. The real EE2 payload has more fields but they're ignored.
function resp(over: {
  primary?: string
  rates?: Record<string, number>
  itemOverviews?: Array<{
    type: string
    lines: Array<{ name?: string; primaryValue?: number }>
  }>
}) {
  return {
    core: {
      primary: over.primary ?? 'divine',
      rates: over.rates ?? { exalted: 100 },
    },
    itemOverviews: over.itemOverviews ?? [],
  } as Parameters<typeof applyProxyResponse>[0]
}

describe('applyProxyResponse (EE2 proxy math)', () => {
  it('computes divineValue = primaryValue and chaosValue = primaryValue * rates.exalted', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [
          {
            type: 'Currency',
            lines: [
              { name: 'Chaos Orb', primaryValue: 2 },
              { name: 'Regal Orb', primaryValue: 0.5 },
            ],
          },
        ],
      }),
      map,
    )
    expect(map.get('chaos orb')).toEqual({ chaosValue: 200, divineValue: 2 })
    expect(map.get('regal orb')).toEqual({ chaosValue: 50, divineValue: 0.5 })
  })

  it('synthesizes Divine Orb at { chaosValue: rates.exalted, divineValue: 1 }', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(resp({ rates: { exalted: 137 } }), map)
    expect(map.get('divine orb')).toEqual({ chaosValue: 137, divineValue: 1 })
  })

  it('synthesizes Exalted Orb at { chaosValue: 1, divineValue: 1 / rates.exalted }', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(resp({ rates: { exalted: 100 } }), map)
    expect(map.get('exalted orb')).toEqual({ chaosValue: 1, divineValue: 0.01 })
  })

  it('skips lines with missing primaryValue', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [
          {
            type: 'Currency',
            lines: [{ name: 'Acme Shard' /* primaryValue absent */ }],
          },
        ],
      }),
      map,
    )
    // Only synthesized divine/exalted entries, not the missing-value line
    expect(map.has('acme shard')).toBe(false)
  })

  it('skips lines with zero primaryValue', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [{ type: 'Currency', lines: [{ name: 'Zero Item', primaryValue: 0 }] }],
      }),
      map,
    )
    expect(map.has('zero item')).toBe(false)
  })

  it('skips lines with negative primaryValue', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [{ type: 'Currency', lines: [{ name: 'Neg Item', primaryValue: -1 }] }],
      }),
      map,
    )
    expect(map.has('neg item')).toBe(false)
  })

  it('skips synthesis when rates.exalted is 0', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(resp({ rates: { exalted: 0 } }), map)
    expect(map.has('divine orb')).toBe(false)
    expect(map.has('exalted orb')).toBe(false)
  })

  it('skips synthesis when rates is missing', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      {
        core: {
          primary: 'divine',
          rates: undefined as unknown as Record<string, number>,
        },
      },
      map,
    )
    expect(map.has('divine orb')).toBe(false)
    expect(map.has('exalted orb')).toBe(false)
  })

  it('lower-cases names for case-insensitive lookup', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [
          {
            type: 'Currency',
            lines: [{ name: 'Mirror of Kalandra', primaryValue: 5 }],
          },
        ],
      }),
      map,
    )
    expect(map.has('Mirror of Kalandra')).toBe(false)
    expect(map.has('mirror of kalandra')).toBe(true)
  })

  it('last write wins when the same name appears in multiple overviews', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 100 },
        itemOverviews: [
          { type: 'Currency', lines: [{ name: 'Repeated', primaryValue: 1 }] },
          { type: 'Essences', lines: [{ name: 'Repeated', primaryValue: 3 }] },
        ],
      }),
      map,
    )
    expect(map.get('repeated')).toEqual({ chaosValue: 300, divineValue: 3 })
  })

  it('tolerates missing itemOverviews', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      {
        core: { primary: 'divine', rates: { exalted: 100 } },
        itemOverviews: undefined,
      },
      map,
    )
    // Only synthesized entries
    expect(map.get('divine orb')).toEqual({ chaosValue: 100, divineValue: 1 })
  })

  it('tolerates missing lines within an overview', () => {
    const map = new Map<string, PriceInfo>()
    applyProxyResponse(
      resp({
        rates: { exalted: 50 },
        itemOverviews: [{ type: 'Currency', lines: undefined as unknown as [] }],
      }),
      map,
    )
    expect(map.get('divine orb')).toEqual({ chaosValue: 50, divineValue: 1 })
  })
})

describe('fetchPoe2PricesFromProxy', () => {
  it('returns a populated map for a known league with a valid stub response', async () => {
    const stubResp = {
      core: { primary: 'divine', rates: { exalted: 200 } },
      itemOverviews: [{ type: 'Currency', lines: [{ name: 'Chaos Orb', primaryValue: 1 }] }],
    }
    const fetchJson = async (_url: string) => stubResp
    const map = await fetchPoe2PricesFromProxy('Fate of the Vaal', fetchJson)
    expect(map.get('chaos orb')).toEqual({ chaosValue: 200, divineValue: 1 })
    expect(map.get('divine orb')).toEqual({ chaosValue: 200, divineValue: 1 })
  })

  it('throws on an unknown league name', async () => {
    const fetchJson = async (_url: string) => ({})
    await expect(fetchPoe2PricesFromProxy('Unknown League', fetchJson)).rejects.toThrow(
      'Unsupported PoE2 league for proxy: Unknown League',
    )
  })

  it.each([
    ['Fate of the Vaal', 'league'],
    ['HC Fate of the Vaal', 'leaguehc'],
    ['Standard', 'standard'],
    ['Hardcore', 'standardhc'],
  ])('hits %s -> %s slug', async (league, slug) => {
    let capturedUrl = ''
    const fetchJson = async (url: string) => {
      capturedUrl = url
      return { core: { primary: 'divine', rates: { exalted: 100 } }, itemOverviews: [] }
    }
    await fetchPoe2PricesFromProxy(league, fetchJson)
    expect(capturedUrl).toBe(`https://api.exiledexchange2.dev/proxy/${slug}/overviewData.json`)
  })
})
