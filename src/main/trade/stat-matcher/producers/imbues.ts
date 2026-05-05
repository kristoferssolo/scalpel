import type { StatFilter } from '../../trade'
import { matchModToStat } from '../mod-matcher'

type ImbueItemInfo = {
  imbues?: string[]
}

// Process imbue lines (gem imbued supports)
export function buildImbueFilters(itemInfo: ImbueItemInfo | undefined): StatFilter[] {
  const imbueFilters: StatFilter[] = []
  if (itemInfo?.imbues) {
    for (const imbue of itemInfo.imbues) {
      const matched = matchModToStat(imbue, false, 'imbued')
      if (matched) {
        imbueFilters.push({
          id: matched.statId,
          text: imbue,
          value: null,
          min: null,
          max: null,
          enabled: true,
          type: 'imbued',
        })
      }
    }
  }
  return imbueFilters
}
