import poe1Raw from './item-classes-poe1.json'
import poe2Raw from './item-classes-poe2.json'

/** Inventory footprint plus known basetypes for a single Path of Exile item class. */
export interface ItemClassInfo {
  /** Full list of basetypes that belong to this class. May be empty when the PoE2
   *  file doesn't yet enumerate bases for a class we just need size info on. */
  bases: BaseItemInfo[]
  /** Inventory slot size as `[width, height]`. */
  size: [number, number]
}

/** Per-basetype data. Carries the displayed name plus any base-specific
 *  metadata we've harvested (e.g. attribute requirements for SocketRecolor's
 *  Vorici math, sourced from repoe-fork via fetch-base-item-requirements.js). */
export interface BaseItemInfo {
  name: string
  /** [strength, dexterity, intelligence] requirements at the base item's intrinsic
   *  level. Optional because PoE2 entries and accessory/jewel classes have none. */
  reqs?: [number, number, number]
}

// JSON imports widen tuple literals to `number[]`, so cast through `unknown`
// to pin the `[width, height]` pair shape we actually expect at runtime.
const POE1 = poe1Raw as unknown as Record<string, ItemClassInfo>
const POE2_RAW = poe2Raw as unknown as Record<string, ItemClassInfo>

// PoE2 redefines some shared class names (Body Armours, Helmets, ...) with a
// different base list -- the names match what the in-game clipboard prints,
// which uses plurals just like PoE1. PoE2 entries WIN over PoE1 for shared
// keys, so the per-version lookup below returns each game's own bases.
const POE2 = { ...POE1, ...POE2_RAW }

/** Per-version lookup. The only public accessor for class data -- always go
 *  through this so PoE1 callers see pure PoE1 bases (no PoE2 shadowing) and
 *  PoE2 callers see PoE2's overrides on top of PoE1 fallback for classes PoE2
 *  hasn't enumerated yet. There is intentionally no merged-across-games map:
 *  module-level consumers in the renderer init via initItemClassMaps(version)
 *  once poeVersion is known; main-process consumers call this lazily at use
 *  sites since getPoeVersion() is reliable by then. */
export function getItemClasses(version: 1 | 2): Record<string, ItemClassInfo> {
  return version === 2 ? POE2 : POE1
}
