import type { StatFilter } from '../../trade'

type HeistItemInfo = {
  heistJob?: { skill: string; level: number }
  monsterLevel?: number
  wingsRevealed?: number
  wingsTotal?: number
  itemClass?: string
}

// Heist job skill requirement (contracts only; blueprints have multiple jobs that don't filter search)
// Area level chip (for heist contracts/blueprints)
// Heist blueprint wings revealed
export function buildHeistFilters(itemInfo: HeistItemInfo | undefined): StatFilter[] {
  const out: StatFilter[] = []

  if (itemInfo?.heistJob && itemInfo.itemClass === 'Contracts') {
    const skillKey = itemInfo.heistJob.skill.toLowerCase().replace(/\s+/g, '_')
    out.push({
      id: `heist.heist_${skillKey}`,
      text: `Requires ${itemInfo.heistJob.skill} (Level ${itemInfo.heistJob.level})`,
      value: itemInfo.heistJob.level,
      min: 1,
      max: null,
      enabled: true,
      type: 'heist',
    })
  }

  // Area level chip (for heist contracts/blueprints)
  if (itemInfo?.monsterLevel && itemInfo.itemClass !== 'Maps' && itemInfo.itemClass !== 'Sanctum Research') {
    out.push({
      id: 'misc.area_level',
      text: `Area Level: ${itemInfo.monsterLevel}`,
      value: itemInfo.monsterLevel,
      min: itemInfo.monsterLevel,
      max: null,
      enabled: true,
      type: 'misc',
    })
  }

  // Heist blueprint wings revealed
  if (itemInfo?.wingsRevealed != null) {
    out.push({
      id: 'heist.heist_wings',
      text: `Wings Revealed: ${itemInfo.wingsRevealed}`,
      value: itemInfo.wingsRevealed,
      min: itemInfo.wingsRevealed,
      max: null,
      enabled: true,
      type: 'heist',
    })
    if (itemInfo.wingsTotal) {
      out.push({
        id: 'heist.heist_max_wings',
        text: `Total Wings: ${itemInfo.wingsTotal}`,
        value: itemInfo.wingsTotal,
        min: itemInfo.wingsTotal,
        max: null,
        enabled: true,
        type: 'heist',
      })
    }
  }

  return out
}
