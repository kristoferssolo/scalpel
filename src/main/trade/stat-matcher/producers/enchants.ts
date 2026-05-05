import type { StatFilter } from '../../trade'
import { matchModToStat } from '../mod-matcher'

type EnchantItemInfo = {
  enchants?: string[]
  baseType?: string
}

// Process enchant lines (cluster jewel enchantments)
export function buildEnchantFilters(itemInfo: EnchantItemInfo | undefined): StatFilter[] {
  const enchantFilters: StatFilter[] = []
  if (itemInfo?.enchants) {
    for (const enchant of itemInfo.enchants) {
      const matched = matchModToStat(enchant, false, 'enchant')
      if (matched) {
        let minVal: number | null = matched.option ? null : matched.value
        let maxVal: number | null = null
        // Cluster jewel "Adds N Passive Skills": passive count drives price more
        // than any other roll, so the bracketed defaults below override the usual
        // "min = value" rule for the disjoint price tiers:
        //   Medium 4/5 -- functionally identical; a 6 is either cheap filler or
        //     a stat-stacker target, so 4-5 inclusive excludes both ends.
        //   Large 8 -- 8s and 12s are price-disjoint with no in-between, so an
        //     8-search wants max 8 (else every 12 surfaces).
        const isAddsPassives = enchant.includes('Adds') && matched.value != null
        if (isAddsPassives && itemInfo.baseType === 'Medium Cluster Jewel') {
          if (matched.value === 4 || matched.value === 5) {
            minVal = 4
            maxVal = 5
          }
        } else if (isAddsPassives && itemInfo.baseType === 'Large Cluster Jewel') {
          if (matched.value === 8) {
            minVal = null
            maxVal = 8
          }
        }
        enchantFilters.push({
          id: matched.statId,
          text: enchant,
          value: matched.value,
          min: minVal,
          max: maxVal,
          enabled: true,
          type: 'enchant',
          option: matched.option,
        })
      }
    }
  }
  return enchantFilters
}
