import tabletMods from '../../../../shared/data/trade/tablet-mods.json'
import type { StatFilter } from '../../trade'
import { findAdvMod } from '../adv-mods'
import type { MatchContext } from '../context'
import { matchModToStat } from '../mod-matcher'

// PoE2 precursor tablets. Their affixes are regular explicit map mods, but the
// in-game clipboard phrases them differently from the trade API's stat text
// ("...Waystones found in Map" vs "...found", "Map is inhabited by 1 additional
// Rogue Exile" vs "Your Maps are inhabited by # additional Rogue Exile"). Scalpel
// matches clipboard text against the live trade2 /data/stats text, which never
// carries the tablet phrasing, so the normal explicit matcher missed every one.
//
// tablet-mods.json maps each known clipboard phrasing (number-normalized) to the
// trade explicit stat id, generated from Exiled-Exchange-2's matcher table by
// scripts/build-tablet-mods.js. Tablets are PoE2-only.
const TABLET_MODS = tabletMods as Record<string, string>

/** Number-normalized lookup key. MUST stay in sync with normalizeKey in
 *  scripts/build-tablet-mods.js. */
export function normalizeTabletModKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[+-]?\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildTabletFilters(ctx: MatchContext): StatFilter[] {
  if (!ctx.isTablet) return []
  const { explicits, advancedMods, pct } = ctx
  const out: StatFilter[] = []
  for (const mod of explicits) {
    const cleaned = mod.trim()
    let id: string
    let value: number | null

    const mappedId = TABLET_MODS[normalizeTabletModKey(cleaned)]
    if (mappedId) {
      id = mappedId
      const numMatch = cleaned.match(/[+-]?\d+(?:\.\d+)?/)
      value = numMatch ? parseFloat(numMatch[0]) : null
    } else {
      // A tablet mod whose clipboard text already matches the live trade stat
      // text (no special phrasing) -- let the normal explicit matcher handle it.
      const matched = matchModToStat(cleaned, false, 'explicit')
      if (!matched) continue
      id = matched.statId
      value = matched.value
    }

    let modTier: number | undefined
    let modRange: { min: number; max: number } | undefined
    if (advancedMods) {
      const advMod = findAdvMod(advancedMods, cleaned, 'explicit')
      if (advMod) {
        if (advMod.tier > 0) modTier = advMod.tier
        const range = advMod.ranges.find((r) => r.value === value)
        if (range && range.min !== range.max) modRange = { min: range.min, max: range.max }
      }
    }

    out.push({
      id,
      text: cleaned,
      value,
      min: value != null ? Math.floor(value * pct) : null,
      max: null,
      enabled: true,
      type: 'explicit',
      option: undefined,
      modTier,
      modRange,
    })
  }
  return out
}
