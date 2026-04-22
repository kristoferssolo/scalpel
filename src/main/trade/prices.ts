import { net } from 'electron'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { PriceInfo } from '../../shared/types'
import { POE_NINJA_API, POE_NINJA_POE2_EXCHANGE } from '../../shared/endpoints'
import { poeVersion } from '../overlay'
import uniqueInfoData from '../../shared/data/items/unique-info.json'
const staticUniquesByBase = uniqueInfoData as Record<string, string[]>

// Dynamic map built from poe.ninja data, falls back to cached file, then static file
let uniqueBaseMap: Record<string, string[]> = loadCachedUniquesByBase()

function getCachePath(): string {
  return join(app.getPath('userData'), 'uniques-by-base-cache.json')
}

function loadCachedUniquesByBase(): Record<string, string[]> {
  try {
    const cachePath = getCachePath()
    if (existsSync(cachePath)) {
      return JSON.parse(readFileSync(cachePath, 'utf-8'))
    }
  } catch {
    /* fall through */
  }
  return staticUniquesByBase as Record<string, string[]>
}

function saveCachedUniquesByBase(data: Record<string, string[]>): void {
  try {
    writeFileSync(getCachePath(), JSON.stringify(data), 'utf-8')
  } catch {
    /* ignore */
  }
}

// Cache: league -> (name -> price)
let cachedLeague = ''
let priceMap = new Map<string, PriceInfo>()
let lastFetchTime = 0
// PoE2 fires 13 parallel requests per refresh (one per exchange category) while
// PoE1 aggregates everything into a single dense endpoint call. Doubling the TTL
// for PoE2 keeps ninja load roughly in line with PoE1 without impacting UX since
// prices don't move meaningfully on a 10-minute scale anyway.
const CACHE_TTL_BY_VERSION: Record<1 | 2, number> = {
  1: 10 * 60 * 1000,
  2: 20 * 60 * 1000,
}

// Dense endpoint — returns ALL item types in one request with current prices
// (same endpoint Awakened PoE Trade uses)
const DENSE_URL = POE_NINJA_API

interface DenseLine {
  name?: string
  chaos?: number
  graph?: (number | null)[]
  variant?: string
}

interface DenseOverview {
  type: string
  lines: DenseLine[]
}

interface DenseResponse {
  currencyOverviews: DenseOverview[]
  itemOverviews: DenseOverview[]
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    let data = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString()
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

// Separate price map for div cards to avoid name collisions with other item types
let divCardPriceMap = new Map<string, PriceInfo>()

// Gem names seen in the most recent poe.ninja response. Used by the item-search
// handler to populate the gem section of the combobox -- static gem data would quickly
// rot as GGG adds/renames gems, so we rely on the live overview instead.
let gemNames: Set<string> = new Set()

// Known jewel base types for variant parsing
const JEWEL_BASES = [
  'Prismatic Jewel',
  'Cobalt Jewel',
  'Crimson Jewel',
  'Viridian Jewel',
  'Large Cluster Jewel',
  'Medium Cluster Jewel',
  'Small Cluster Jewel',
  'Timeless Jewel',
]

function buildUniquesByBaseFromDense(resp: DenseResponse): void {
  const dynamicMap: Record<string, Set<string>> = {}

  for (const overview of resp.itemOverviews ?? []) {
    if (!overview.type.startsWith('Unique')) continue

    for (const line of overview.lines ?? []) {
      if (!line.name || !line.variant) continue
      // Strip "Foulborn " prefix from name
      const name = line.name.replace(/^Foulborn\s+/i, '')

      // Try to extract base type from variant
      const parts = line.variant.split(',').map((s) => s.trim())

      // For jewels: last part is the base type
      if (overview.type === 'UniqueJewel') {
        const base = parts.find((p) => JEWEL_BASES.some((b) => p.endsWith(b)))
        if (base) {
          const baseType = JEWEL_BASES.find((b) => base.endsWith(b))!
          if (!dynamicMap[baseType]) dynamicMap[baseType] = new Set()
          dynamicMap[baseType].add(name)
        }
      }

      // For weapons/armour: find a part that matches a known base type from static data
      if (
        overview.type === 'UniqueWeapon' ||
        overview.type === 'UniqueArmour' ||
        overview.type === 'UniqueAccessory' ||
        overview.type === 'UniqueFlask'
      ) {
        for (const part of parts) {
          // Skip common non-base parts
          if (/^\d+L$/.test(part) || part === 'Relic' || part === 'Relics') continue
          if (staticUniquesByBase[part as keyof typeof staticUniquesByBase]) {
            if (!dynamicMap[part]) dynamicMap[part] = new Set()
            dynamicMap[part].add(name)
            break
          }
        }
      }
    }
  }

  // Merge dynamic data into the base map (dynamic supplements static)
  const merged = { ...(staticUniquesByBase as Record<string, string[]>) }
  for (const [base, names] of Object.entries(dynamicMap)) {
    const existing = new Set(merged[base] ?? [])
    for (const n of names) existing.add(n)
    merged[base] = [...existing]
  }
  uniqueBaseMap = merged
  saveCachedUniquesByBase(merged)
}

function processDenseResponse(resp: DenseResponse): void {
  let divineRate = 0

  // Process all overviews (currency + items use the same line format)
  const allOverviews = [...(resp.currencyOverviews ?? []), ...(resp.itemOverviews ?? [])]

  for (const overview of allOverviews) {
    const isDivCards = overview.type === 'DivinationCard'
    const isSkillGem = overview.type === 'SkillGem'
    for (const line of overview.lines ?? []) {
      const name = line.name
      const chaos = line.chaos
      if (!name) continue
      if (isSkillGem) gemNames.add(name)
      if (!chaos || chaos <= 0) continue

      if (name === 'Divine Orb') divineRate = chaos

      const info = {
        chaosValue: chaos,
        divineValue: divineRate > 0 ? chaos / divineRate : undefined,
      }
      priceMap.set(name.toLowerCase(), info)
      if (isDivCards) divCardPriceMap.set(name.toLowerCase(), info)
    }
  }

  // Second pass to fill in divine values for items processed before Divine Orb was found
  if (divineRate > 0) {
    for (const [key, info] of priceMap) {
      if (info.divineValue == null) {
        priceMap.set(key, { ...info, divineValue: info.chaosValue / divineRate })
      }
    }
  }
}

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

// poe.ninja PoE2 has no dense/overviews endpoint like PoE1. Instead each category
// is fetched separately from the same exchange endpoint with a different `type`
// param. These are the categories that currently return populated data --
// Unique/SkillGem/BaseType etc. respond 200 but with empty lines.
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

function processPoe2ExchangeResponse(resp: Poe2ExchangeResponse): void {
  // rates.X is "units of X per 1 primary" (e.g. primary=divine, rates.chaos=22.79
  // means 1 divine = 22.79 chaos). primaryValue on each line is already denominated
  // in the primary currency, so divineValue = primaryValue and chaosValue is the
  // primary->chaos conversion. Keeping chaos as our stored unit lets the existing
  // UI consumers (which were built against PoE1 chaos-as-base) work unchanged.
  const chaosPerPrimary = resp.core.rates?.chaos ?? 0
  const nameById = new Map<string, string>()
  for (const item of [...(resp.core.items ?? []), ...(resp.items ?? [])]) {
    if (item.id && item.name) nameById.set(item.id, item.name)
  }

  // Seed the core currencies (divine is always worth 1 primary by definition).
  for (const item of resp.core.items ?? []) {
    const divineValue = item.id === resp.core.primary ? 1 : 1 / (resp.core.rates?.[item.id] ?? 0)
    const chaosValue = divineValue * chaosPerPrimary
    if (!isFinite(chaosValue) || chaosValue <= 0) continue
    priceMap.set(item.name.toLowerCase(), { chaosValue, divineValue })
  }

  for (const line of resp.lines ?? []) {
    const name = nameById.get(line.id)
    const primary = line.primaryValue
    if (!name || primary == null || primary <= 0) continue
    priceMap.set(name.toLowerCase(), {
      chaosValue: primary * chaosPerPrimary,
      divineValue: primary,
    })
  }
}

/** Reset all price maps + bookkeeping in one shot. Called after a successful fetch
 *  so a failed request (offline, sleep/resume, net::ERR_NETWORK_IO_SUSPENDED) leaves
 *  the old cache intact until the next scheduled retry 10-20 min later. */
function resetCache(league: string, now: number): void {
  cachedLeague = league
  priceMap = new Map()
  divCardPriceMap = new Map()
  gemNames = new Set()
  lastFetchTime = now
}

export async function refreshPrices(league: string): Promise<void> {
  if (!league) return
  const now = Date.now()
  if (league === cachedLeague && now - lastFetchTime < CACHE_TTL_BY_VERSION[poeVersion]) return

  try {
    if (poeVersion === 2) {
      // Parallel fetch all categories; only swap maps after all succeed.
      const responses = (await Promise.all(
        POE2_EXCHANGE_TYPES.map((type) =>
          fetchJson(`${POE_NINJA_POE2_EXCHANGE}?league=${encodeURIComponent(league)}&type=${type}`),
        ),
      )) as Poe2ExchangeResponse[]
      resetCache(league, now)
      for (const resp of responses) processPoe2ExchangeResponse(resp)
      return
    }
    const resp = (await fetchJson(`${DENSE_URL}?league=${encodeURIComponent(league)}&language=en`)) as DenseResponse
    resetCache(league, now)
    processDenseResponse(resp)
    buildUniquesByBaseFromDense(resp)
  } catch (e) {
    console.error('[FilterScalpel] Failed to fetch prices:', e)
    // Don't update lastFetchTime on failure so the next call retries instead of being
    // short-circuited by the cache TTL check.
  }
}

/** Forget the last-fetch timestamp so the next refreshPrices() call bypasses the TTL. */
export function invalidatePriceCache(): void {
  lastFetchTime = 0
}

export function lookupPrice(itemName: string, baseType: string): PriceInfo | undefined {
  // Try exact name first (for uniques), then base type (for currency/fragments)
  return priceMap.get(itemName.toLowerCase()) ?? priceMap.get(baseType.toLowerCase())
}

/** Look up a divination card price specifically (avoids name collisions with other item types) */
export function lookupDivCardPrice(cardName: string): PriceInfo | undefined {
  return divCardPriceMap.get(cardName.toLowerCase())
}

/** Gem names from the most recent poe.ninja SkillGem overview. Empty until the first
 *  successful refreshPrices() call. */
export function getGemNames(): Set<string> {
  return gemNames
}

/** Find the highest-priced unique item that uses a given base type */
export function getUniquesByBase(): Record<string, string[]> {
  return uniqueBaseMap
}

export function lookupBestUniquePrice(baseType: string): PriceInfo | undefined {
  const names = uniqueBaseMap[baseType]
  if (!names) return undefined
  let best: PriceInfo | undefined
  for (const name of names) {
    const info = priceMap.get(name.toLowerCase())
    if (info && (!best || info.chaosValue > best.chaosValue)) {
      best = info
    }
  }
  return best
}
