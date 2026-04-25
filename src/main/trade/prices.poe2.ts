import type { PriceInfo } from '../../shared/types'
import { POE_NINJA_POE2_EXCHANGE } from '../../shared/endpoints'

/**
 * PoE2 ninja price fetching + processing. The PoE2 API has no dense/overviews
 * endpoint like PoE1 -- each category is fetched separately from the same
 * exchange endpoint with a different `type` param. Callers build a fresh price
 * map via `fetchAndBuildPoe2PriceMap` and swap it in atomically on success.
 *
 * Keep PoE2-specific pricing concerns in this file so the parent `prices.ts`
 * stays focused on dispatch + bookkeeping. No PoE1 data types leak in here.
 */

interface Poe2ExchangeLine {
  id: string
  primaryValue?: number
}

interface Poe2ExchangeItem {
  id: string
  name: string
}

interface Poe2ExchangeResponse {
  core: {
    primary: string
    secondary: string
    rates: Record<string, number>
    items: Poe2ExchangeItem[]
  }
  lines: Poe2ExchangeLine[]
  items: Poe2ExchangeItem[]
}

// Categories that currently return populated data on the PoE2 exchange
// endpoint. Unique/SkillGem/BaseType etc. respond 200 but with empty lines,
// so we skip them to save requests.
const POE2_EXCHANGE_TYPES = [
  'Currency',
  'Fragments',
  'Abyss',
  'UncutGems',
  'LineageSupportGems',
  'Essences',
  'SoulCores',
  'Idols',
  'Runes',
  'Ritual',
  'Expedition',
  'Delirium',
  'Breach',
] as const

/** Apply a single exchange response to the given price map. Exalted orb is
 *  PoE2's economy baseline (the role chaos plays in PoE1); PriceInfo.chaosValue
 *  is named for PoE1 history but semantically holds "baseline currency count",
 *  so in PoE2 we store exalted-equivalents there. Ninja's response reports
 *  primary=divine and rates.X = "units of X per 1 divine", so:
 *    divineValue = primaryValue
 *    chaosValue  = primaryValue * rates.exalted (i.e. exalted-equivalent) */
export function applyResponse(resp: Poe2ExchangeResponse, priceMap: Map<string, PriceInfo>): void {
  const exaltedPerPrimary = resp.core.rates?.exalted ?? 0
  const nameById = new Map<string, string>()
  for (const item of [...(resp.core.items ?? []), ...(resp.items ?? [])]) {
    if (item.id && item.name) nameById.set(item.id, item.name)
  }

  // Seed the core currencies (divine is always worth 1 primary by definition).
  for (const item of resp.core.items ?? []) {
    const divineValue = item.id === resp.core.primary ? 1 : 1 / (resp.core.rates?.[item.id] ?? 0)
    const chaosValue = divineValue * exaltedPerPrimary
    if (!isFinite(chaosValue) || chaosValue <= 0) continue
    priceMap.set(item.name.toLowerCase(), { chaosValue, divineValue })
  }

  for (const line of resp.lines ?? []) {
    const name = nameById.get(line.id)
    const primary = line.primaryValue
    if (!name || primary == null || primary <= 0) continue
    priceMap.set(name.toLowerCase(), {
      chaosValue: primary * exaltedPerPrimary,
      divineValue: primary,
    })
  }
}

/** Fetch every populated exchange category in parallel and return a freshly
 *  built price map. Caller swaps this into its module-level cache on success;
 *  failure should not clobber existing state (leave old cache intact). */
export async function fetchAndBuildPoe2PriceMap(
  league: string,
  fetchJson: (url: string) => Promise<unknown>,
): Promise<Map<string, PriceInfo>> {
  const responses = (await Promise.all(
    POE2_EXCHANGE_TYPES.map((type) =>
      fetchJson(`${POE_NINJA_POE2_EXCHANGE}?league=${encodeURIComponent(league)}&type=${type}`),
    ),
  )) as Poe2ExchangeResponse[]
  const priceMap = new Map<string, PriceInfo>()
  for (const resp of responses) applyResponse(resp, priceMap)
  return priceMap
}
