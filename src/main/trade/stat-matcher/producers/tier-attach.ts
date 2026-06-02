import { getTierData } from '../../../tier-data'
import { resolveTierLadder } from '../../../../shared/data/tiers/resolve'
import type { ModTier } from '../../../../shared/data/tiers/types'

/** Resolve a tier ladder for a matched affix, or undefined when not applicable
 *  (no data, Unique item, unknown base, no match, or hybrid multi-stat mod).
 *
 *  The advanced-mod bracket Scalpel parses is the UNMODIFIED roll range (RePoE's
 *  stored range), even on quality-increased mods - the in-game clipboard reports
 *  the base range and base value, and Scalpel scales the displayed value up by
 *  the quality multiplier separately. So matching uses the raw ranges directly;
 *  the multiplier only affects the renderer's modified-space search input (it
 *  rides to the renderer as StatFilter.tierQualityMult, not through here). */
export function attachTierLadder(args: {
  baseType: string | undefined
  ranges: Array<{ value: number; min: number; max: number }> | undefined
  tier: number | undefined
  aggregated: boolean
  rarity: string | undefined
  name?: string
}): ModTier[] | undefined {
  const { baseType, ranges, tier, aggregated, rarity, name } = args
  if (rarity === 'Unique') return undefined
  if (!baseType || !ranges || ranges.length === 0 || tier == null) return undefined
  const data = getTierData()
  if (!data) return undefined
  const matchRanges = ranges.map((r) => ({ min: r.min, max: r.max }))
  const ladder = resolveTierLadder(data, baseType, matchRanges, tier, aggregated, name)
  return ladder?.scrubbable ? ladder.tiers : undefined
}
