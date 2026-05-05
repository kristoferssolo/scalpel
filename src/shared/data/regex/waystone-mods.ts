import { waystoneRegex, type WaystoneRegex } from './vendor/waystones/Waystone.Gen'

/** PoE2 waystone affix type. Prefixes are beneficial mods (worth wanting), suffixes
 *  are harmful (worth avoiding). The Maps generator's "danger" axis doesn't apply
 *  here -- waystones don't carry a per-mod ranking. */
export type WaystoneAffix = 'PREFIX' | 'SUFFIX'

export interface WaystoneMod {
  /** Stable id derived from the mod name -- used for selection sets and presets. */
  id: number
  regex: string
  /** Display text. The vendor source joins multi-line mods with `|`; we expose the
   *  raw joined string and let the renderer split on it. */
  text: string
  affix: WaystoneAffix
  /** Roll ranges per `#` placeholder in the mod text. Empty when the mod has no
   *  numeric component (e.g. "Players are periodically Cursed with Enfeeble"). */
  ranges: number[][]
  /** Discrete sample values seen in vendor data. Used by the regex engine to choose
   *  a default magnitude when the user selects the mod without a specific value. */
  values: number[]
}

/** Stable hash from the mod name (must match across runs / locales). String hashing
 *  via the same approach as poe-vendor-string's mapmods uses, so ids stay consistent
 *  if we later sync mod names. */
function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0
  }
  return h
}

/** Format the raw vendor text for display: vendor uses `##%` and `#%` placeholders
 *  to indicate roll values; our existing ModList renderer expects `#` placeholders.
 *  Collapse all `##%`/`##`/`#%` to `#%`/`#` and leave the `|` separator intact for
 *  multi-line mods. */
function formatText(rawName: string): string {
  return rawName.replace(/##%/g, '#%').replace(/##/g, '#')
}

function tokensToMods(data: WaystoneRegex[]): WaystoneMod[] {
  return data.map((m) => ({
    id: hashName(m.name),
    regex: m.regex,
    text: formatText(m.name),
    affix: m.affix as WaystoneAffix,
    ranges: m.ranges,
    values: m.values,
  }))
}

export const WAYSTONE_MODS: WaystoneMod[] = tokensToMods(waystoneRegex)
