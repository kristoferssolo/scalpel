import type { AdvancedMod } from '../../../../shared/types'
import type { StatFilter } from '../../trade'

type MapItemInfo = {
  itemClass?: string
  rarity?: string
  mapQuantity?: number
  mapRarity?: number
  mapPackSize?: number
  mapMoreScarabs?: number
  mapMoreCurrency?: number
  mapMoreMaps?: number
  mapMoreDivCards?: number
  mapReward?: string
}

// Map property chips (Item Quantity, Rarity, Pack Size, More X) and 8-mod corrupted maps
export function buildMapFilters(itemInfo: MapItemInfo | undefined, advancedMods?: AdvancedMod[]): StatFilter[] {
  const out: StatFilter[] = []

  if (itemInfo && itemInfo.itemClass === 'Maps' && itemInfo.rarity === 'Rare') {
    const mapMin = (v: number) => Math.floor(v * 0.9)
    if (itemInfo.mapQuantity)
      out.push({
        id: 'map.map_iiq',
        text: `Quantity: +${itemInfo.mapQuantity}%`,
        value: itemInfo.mapQuantity,
        min: mapMin(itemInfo.mapQuantity),
        max: null,
        enabled: true,
        type: 'map',
      })
    if (itemInfo.mapRarity)
      out.push({
        id: 'map.map_iir',
        text: `Rarity: +${itemInfo.mapRarity}%`,
        value: itemInfo.mapRarity,
        min: mapMin(itemInfo.mapRarity),
        max: null,
        enabled: false,
        type: 'map',
      })
    if (itemInfo.mapPackSize)
      out.push({
        id: 'map.map_packsize',
        text: `Pack Size: +${itemInfo.mapPackSize}%`,
        value: itemInfo.mapPackSize,
        min: mapMin(itemInfo.mapPackSize),
        max: null,
        enabled: true,
        type: 'map',
      })
    // More Scarabs/Currency/Maps/Div Cards are pseudo stats
    if (itemInfo.mapMoreScarabs)
      out.push({
        id: 'pseudo.pseudo_map_more_scarab_drops',
        text: `More Scarabs: +${itemInfo.mapMoreScarabs}%`,
        value: itemInfo.mapMoreScarabs,
        min: mapMin(itemInfo.mapMoreScarabs),
        max: null,
        enabled: true,
        type: 'map',
      })
    if (itemInfo.mapMoreCurrency)
      out.push({
        id: 'pseudo.pseudo_map_more_currency_drops',
        text: `More Currency: +${itemInfo.mapMoreCurrency}%`,
        value: itemInfo.mapMoreCurrency,
        min: mapMin(itemInfo.mapMoreCurrency),
        max: null,
        enabled: true,
        type: 'map',
      })
    if (itemInfo.mapMoreMaps)
      out.push({
        id: 'pseudo.pseudo_map_more_map_drops',
        text: `More Maps: +${itemInfo.mapMoreMaps}%`,
        value: itemInfo.mapMoreMaps,
        min: mapMin(itemInfo.mapMoreMaps),
        max: null,
        enabled: true,
        type: 'map',
      })
    if (itemInfo.mapMoreDivCards)
      out.push({
        id: 'pseudo.pseudo_map_more_card_drops',
        text: `More Div Cards: +${itemInfo.mapMoreDivCards}%`,
        value: itemInfo.mapMoreDivCards,
        min: mapMin(itemInfo.mapMoreDivCards),
        max: null,
        enabled: true,
        type: 'map',
      })
    if (itemInfo.mapReward)
      out.push({
        id: 'map.map_completion_reward',
        text: `Reward: ${itemInfo.mapReward}`,
        value: null,
        min: null,
        max: null,
        enabled: true,
        type: 'map',
        option: itemInfo.mapReward,
      })
  }

  // 8-mod corrupted maps (4 prefix + 4 suffix)
  if (itemInfo && itemInfo.itemClass === 'Maps' && advancedMods && advancedMods.length > 0) {
    const prefixCount = advancedMods.filter((m) => m.type === 'prefix').length
    const suffixCount = advancedMods.filter((m) => m.type === 'suffix').length
    if (prefixCount >= 4 && suffixCount >= 4) {
      out.push({
        id: 'pseudo.pseudo_number_of_affix_mods',
        text: '8 Mods',
        value: 8,
        min: 8,
        max: null,
        enabled: true,
        type: 'misc',
      })
    }
  }

  return out
}
