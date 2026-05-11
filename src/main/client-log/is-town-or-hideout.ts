/** Per-version sets of area codes for towns where items can't drop. PoE1
 *  uses numeric act-prefixed codes plus Oriath ("EpilogueTown"). PoE2 uses
 *  `G<act>_town` for the campaign run and `C_G<act>_town` for cruel. These
 *  lists were harvested from Client.txt samples; missing entries safe-fail
 *  to "real zone" (toggle stays visible). Add a code here if a user
 *  reports the toggle appearing in an unlisted town. */
const POE1_TOWNS: ReadonlySet<string> = new Set([
  '1_1_town',
  '1_2_town',
  '2_1_town',
  '3_town',
  '4_town',
  '5_town',
  '6_town',
  '7_town',
  '8_town',
  '9_town',
  '10_town',
  'EpilogueTown',
])

const POE2_TOWNS: ReadonlySet<string> = new Set([
  'G1_town',
  'G2_town',
  'G3_town',
  'C_G1_town',
  'C_G2_town',
  'C_G3_town',
])

const HIDEOUT_PATTERN = /hideout/i

/** True for any area where items don't drop (towns or hideouts). The
 *  FilterPanel uses this to decide whether the "Use Current Zone" toggle
 *  should be visible. */
export function isTownOrHideout(areaCode: string, version: 1 | 2): boolean {
  if (HIDEOUT_PATTERN.test(areaCode)) return true
  return (version === 2 ? POE2_TOWNS : POE1_TOWNS).has(areaCode)
}
