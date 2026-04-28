/** Max-socket caps by PoE 1 item class. PoE caps are class-based, not inventory-cell
 *  based -- a 1H sword is 2x3=6 cells but caps at 3 sockets, a Thrusting 1H is
 *  1x4=4 cells and also caps at 3. RePoE doesn't expose this; values are the
 *  in-game caps. PoE 2 sockets work differently (runes via socket gates), so this
 *  is PoE1-only -- add a separate map if PoE 2 ever needs it. */
export const MAX_SOCKETS_BY_CLASS_POE1: Record<string, number> = {
  // 1H weapons
  'One Hand Axes': 3,
  'One Hand Maces': 3,
  'One Hand Swords': 3,
  'Thrusting One Hand Swords': 3,
  'Rune Daggers': 3,
  Daggers: 3,
  Claws: 3,
  Wands: 3,
  Sceptres: 3,
  // 2H weapons
  'Two Hand Axes': 6,
  'Two Hand Maces': 6,
  'Two Hand Swords': 6,
  Bows: 6,
  Staves: 6,
  Warstaves: 6,
  'Fishing Rods': 4,
  // Armour
  'Body Armours': 6,
  Helmets: 4,
  Gloves: 4,
  Boots: 4,
  Shields: 3,
  // No sockets at all
  Quivers: 0,
  Belts: 0,
  Rings: 0,
  Amulets: 0,
  Flasks: 0,
  Jewels: 0,
  'Abyss Jewels': 0,
}
