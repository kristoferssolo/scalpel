import divCardsData from '../../../shared/data/economy/div-cards.json'
import itemIconsPoe1 from '../../../shared/data/items/item-icons-poe1.json'
import itemIconsPoe2 from '../../../shared/data/items/item-icons-poe2.json'

export const RARITY_COLORS: Record<string, string> = {
  Normal: '#c8c8c8',
  Magic: '#8888ff',
  Rare: '#ffff77',
  Unique: '#af6025',
  Gem: '#1ba29b',
  Divination: '#016a8b',
}

export const IP = {
  theme: 'two-tone' as const,
  fill: ['currentColor', 'rgba(255,255,255,0.2)'] as [string, string],
  style: { display: 'flex' },
}

const ICONS_BY_VERSION: Record<1 | 2, Record<string, string>> = {
  1: itemIconsPoe1 as Record<string, string>,
  2: itemIconsPoe2 as Record<string, string>,
}

/** Shared item-icon lookup. Populated by initIconMap() once the renderer learns
 *  its PoE version via IPC. Consumers import this object and read `iconMap[name]`
 *  -- we mutate it in place so module references stay valid across the init. */
export const iconMap: Record<string, string> = {}

export function initIconMap(version: 1 | 2): void {
  for (const k of Object.keys(iconMap)) delete iconMap[k]
  Object.assign(iconMap, ICONS_BY_VERSION[version])
}

export const divCardArtMap = new Map((divCardsData as Array<{ name: string; art: string }>).map((c) => [c.name, c.art]))
