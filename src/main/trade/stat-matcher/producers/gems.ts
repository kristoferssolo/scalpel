import { SKILL_GEM_CLASSES } from '../../../../shared/poe-item'
import type { StatFilter } from '../../trade'

type GemItemInfo = {
  itemClass: string
  gemLevel: number
  quality: number
  transfigured?: boolean
}

// Gem level, transfigured, and gem-quality chips (gem items only).
export function buildGemFilters(itemInfo: GemItemInfo | undefined): StatFilter[] {
  if (!itemInfo) return []

  const isGem = SKILL_GEM_CLASSES.has(itemInfo.itemClass)
  if (!isGem) return []

  const out: StatFilter[] = []

  if (itemInfo.gemLevel > 0) {
    // Gem level as adjustable row with exact min/max
    out.push({
      id: 'misc.gem_level',
      text: `Gem Level: ${itemInfo.gemLevel}`,
      value: itemInfo.gemLevel,
      min: itemInfo.gemLevel,
      max: null,
      enabled: true,
      type: 'gem',
    })
  }

  out.push({
    id: 'misc.gem_transfigured',
    text: 'Transfigured',
    value: null,
    min: null,
    max: null,
    enabled: !!itemInfo.transfigured,
    type: 'gem',
  })

  if (itemInfo.quality > 0) {
    out.push({
      id: 'misc.quality',
      text: `Quality: ${itemInfo.quality}%`,
      value: itemInfo.quality,
      min: itemInfo.quality,
      max: null,
      enabled: itemInfo.quality >= 20,
      type: 'gem',
    })
  }

  return out
}
