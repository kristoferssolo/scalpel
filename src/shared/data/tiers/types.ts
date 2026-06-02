/** One stat range within a mod tier (the raw RePoE stat). */
export interface TierStat {
  id: string
  min: number
  max: number
}

/** A single tier in a mod group's ladder, resolved into the row's value-space. */
export interface ModTier {
  /** Display tier number, anchored to the in-game tier of the rolled affix. */
  tier: number
  /** Affix name (e.g. "Stout"). Locale-dependent; informational only. */
  name: string
  /** Required item level for this tier. */
  ilvl: number
  /** Raw per-stat ranges (for completeness / future use). */
  stats: TierStat[]
  /** Scrub range in the row's value-space: single-stat = the one stat's range;
   *  trade-averaged multi-stat = [avg(stat mins), avg(stat maxs)]. */
  range: { min: number; max: number }
  /** Mod text template (e.g. "+(60-69) to maximum Life"). */
  text: string
}

/** A resolved ladder for one mod group on one base type, ordered ascending by value. */
export interface TierLadder {
  group: string
  scrubbable: boolean
  tiers: ModTier[]
}

/** Compact dataset shape emitted by scripts/build-tier-data.js. */
export interface TierDataset {
  schemaVersion: number
  /** Global deduped mods: [name, reqLevel, group, stats, text] compacted as below. */
  mods: Array<{ n: string; l: number; g: string; s: Array<[string, number, number]>; t: string }>
  /** Deduped group-maps: group -> ascending tier-index list (into `mods`). */
  pools: Array<Record<string, number[]>>
  /** Base display name -> index into `pools`. */
  bases: Record<string, number>
}
