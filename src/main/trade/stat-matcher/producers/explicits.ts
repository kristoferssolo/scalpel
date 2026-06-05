import { getPoeVersion } from '../../../game-state'
import { attachTierLadder } from './tier-attach'
import { BENEFICIAL_NEGATIVE_KEYWORDS } from '../../../../shared/data/trade/beneficial-negatives'
import { isClusterJewel } from '../../../../shared/poe-item'
import type { StatFilter } from '../../trade'
import { findAdvMod } from '../adv-mods'
import { isDefenseMod, isLocalMod, isLowPriority } from '../classification'
import type { MatchContext } from '../context'
import { matchModToStat } from '../mod-matcher'
import { accumulatePseudo, PSEUDO_CONTRIBUTIONS } from '../pseudo'

// Tinctures: disambiguate duplicate stat texts (e.g. "#% increased effect" has two stat IDs)
const TINCTURE_STAT_REMAP: Record<string, string> = {
  'explicit.stat_2448920197': 'explicit.stat_3529940209', // "#% increased effect" -> tincture-specific variant
}

// Rarity is an important PoE2 mod that should default on, so it overrides the
// low-priority default there (see classification.ts LOW_PRIORITY_PATTERNS).
const RARITY_MOD = /rarity of items found/i

/** Merge rows that share the same stat id by summing their values.
 *  The trade index collapses duplicate explicit rolls (e.g. two "Rarity of Items found"
 *  prefix+suffix) into a single magnitude, so emitting two separate rows produces wrong
 *  price-check results. Single-id groups pass through unchanged.
 *  Merged rows occupy the position of the first occurrence in the output. */
function mergeDuplicateStats(rows: StatFilter[], pct: number): StatFilter[] {
  // Map preserves insertion order, so grouping and then emitting map.values()
  // keeps each merged row at its group's first-seen position.
  const groups = new Map<string, StatFilter[]>()
  for (const row of rows) {
    const existing = groups.get(row.id)
    if (existing) existing.push(row)
    else groups.set(row.id, [row])
  }

  const result: StatFilter[] = []
  for (const group of groups.values()) {
    const first = group[0]
    if (group.length === 1) {
      result.push(first)
      continue
    }
    // Sum values, recompute min/max from the summed value rather than the partial mins
    const allNull = group.every((r) => r.value == null)
    const sum = allNull ? null : group.reduce((acc, r) => acc + (r.value ?? 0), 0)
    let mergedMin: number | null
    if (sum == null) mergedMin = null
    else if (sum >= 0) mergedMin = Math.floor(sum * pct)
    else mergedMin = Math.ceil(sum * (2 - pct))
    const nonNullMaxes = group.map((r) => r.max).filter((m): m is number => m != null)
    const mergedMax = nonNullMaxes.length > 0 ? nonNullMaxes.reduce((a, b) => a + b, 0) : null
    // text is display-only (the query uses value/min/max). The matcher parses the
    // value from the first number in the text, so replacing the first occurrence of
    // the old value reliably hits that number.
    let mergedText = first.text
    if (first.value != null && sum != null) {
      mergedText = first.text.replace(String(Math.abs(first.value)), String(Math.abs(sum)))
    }
    result.push({
      ...first,
      value: sum,
      min: mergedMin,
      max: mergedMax,
      enabled: group.some((r) => r.enabled === true),
      text: mergedText,
      modTier: undefined,
      modRange: undefined,
      tierLadder: undefined,
      perfectRoll: undefined,
      tierQualityMult: undefined,
    })
  }
  return result
}

/** Collapse the junk rows produced when a single stat wraps across multiple
 *  clipboard lines. clipboard.ts emits each physical line AND the joined whole
 *  for multi-line advanced mods; the grammatical fragments ("...type among",
 *  "your Ailments on them") are a prefix/suffix of the trade stat text, so the
 *  substring fallback in mod-matcher resolves them to the SAME stat id as the
 *  joined row but with a null value. The joined row carries the real value, so a
 *  same-id sibling with a null value (and no option) is always that artifact --
 *  drop it. Genuine hybrid mods are unaffected: their lines match DIFFERENT stat
 *  ids, so no value-bearing sibling shares the fragment's id. */
export function dropFragmentDuplicates(rows: StatFilter[]): StatFilter[] {
  const idsWithValue = new Set(rows.filter((r) => r.value != null).map((r) => r.id))
  return rows.filter((r) => r.value != null || r.option != null || !idsWithValue.has(r.id))
}

export function processExplicits(ctx: MatchContext): StatFilter[] {
  const {
    explicits,
    itemInfo,
    advancedMods,
    isWeapon,
    hasLocalMods,
    isGemItem,
    isTimelessJewel,
    hasDefenses,
    pct,
    pseudoAccumulator,
    isRelic,
    isTablet,
  } = ctx
  const out: StatFilter[] = []
  // PoE2's trade API has no crafted.* stat category - crafted mods are queried as
  // explicit.* like any other affix. They also aren't trivially re-rolled the way PoE1
  // bench crafts are, so they're enabled by default. The crafted flag still drives the
  // display color; only trade matching/enablement diverge.
  const isPoe2 = getPoeVersion() === 2

  // Relic affixes are matched against the sanctum.* stat list by buildRelicFilters;
  // tablet affixes by buildTabletFilters (clipboard phrasing differs from trade text).
  // Running either through the explicit matcher risks false or missing matches.
  for (const mod of isGemItem || isRelic || isTablet ? [] : explicits) {
    let isCrafted = /\s*\(crafted\)\s*$/i.test(mod)
    let cleaned = mod.replace(/\s*\(crafted\)\s*$/i, '').trim()
    // Skip timeless jewel mods handled by the timeless chip system
    if (
      isTimelessJewel &&
      (/Passives in radius are Conquered/i.test(cleaned) ||
        /^Historic$/i.test(cleaned) ||
        /Commanded|Commissioned|Carved|Bathed|Denoted|Remembrancing/i.test(cleaned))
    )
      continue
    // Detect crafted/fractured/foulborn from advanced mod data BEFORE matching, so
    // crafted mods (like "Trigger a Socketed Spell when you Use a Skill") are queried
    // against the crafted.* stat list instead of explicit.* -- matching the wrong list
    // fails silently and the mod disappears from the price checker.
    let isFractured = false
    let isFoulborn = false
    let isRandomSupport = false
    let advMod: ReturnType<typeof findAdvMod>
    if (advancedMods) {
      advMod = findAdvMod(advancedMods, cleaned, 'explicit')
      if (advMod?.fractured) isFractured = true
      if (advMod?.foulborn) isFoulborn = true
      if (advMod?.crafted) isCrafted = true
      if (advMod?.randomSupport) isRandomSupport = true
    }
    const useLocal = hasLocalMods && isLocalMod(cleaned, isWeapon)
    const isJewelItem = itemInfo?.itemClass === 'Jewels'
    // In PoE2 a crafted mod trades as an explicit (no crafted.* stats exist).
    const craftedForTrade = isCrafted && !isPoe2
    const matched = matchModToStat(
      cleaned,
      useLocal,
      craftedForTrade ? 'crafted' : 'explicit',
      isRandomSupport,
      isJewelItem,
    )
    if (matched) {
      const lowPriority = isLowPriority(cleaned) && !(isPoe2 && RARITY_MOD.test(cleaned))

      if (advancedMods && advMod) {
        // Apply magnitude multiplier from implicit (e.g. Cogwork Ring "25% increased Suffix Modifier magnitudes")
        if (advMod?.magnitudeMultiplier && matched.value != null) {
          const oldVal = matched.value
          matched.value = Math.trunc(oldVal * advMod.magnitudeMultiplier)
          // Update the display text to show the multiplied value
          cleaned = cleaned.replace(String(Math.abs(oldVal)), String(Math.abs(matched.value)))
        }
      }

      if (itemInfo?.itemClass === 'Tinctures' && TINCTURE_STAT_REMAP[matched.statId]) {
        matched.statId = TINCTURE_STAT_REMAP[matched.statId]
      }

      // Determine if this value is fixed or rolled, and capture tier/range for display
      // Fixed values (min === max in tier range, or no range) use exact match
      // Rolled values use percentage-based min
      let isFixedValue = false
      let matchedTier: number | undefined
      let matchedRange: { min: number; max: number } | undefined
      let advModRanges: Array<{ value: number; min: number; max: number }> | undefined
      let advModName: string | undefined
      let advModMult: number | undefined
      // A unique mod rolled at or above its best possible value. Ranged mods are "perfect"
      // at the max and "over-rolled" (Vaal/corruption) above it; a fixed singular-value mod
      // is special only when over-rolled strictly above its single value. Drives the
      // price-check default-enable for uniques (issue #378). Negative/beneficial-negative
      // rolls never satisfy `>= max`, so they stay off -- intentional, we only auto-enable
      // clear best-or-better rolls.
      let perfectRoll = false
      if (advancedMods && matched.value != null) {
        const rawCleaned = mod.replace(/\s*\(crafted\)\s*$/i, '').trim()
        const advMod = findAdvMod(advancedMods, cleaned, 'explicit', rawCleaned)
        if (advMod) {
          const range = advMod.ranges.find((r) => r.value === matched.value || r.value === -(matched.value ?? 0))
          if (range && range.min === range.max) isFixedValue = true
          if (!range && advMod.ranges.length === 0) isFixedValue = true
          if (advMod.tier > 0) matchedTier = advMod.tier
          if (range && range.min !== range.max) matchedRange = { min: range.min, max: range.max }
          if (range && itemInfo?.rarity === 'Unique' && matched.value != null) {
            perfectRoll = range.min === range.max ? matched.value > range.max : matched.value >= range.max
          }
          // Capture the full per-stat ranges and mod name for tier-ladder resolution.
          advModRanges = advMod.ranges
          advModName = advMod.name
          advModMult = advMod.magnitudeMultiplier
        }
      }
      // For negative values: "reduced" mods use min (trade API expects min for beneficial reduction),
      // while truly negative mods (e.g. "-50% to Lightning Resistance") use max.
      const isNegative = matched.value != null && matched.value < 0
      // Negative mods: default to "bad" (less negative = better, use min).
      // Some keywords indicate the negative is beneficial (more negative = better, use max).
      const isBeneficialNegative = isNegative && BENEFICIAL_NEGATIVE_KEYWORDS.some((p) => p.test(mod))
      let minValue =
        matched.value != null && (!isNegative || !isBeneficialNegative)
          ? isFixedValue
            ? matched.value
            : isNegative
              ? Math.ceil(matched.value * (2 - pct)) // -30 at 90% -> -33 (more negative = wider search)
              : Math.floor(matched.value * pct)
          : null
      // For uniques, don't default below the mod's minimum possible roll unless the item's actual
      // value is already below it (e.g. from Volatile Vaal Orb)
      if (
        minValue != null &&
        itemInfo?.rarity === 'Unique' &&
        matchedRange &&
        matched.value != null &&
        matched.value >= matchedRange.min &&
        minValue < matchedRange.min
      ) {
        minValue = matchedRange.min
      }
      const maxValue = isBeneficialNegative && matched.value != null ? matched.value : null

      // Skip for cluster jewels -- their mods grant passives, not item stats
      // Skip "X per Y" mods -- they're conditional and shouldn't inflate pseudo totals
      const isPerMod = /\bper\b/i.test(cleaned)
      const isCluster = itemInfo ? isClusterJewel(itemInfo) : false
      const pseudoList = isCluster || isPerMod ? undefined : PSEUDO_CONTRIBUTIONS[matched.statId]
      // A pseudo normally disables its source row (total-life/total-res replace it).
      // keepSourceRow contributions (PoE2 "Damage as Extra" summaries) are additive,
      // so they must NOT suppress the underlying mod row.
      const suppressesSourceRow = pseudoList != null && pseudoList.some((c) => !c.keepSourceRow)
      if (pseudoList && matched.value != null) {
        accumulatePseudo(pseudoAccumulator, pseudoList, matched.value, isWeapon)
      }

      // Hybrid companion detection: if this mod shares an advanced mod block with a
      // "Socketed Gems are Supported by" line but ISN'T the socketed gem line itself,
      // it's the less important hybrid bonus and should be off by default
      let isHybridCompanion = false
      if (advancedMods && !/^Socketed Gems are Supported by/i.test(cleaned)) {
        const parentMod = advancedMods.find(
          (am) =>
            am.type !== 'implicit' &&
            am.lines.some((l) => /Socketed Gems are Supported by/i.test(l)) &&
            am.lines.some((l) => {
              const s = l
                .replace(/(-?\d+(?:\.\d+)?)\(-?\d+(?:\.\d+)?--?\d+(?:\.\d+)?\)/g, '$1')
                .replace(/([a-zA-Z]\w*)\s*\([^)]*\)/g, '$1')
                .replace(/\s*[—–-]+\s*Unscalable Value$/i, '')
                .trim()
              return s === cleaned
            }),
        )
        if (parentMod) isHybridCompanion = true
      }

      // Remap stat ID prefix based on mod source (fractured/crafted). Deferred
      // until after the pseudo accumulation above so PSEUDO_CONTRIBUTIONS (keyed
      // by explicit.* IDs) still hits for fractured/crafted mods -- they
      // otherwise contribute to total ele res / total life same as a regular roll.
      if (isFractured && matched.statId.startsWith('explicit.')) {
        matched.statId = `fractured.${matched.statId.split('.').slice(1).join('.')}`
      } else if (craftedForTrade && matched.statId.startsWith('explicit.')) {
        matched.statId = `crafted.${matched.statId.split('.').slice(1).join('.')}`
      }

      const tierLadder = attachTierLadder({
        baseType: itemInfo?.baseType,
        ranges: advModRanges,
        value: matched.value,
        tier: matchedTier,
        aggregated: matched.aggregated ?? false,
        rarity: itemInfo?.rarity,
        name: advModName,
      })
      out.push({
        id: matched.statId,
        text: isFractured ? `${cleaned} (Fractured)` : cleaned,
        value: matched.value,
        min: minValue,
        max: maxValue,
        enabled:
          isFractured ||
          isFoulborn ||
          (!lowPriority &&
            !craftedForTrade &&
            !suppressesSourceRow &&
            !isHybridCompanion &&
            !(hasDefenses && isDefenseMod(cleaned)) &&
            !useLocal &&
            !(itemInfo?.itemClass === 'Maps')),
        type: isFractured ? 'fractured' : isCrafted ? 'crafted' : 'explicit',
        option: matched.option,
        aggregated: matched.aggregated,
        foulborn: isFoulborn || undefined,
        perfectRoll: perfectRoll || undefined,
        modTier: matchedTier,
        modRange: matchedRange,
        tierLadder,
        tierQualityMult: advModMult,
      })
      // For fractured mods, also add the unfractured (explicit) version, disabled by default
      if (isFractured) {
        const explicitId = `explicit.${matched.statId.split('.').slice(1).join('.')}`
        out.push({
          id: explicitId,
          text: cleaned,
          value: matched.value,
          min: minValue,
          max: null,
          enabled: false,
          type: 'explicit',
          aggregated: matched.aggregated,
          modTier: matchedTier,
          modRange: matchedRange,
          tierLadder,
          tierQualityMult: advModMult,
        })
      }
    }
  }

  return mergeDuplicateStats(dropFragmentDuplicates(out), pct)
}
