import chaosPoe1 from '../assets/currency/chaos-orb.png'
import divinePoe1 from '../assets/currency/divine-orb.png'
import divinePoe2 from '../assets/currency/poe2/divine-orb.png'
import exaltedPoe2 from '../assets/currency/poe2/exalted-orb.png'

/** PoE1-only currency icons. CONTRACT: import these *only* inside a subtree
 *  gated by a `features.X` flag that's false on PoE2 (dust explorer, div cards,
 *  socket recolor). Game-agnostic UI must use `getCurrencyIcons(version)`
 *  below; importing chaosIcon there would silently render the PoE1 art on a
 *  PoE2 item, which is the kind of "subtle wrong" that takes a week to catch. */
export { default as chaosIcon } from '../assets/currency/chaos-orb.png'
export { default as divineIcon } from '../assets/currency/divine-orb.png'
export { default as goldIcon } from '../assets/currency/gold.png'
export { default as faustusPortrait } from '../assets/other/faustus-portrait.png'
export { default as angePortrait } from '../assets/other/ange-portrait.png'

/** `baseline` is the cheap-currency icon shown next to PriceInfo.chaosValue --
 *  chaos in PoE1, exalted in PoE2 (the two games' low-tier economy unit). Game-
 *  agnostic UI (price check, item header, trade chips) should call this rather
 *  than import `chaosIcon` directly so PoE2 gets the right icon. */
export function getCurrencyIcons(version: 1 | 2): { baseline: string; divine: string } {
  return version === 2 ? { baseline: exaltedPoe2, divine: divinePoe2 } : { baseline: chaosPoe1, divine: divinePoe1 }
}
