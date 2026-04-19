import { ipcMain } from 'electron'
import Store from 'electron-store'
import { getCurrentFilter } from '../filter-state'
import { evaluateAndSend, runPriceCheck } from '../evaluation'
import { findMatchingBlocks } from '../filter/matcher'
import {
  refreshPrices,
  lookupPrice,
  lookupBestUniquePrice,
  lookupDivCardPrice,
  getUniquesByBase,
} from '../trade/prices'
import type { AppSettings, FilterBlock, PoeItem } from '../../shared/types'
import uniqueInfoData from '../../shared/data/items/unique-info.json'
import itemClassesData from '../../shared/data/items/item-classes.json'
import divCardsData from '../../shared/data/economy/div-cards.json'

export interface SearchableItem {
  name: string
  baseType: string
  itemClass: string
  rarity: 'Unique' | 'Currency'
  /** Minimal filter block info the renderer needs to reuse <LootLabel /> styling. */
  block: { visibility: 'Show' | 'Hide'; actions: FilterBlock['actions'] } | null
  /** Div-card reward text — searchable and shown inline when the match came via reward. */
  reward?: string
}

/** Build a synthetic PoeItem with sensible defaults for evaluation/lookup flows. */
function defaultPoeItem(overrides: Partial<PoeItem> = {}): PoeItem {
  return {
    itemClass: '',
    rarity: 'Normal',
    name: '',
    baseType: '',
    mapTier: 0,
    itemLevel: 100,
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
    blighted: false,
    scourged: false,
    zanaMemory: false,
    implicitCount: 0,
    gemLevel: 0,
    stackSize: 1,
    influence: [],
    explicits: [],
    implicits: [],
    areaLevel: 83,
    ...overrides,
  } as PoeItem
}

/** Classes whose BaseTypes should surface in the item search combobox. */
const STACKABLE_CLASSES = new Set([
  'Currency',
  'Stackable Currency',
  'Divination Cards',
  'Essences',
  'Map Fragments',
  'Scarabs',
  'Incubators',
  'Delve Socketable Currency',
  'Delve Stackable Socketable Currency',
  'Expedition Logbook',
  'Heist Brooches',
  'Heist Cloaks',
  'Heist Tools',
  'Sentinel',
  'Misc Map Items',
])

/** Reverse map: base type -> item class, built once from static item-classes data. */
const BASE_TO_CLASS: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  const classes = itemClassesData as unknown as Record<string, { bases: string[] }>
  for (const [cls, { bases }] of Object.entries(classes)) {
    for (const b of bases) map[b] = cls
  }
  return map
})()

/** Div card name -> reward text, built once from static economy data. */
const DIV_CARD_REWARDS: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const card of divCardsData as Array<{ name: string; reward?: string }>) {
    if (card.reward) map[card.name] = card.reward
  }
  return map
})()

/** Reverse-lookup a unique name to its base type using the live uniques-by-base map. */
function resolveUniqueBase(uniqueName: string, fallback = uniqueName): string {
  for (const [base, names] of Object.entries(getUniquesByBase())) {
    if (names.includes(uniqueName)) return base
  }
  return fallback
}

/** Scan the current filter for the first block whose BaseType condition contains
 *  `baseType` and return its Class condition value (empty string if not found). */
function findItemClassInFilter(baseType: string): string {
  const currentFilter = getCurrentFilter()
  if (!currentFilter) return ''
  for (const block of currentFilter.blocks) {
    const btCond = block.conditions.find((c) => c.type === 'BaseType' && c.values.includes(baseType))
    if (!btCond) continue
    const classCond = block.conditions.find((c) => c.type === 'Class')
    return classCond?.values[0] ?? ''
  }
  return ''
}

export function register(store: Store<AppSettings>): void {
  ipcMain.handle(
    'lookup-base-type',
    (_event, baseType: string, itemClass: string, rarity?: string, uniqueName?: string) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return

      // If base type or class is missing for a unique, try reverse lookup from uniques-by-base
      // and search the filter for a block containing that base type
      if (currentFilter && uniqueName && (!itemClass || !baseType || baseType === uniqueName)) {
        const foundBase = resolveUniqueBase(uniqueName, baseType)
        if (foundBase && foundBase !== uniqueName) baseType = foundBase
        if (!itemClass) itemClass = findItemClassInFilter(baseType)
      }

      evaluateAndSend(
        defaultPoeItem({
          itemClass,
          rarity: (rarity as PoeItem['rarity']) || 'Normal',
          name: uniqueName || baseType,
          baseType,
        }),
      )
    },
  )

  ipcMain.handle(
    'batch-lookup-prices',
    async (
      _event,
      baseTypes: string[],
      league: string,
      uniqueTier?: boolean,
    ): Promise<Record<string, { chaosValue: number; divineValue?: number } | null>> => {
      await refreshPrices(league)
      const result: Record<string, { chaosValue: number; divineValue?: number } | null> = {}
      for (const bt of baseTypes) {
        result[bt] = (uniqueTier ? lookupBestUniquePrice(bt) : undefined) ?? lookupPrice(bt, bt) ?? null
      }
      return result
    },
  )

  ipcMain.handle(
    'batch-lookup-ref-prices',
    async (
      _event,
      refs: Array<{ name: string; baseType?: string }>,
      league: string,
    ): Promise<Record<string, { chaosValue: number; divineValue?: number } | null>> => {
      await refreshPrices(league)
      const result: Record<string, { chaosValue: number; divineValue?: number } | null> = {}
      for (const r of refs) {
        result[r.name] = lookupPrice(r.name, r.baseType ?? r.name) ?? null
      }
      return result
    },
  )

  ipcMain.handle(
    'sister-open-price-check',
    async (
      _event,
      ref: { name: string; baseType?: string; category: 'base' | 'unique' | 'divination' | 'gem' | 'beast' },
    ): Promise<void> => {
      const isUnique = ref.category === 'unique' || ref.category === 'beast'
      // For uniques, resolve the base type if the ref didn't carry one. Non-uniques use
      // name == baseType (currency, fragments, div cards, gems).
      const baseType = isUnique && !ref.baseType ? resolveUniqueBase(ref.name) : (ref.baseType ?? ref.name)
      const itemClass = findItemClassInFilter(baseType)
      const rarity: PoeItem['rarity'] = isUnique ? 'Unique' : ref.category === 'gem' ? 'Gem' : 'Normal'
      const synthetic = defaultPoeItem({
        itemClass,
        rarity,
        name: isUnique ? ref.name : baseType,
        baseType,
        // itemLevel 0 tells the stat-matcher to omit the ilvl chip entirely, so the trade
        // search isn't constrained by an imaginary ilvl we don't actually know.
        itemLevel: 0,
      })
      await runPriceCheck(synthetic, store)
    },
  )

  ipcMain.handle(
    'batch-lookup-div-card-prices',
    async (
      _event,
      cardNames: string[],
      league: string,
    ): Promise<Record<string, { chaosValue: number; divineValue?: number } | null>> => {
      await refreshPrices(league)
      const result: Record<string, { chaosValue: number; divineValue?: number } | null> = {}
      for (const name of cardNames) {
        result[name] = lookupDivCardPrice(name) ?? null
      }
      return result
    },
  )

  ipcMain.handle('get-searchable-items', (): SearchableItem[] => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return []

    const toLabel = (block: FilterBlock): SearchableItem['block'] => ({
      visibility: block.visibility,
      actions: block.actions,
    })

    // ---- Stackables (currency, div cards, fragments, etc.) from the filter ----
    const seenBase = new Map<string, { itemClass: string; block: FilterBlock }>()
    for (const block of currentFilter.blocks) {
      const classCond = block.conditions.find((c) => c.type === 'Class')
      const itemClass = classCond?.values[0] ?? ''
      if (itemClass && !STACKABLE_CLASSES.has(itemClass)) continue
      for (const cond of block.conditions) {
        if (cond.type !== 'BaseType') continue
        for (const v of cond.values) {
          if (!seenBase.has(v)) seenBase.set(v, { itemClass, block })
        }
      }
    }
    const stackables: SearchableItem[] = [...seenBase.entries()].map(([baseType, { itemClass, block }]) => ({
      name: baseType,
      baseType,
      itemClass,
      rarity: 'Currency',
      block: toLabel(block),
      reward: itemClass === 'Divination Cards' ? DIV_CARD_REWARDS[baseType] : undefined,
    }))

    // ---- Uniques from unique-info.json, evaluated against the filter ----
    const uniques: SearchableItem[] = []
    for (const [baseType, names] of Object.entries(uniqueInfoData as Record<string, string[]>)) {
      const itemClass = BASE_TO_CLASS[baseType] ?? ''
      for (const name of names) {
        const synthetic = defaultPoeItem({ itemClass, rarity: 'Unique', name, baseType, itemLevel: 84 })
        const matches = findMatchingBlocks(currentFilter, synthetic)
        const realMatch = matches.find((m) => m.isFirstMatch) ?? matches[matches.length - 1]
        uniques.push({
          name,
          baseType,
          itemClass,
          rarity: 'Unique',
          block: realMatch ? toLabel(realMatch.block) : null,
        })
      }
    }

    return [...stackables, ...uniques]
  })

  ipcMain.handle(
    'get-div-card-tiers',
    (): {
      tierStyles: Record<string, { border: string; bg: string; text: string }>
      cardTiers: Record<string, string>
      hiddenCards: Record<string, boolean>
    } => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { tierStyles: {}, cardTiers: {}, hiddenCards: {} }
      const tierStyles: Record<string, { border: string; bg: string; text: string }> = {}
      const cardTiers: Record<string, string> = {}
      const hiddenCards: Record<string, boolean> = {}
      for (const block of currentFilter.blocks) {
        if (!block.tierTag || block.tierTag.typePath !== 'divination') continue
        const tier = block.tierTag.tier
        const isHidden = block.visibility === 'Hide'
        const toRgba = (a: { values: string[] }): string => {
          const [r, g, b, alpha] = a.values.map(Number)
          return `rgba(${r ?? 0},${g ?? 0},${b ?? 0},${(alpha ?? 255) / 255})`
        }
        const border = block.actions.find((a) => a.type === 'SetBorderColor')
        const bg = block.actions.find((a) => a.type === 'SetBackgroundColor')
        const text = block.actions.find((a) => a.type === 'SetTextColor')
        tierStyles[tier] = {
          border: border ? toRgba(border) : 'transparent',
          bg: bg ? toRgba(bg) : 'transparent',
          text: text ? toRgba(text) : '#fff',
        }
        for (const cond of block.conditions) {
          if (cond.type === 'BaseType') {
            for (const v of cond.values) {
              cardTiers[v] = tier
              if (isHidden) hiddenCards[v] = true
            }
          }
        }
      }
      return { tierStyles, cardTiers, hiddenCards }
    },
  )
}
