import type { StatFilter } from '../../trade'
import { findAdvMod } from '../adv-mods'
import type { MatchContext } from '../context'
import { matchModToStat } from '../mod-matcher'

// PoE2 Trial-of-the-Sekhemas relics. Their prefix/suffix affixes live under the
// trade API's `sanctum.*` stat family, not `explicit.*`, so the normal explicit
// matcher never found them and the price checker showed no searchable chips.
// Match relic affixes against the sanctum stat list instead. Relics are PoE2-only.
export function buildRelicFilters(ctx: MatchContext): StatFilter[] {
  if (!ctx.isRelic) return []
  const { explicits, advancedMods, pct } = ctx
  const out: StatFilter[] = []
  for (const mod of explicits) {
    const cleaned = mod.trim()
    const matched = matchModToStat(cleaned, false, 'sanctum')
    if (!matched) continue

    let modTier: number | undefined
    let modRange: { min: number; max: number } | undefined
    if (advancedMods) {
      const advMod = findAdvMod(advancedMods, cleaned, 'explicit')
      if (advMod) {
        if (advMod.tier > 0) modTier = advMod.tier
        const range = advMod.ranges.find((r) => r.value === matched.value)
        if (range && range.min !== range.max) modRange = { min: range.min, max: range.max }
      }
    }

    out.push({
      id: matched.statId,
      text: cleaned,
      value: matched.value,
      min: matched.value != null ? Math.floor(matched.value * pct) : null,
      max: null,
      enabled: true,
      type: 'sanctum',
      option: matched.option,
      modTier,
      modRange,
    })
  }
  return out
}
