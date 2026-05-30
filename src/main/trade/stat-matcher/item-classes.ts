// ─── Item Class to Trade Category ─────────────────────────────────────────────

export const ITEM_CLASS_TO_CATEGORY: Record<string, string> = {
  // Shared between PoE1 and PoE2 (clipboard plural form -> trade `category` id).
  Rings: 'accessory.ring',
  Amulets: 'accessory.amulet',
  Belts: 'accessory.belt',
  Helmets: 'armour.helmet',
  'Body Armours': 'armour.chest',
  Gloves: 'armour.gloves',
  Boots: 'armour.boots',
  Shields: 'armour.shield',
  Quivers: 'armour.quiver',
  Bows: 'weapon.bow',
  Claws: 'weapon.claw',
  Daggers: 'weapon.dagger',
  'One Hand Axes': 'weapon.oneaxe',
  'One Hand Maces': 'weapon.onemace',
  'One Hand Swords': 'weapon.onesword',
  Sceptres: 'weapon.sceptre',
  Staves: 'weapon.staff',
  'Thrusting One Hand Swords': 'weapon.onesword',
  'Two Hand Axes': 'weapon.twoaxe',
  'Two Hand Maces': 'weapon.twomace',
  'Two Hand Swords': 'weapon.twosword',
  Wands: 'weapon.wand',
  Warstaves: 'weapon.warstaff',
  'Rune Daggers': 'weapon.runedagger',
  Jewels: 'jewel',
  Flasks: 'flask',
  // PoE2-only classes that have live listings. Keeping them in the same map
  // is safe -- no key collides with PoE1, and stat-matcher / trade.ts both
  // look up by the exact class name the clipboard reports. Without these
  // entries the trade router falls back to `query.type = baseType`, which
  // constrains the search to one base type when the user wants the whole
  // class. Excluded classes that PoE2 players never see drops in (Claws,
  // Daggers, Flails, 1H/2H Swords + Axes, Trap Tools) -- adding them here
  // would point the router at a category with zero live listings.
  Bucklers: 'armour.buckler',
  Crossbows: 'weapon.crossbow',
  Spears: 'weapon.spear',
  Foci: 'armour.focus',
  'Fishing Rods': 'weapon.rod',
  Talismans: 'weapon.talisman',
  // PoE2 clipboard reports "Quarterstaves" where PoE1 reports "Warstaves";
  // both map to the same trade category.
  Quarterstaves: 'weapon.warstaff',
}

const ARMOUR_CLASSES = new Set(['Helmets', 'Body Armours', 'Gloves', 'Boots', 'Shields'])
// Item classes that have local weapon mods
const WEAPON_CLASSES = new Set([
  'Bows',
  'Claws',
  'Daggers',
  'One Hand Axes',
  'One Hand Maces',
  'One Hand Swords',
  'Sceptres',
  'Staves',
  'Thrusting One Hand Swords',
  'Two Hand Axes',
  'Two Hand Maces',
  'Two Hand Swords',
  'Wands',
  'Warstaves',
  'Quarterstaves',
  'Rune Daggers',
])

export { ARMOUR_CLASSES, WEAPON_CLASSES }
