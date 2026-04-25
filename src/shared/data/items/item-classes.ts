import poe1Raw from './item-classes-poe1.json'
import poe2Raw from './item-classes-poe2.json'

/** Inventory footprint plus known basetypes for a single Path of Exile item class. */
export interface ItemClassInfo {
  /** Full list of basetypes that belong to this class. May be empty when the PoE2
   *  file doesn't yet enumerate bases for a class we just need size info on. */
  bases: string[]
  /** Inventory slot size as `[width, height]`. */
  size: [number, number]
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

/** Per-version lookup. Use this wherever the caller knows the active PoE version
 *  (IPC handlers, version-aware renderers). Class names that don't exist in the
 *  requested version simply aren't in the map. */
export function getItemClasses(version: 1 | 2): Record<string, ItemClassInfo> {
  return version === 2 ? POE2 : POE1
}

/** Union of every class we know about across both games. Use this from module-
 *  level static map builds (e.g. base-to-class reverse maps assembled at import
 *  time, before the renderer learns its game version). For shared class names
 *  the PoE2 entry wins, so prefer `getItemClasses(version)` when the caller
 *  knows which game it's serving. */
export const ITEM_CLASSES_ALL: Record<string, ItemClassInfo> = POE2
