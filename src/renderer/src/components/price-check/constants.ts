import { RARITY_COLORS, iconMap, baseToClass, classSizes } from '../../shared/constants'
import { formatPrice, getItemIcon } from '../../shared/utils'
// CURRENCY_ICONS_* below are module-load-time currency-abbrev -> icon-url maps.
// Both games share the same trade-API currency IDs (chaos, divine, exa, regal,
// ...) but the icon art differs between versions, so we build one map per sheet
// and dispatch on poeVersion via getCurrencyIconMap(v).
import itemIconsPoe1 from '../../../../shared/data/items/item-icons-poe1.json'
import itemIconsPoe2 from '../../../../shared/data/items/item-icons-poe2.json'
import baseToUniques from '../../../../shared/data/items/unique-info.json'
import elderIcon from '../../assets/influences/Elder-item-symbol.png'
import shaperIcon from '../../assets/influences/Shaper-item-symbol.png'
import crusaderIcon from '../../assets/influences/Crusader-item-symbol.png'
import redeemerIcon from '../../assets/influences/Redeemer-item-symbol.png'
import hunterIcon from '../../assets/influences/Hunter-item-symbol.png'
import warlordIcon from '../../assets/influences/Warlord-item-symbol.png'
import searingExarchIcon from '../../assets/influences/SearingExarch-item-symbol.png'
import eaterOfWorldsIcon from '../../assets/influences/EaterOfWorlds-item-symbol.png'
import socketRed from '../../assets/sockets/socket-red.png'
import socketGreen from '../../assets/sockets/socket-green.png'
import socketBlue from '../../assets/sockets/socket-blue.png'
import socketWhite from '../../assets/sockets/socket-white.png'
import socketAbyss from '../../assets/sockets/socket-abyss.png'

export { RARITY_COLORS, iconMap }
export { formatPrice, getItemIcon }
export { socketWhite }
export { default as ninjaIcon } from '../../assets/other/poe-ninja.png'
export { default as socketLink } from '../../assets/sockets/socket-link.png'

export const INFLUENCE_ICONS: Record<string, string> = {
  'misc.influence_elder': elderIcon,
  'misc.influence_shaper': shaperIcon,
  'misc.influence_crusader': crusaderIcon,
  'misc.influence_redeemer': redeemerIcon,
  'misc.influence_hunter': hunterIcon,
  'misc.influence_warlord': warlordIcon,
  'misc.influence_searing_exarch': searingExarchIcon,
  'misc.influence_eater_of_worlds': eaterOfWorldsIcon,
}

export const INFLUENCE_ICONS_BY_NAME: Record<string, string> = {
  Elder: elderIcon,
  Shaper: shaperIcon,
  Crusader: crusaderIcon,
  Redeemer: redeemerIcon,
  Hunter: hunterIcon,
  Warlord: warlordIcon,
  'Searing Exarch': searingExarchIcon,
  'Eater of Worlds': eaterOfWorldsIcon,
}

const _baseToUniques = baseToUniques as Record<string, string[]>
export const uniqueToBase: Record<string, string> = {}
for (const [base, uniques] of Object.entries(_baseToUniques)) {
  for (const name of uniques) uniqueToBase[name] = base
}

// Map trade API currency keys to item-icons.json names. PoE1 version keeps its
// existing full set; PoE2 version only maps the currencies that actually exist
// in PoE2 and are in our static icon sheet. Missing entries fall back to text
// rendering in TradeListings/BulkListings.
function buildCurrencyIcons(icons: Record<string, string>): Record<string, string> {
  const entries: Record<string, string> = {}
  const pairs: Array<[string, string]> = [
    ['chaos', 'Chaos Orb'],
    ['divine', 'Divine Orb'],
    ['exa', 'Exalted Orb'],
    ['exalted', 'Exalted Orb'],
    ['alch', 'Orb of Alchemy'],
    ['alt', 'Orb of Alteration'],
    ['mirror', 'Mirror of Kalandra'],
    ['chrom', 'Chromatic Orb'],
    ['blessed', 'Blessed Orb'],
    ['fusing', 'Orb of Fusing'],
    ['jewellers', "Jeweller's Orb"],
    ['jew', "Jeweller's Orb"],
    ['regal', 'Regal Orb'],
    ['annul', 'Orb of Annulment'],
    ['vaal', 'Vaal Orb'],
    ['chance', 'Orb of Chance'],
    ['aug', 'Orb of Augmentation'],
    ['regret', 'Orb of Regret'],
    ['scour', 'Orb of Scouring'],
    ['transmute', 'Orb of Transmutation'],
    ['wisdom', 'Scroll of Wisdom'],
    ['portal', 'Portal Scroll'],
    ['scrap', "Armourer's Scrap"],
    ['whetstone', "Blacksmith's Whetstone"],
    ['gcp', "Gemcutter's Prism"],
    ['bauble', "Glassblower's Bauble"],
  ]
  for (const [key, name] of pairs) {
    const url = icons[name]
    if (url) entries[key] = url
  }
  return entries
}

const CURRENCY_ICONS_POE1: Record<string, string> = buildCurrencyIcons(itemIconsPoe1 as Record<string, string>)
const CURRENCY_ICONS_POE2: Record<string, string> = buildCurrencyIcons(itemIconsPoe2 as Record<string, string>)

export function getCurrencyIconMap(version: 1 | 2): Record<string, string> {
  return version === 2 ? CURRENCY_ICONS_POE2 : CURRENCY_ICONS_POE1
}

export const SOCKET_IMGS: Record<string, string> = {
  R: socketRed,
  G: socketGreen,
  B: socketBlue,
  W: socketWhite,
  A: socketAbyss,
  Ab: socketAbyss,
}

export function getItemSize(itemClass: string, name?: string): [number, number] {
  if (name) {
    const base = uniqueToBase[name]
    if (base) {
      const cls = baseToClass[base]
      if (cls && classSizes[cls]) return classSizes[cls]
    }
  }
  return classSizes[itemClass] ?? [2, 2]
}

export const MOD_COLORS: Record<string, string> = {
  'temple-key': '#ffd700',
  temple: '#c4a35a',
  foulborn: '#EA44A8',
  heist: '#ffcc88',
  gem: '#a8e6cf',
  weapon: '#88ccff',
  defence: '#88ccff',
  pseudo: '#88ccff',
  implicit: '#af8aff',
  crafted: '#B8DAF1',
  fractured: 'var(--accent)',
  desecrated: '#9ccc65',
  imbued: '#a8e6cf',
  enchant: '#a8e6cf',
  map: '#80cbc4',
  explicit: '#8787FE',
  tierPrefix: '#ec7676',
  tierSuffix: '#7aaff1',
}

export const MOD_BOLD_TYPES = new Set(['pseudo', 'defence', 'temple-key'])

export const CHIP_COLORS: Record<string, string> = {
  'pseudo.pseudo_number_of_empty_prefix_mods': '#4caf50',
  'pseudo.pseudo_number_of_empty_suffix_mods': '#4caf50',
  'misc.corrupted': '#ef5350',
  'misc.mirrored': '#8787FE',
  'misc.identified': '#ffb74d',
}

export const TERNARY_CHIP_IDS = new Set(['misc.corrupted', 'misc.mirrored', 'misc.fractured'])
export const MINMAX_CHIP_IDS = new Set(['misc.ilvl'])

export function getChipColor(id: string): string {
  if (CHIP_COLORS[id]) return CHIP_COLORS[id]
  if (id.startsWith('misc.influence_')) return '#c8a2c8'
  return 'var(--accent)'
}

export function getModColor(type: string, foulborn?: boolean): string {
  if (foulborn) return MOD_COLORS.foulborn
  return MOD_COLORS[type] ?? 'var(--text)'
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
