import type { AdvancedMod } from '../../../../shared/types'
import type { StatFilter } from '../../trade'

type MapItemInfo = {
  itemClass?: string
  rarity?: string
  mapTier?: number
  mapQuantity?: number
  mapRarity?: number
  mapPackSize?: number
  mapMoreScarabs?: number
  mapMoreCurrency?: number
  mapMoreMaps?: number
  mapMoreDivCards?: number
  mapReward?: string
  mapRevives?: number
  mapDropChance?: number
  mapGold?: number
  mapMagicMonsters?: number
  mapRareMonsters?: number
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

  // PoE2 waystones: surface the property block as map_filter chips. Trade2 keys:
  // map_tier, map_iir, map_iiq, map_packsize, map_revives, map_bonus (drop chance),
  // map_gold, map_magic_monsters, map_rare_monsters. The random per-waystone
  // monster affixes still flow through the normal explicit matcher. Tier defaults
  // on (the dominant price axis); the rest are opt-in so the search isn't
  // over-constrained.
  if (itemInfo && itemInfo.itemClass === 'Waystones' && itemInfo.rarity === 'Rare') {
    const wsMin = (v: number) => Math.floor(v * 0.9)
    const pushChip = (id: string, label: string, value: number, enabled: boolean, exact = false) =>
      out.push({
        id,
        text: `${label}: ${value}`,
        value,
        min: exact ? value : wsMin(value),
        max: exact ? value : null,
        enabled,
        type: 'map',
      })
    if (itemInfo.mapTier) pushChip('map.map_tier', 'Tier', itemInfo.mapTier, true, true)
    if (itemInfo.mapRarity) pushChip('map.map_iir', 'Rarity', itemInfo.mapRarity, false)
    if (itemInfo.mapQuantity) pushChip('map.map_iiq', 'Quantity', itemInfo.mapQuantity, false)
    if (itemInfo.mapPackSize) pushChip('map.map_packsize', 'Pack Size', itemInfo.mapPackSize, false)
    if (itemInfo.mapRevives) pushChip('map.map_revives', 'Revives', itemInfo.mapRevives, false)
    if (itemInfo.mapDropChance) pushChip('map.map_bonus', 'Drop Chance', itemInfo.mapDropChance, false)
    if (itemInfo.mapGold) pushChip('map.map_gold', 'Gold', itemInfo.mapGold, false)
    if (itemInfo.mapMagicMonsters)
      pushChip('map.map_magic_monsters', 'Magic Monsters', itemInfo.mapMagicMonsters, false)
    if (itemInfo.mapRareMonsters) pushChip('map.map_rare_monsters', 'Rare Monsters', itemInfo.mapRareMonsters, false)
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
