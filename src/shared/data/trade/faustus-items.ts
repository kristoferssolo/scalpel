/** Item classes that are available on the Faustus in-game Currency Exchange Market */
export const FAUSTUS_CLASSES = new Set([
  'Currency',
  'Stackable Currency',
  'Essences',
  'Delve Stackable Socketable Currency',
  'Delve Socketable Currency',
  'Scarabs',
  'Divination Cards',
  'Map Fragments',
])

/** Item classes that match a Faustus class but should NOT show the warning */
export const FAUSTUS_EXCEPTIONS = new Set<string>([
  // Not on Faustus exchange
])

/** Specific base types that are Faustus-eligible regardless of class */
export const FAUSTUS_BASE_TYPES = new Set([
  // Delirium
  'Delirium Orb',
  'Simulacrum',
  'Simulacrum Splinter',
  // Refracting
  'Refracting Fog',
  // Legion
  'Timeless Karui Emblem',
  'Timeless Maraketh Emblem',
  'Timeless Eternal Empire Emblem',
  'Timeless Templar Emblem',
  'Timeless Vaal Emblem',
  'Timeless Karui Splinter',
  'Timeless Maraketh Splinter',
  'Timeless Eternal Empire Splinter',
  'Timeless Templar Splinter',
  'Timeless Vaal Splinter',
  // Oils
  'Clear Oil',
  'Sepia Oil',
  'Amber Oil',
  'Verdant Oil',
  'Teal Oil',
  'Azure Oil',
  'Indigo Oil',
  'Violet Oil',
  'Crimson Oil',
  'Black Oil',
  'Opalescent Oil',
  'Silver Oil',
  'Golden Oil',
  // Catalysts
  'Turbulent Catalyst',
  'Imbued Catalyst',
  'Abrasive Catalyst',
  'Tempering Catalyst',
  'Fertile Catalyst',
  'Intrinsic Catalyst',
  'Prismatic Catalyst',
  // Omens
  'Omen of Amelioration',
  'Omen of Blanching',
  'Omen of Connections',
  'Omen of Corruption',
  'Omen of Damnation',
  "Omen of Death's Door",
  'Omen of Decimation',
  'Omen of Fortune',
  'Omen of Refreshment',
  'Omen of Return',
  'Omen of the Jeweller',
  'Omen of the Soul Devourer',
  'Omen of Whittling',
  // Tattoos
  'Tattoo of the Arohongui Moonwatcher',
  'Tattoo of the Hinekora Storyteller',
  'Tattoo of the Kitava Blood Drinker',
  'Tattoo of the Ramako Flint',
  'Tattoo of the Rongokurai War Striker',
  'Tattoo of the Tawhoa Shaman',
  'Tattoo of the Tukohama Warmonger',
  'Tattoo of the Valako Stormrider',
  // Expedition
  'Astragali',
  'Burial Medallion',
  'Exotic Coinage',
  'Scrap Metal',
  // Harvest
  'Vivid Lifeforce',
  'Wild Lifeforce',
  'Primal Lifeforce',
  'Sacred Lifeforce',
  // Runegrafts
  'Runegraft of the Dawn',
  'Runegraft of the Dusk',
  'Runegraft of the Eclipse',
  'Runegraft of the Equinox',
  'Runegraft of the Moon',
  'Runegraft of the Solstice',
  'Runegraft of the Stars',
  'Runegraft of the Sun',
  'Runegraft of the Twilight',
  // Allflames / Djinn
  'Allflame Ember',
  'Djinn Barya',
])

export function isFaustusItem(itemClass: string, baseType: string): boolean {
  if (FAUSTUS_EXCEPTIONS.has(baseType) || FAUSTUS_EXCEPTIONS.has(itemClass)) return false
  return FAUSTUS_CLASSES.has(itemClass) || FAUSTUS_BASE_TYPES.has(baseType)
}
