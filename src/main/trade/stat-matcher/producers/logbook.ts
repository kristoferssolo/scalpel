import type { StatFilter } from '../../trade'

type LogbookItemInfo = {
  logbookFactions?: string[]
  logbookBosses?: string[]
}

// Logbook faction and boss chips
export function buildLogbookFilters(itemInfo: LogbookItemInfo | undefined): StatFilter[] {
  const out: StatFilter[] = []

  if (itemInfo?.logbookFactions && itemInfo.logbookFactions.length > 0) {
    const factionLabels: Record<string, string> = {
      knights: 'Knights of the Sun',
      mercenaries: 'Black Scythe Mercenaries',
      order: 'Order of the Chalice',
      druids: 'Druids of the Broken Circle',
    }
    for (const faction of itemInfo.logbookFactions) {
      out.push({
        id: `pseudo.pseudo_logbook_faction_${faction}`,
        text: factionLabels[faction] ?? faction,
        value: null,
        min: null,
        max: null,
        enabled: true,
        type: 'pseudo',
      })
    }
  }

  if (itemInfo?.logbookBosses && itemInfo.logbookBosses.length > 0) {
    const bossOptions: Record<string, number> = {
      'Medved, Feller of Heroes': 1,
      'Vorana, Last to Fall': 2,
      'Uhtred, Covetous Traitor': 3,
      'Olroth, Origin of the Fall': 4,
    }
    for (const boss of itemInfo.logbookBosses) {
      const optionId = bossOptions[boss]
      if (optionId) {
        out.push({
          id: 'implicit.stat_3159649981',
          text: boss,
          value: null,
          min: null,
          max: null,
          enabled: true,
          type: 'implicit',
          option: optionId,
        })
      }
    }
  }

  return out
}
