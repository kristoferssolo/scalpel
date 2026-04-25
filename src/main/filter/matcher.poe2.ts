import type { ConditionResult, FilterCondition, PoeItem } from '../../shared/types'
import { compareNum } from './matcher'

/**
 * Evaluate a single filter condition that only exists in PoE2 filters. Called
 * from the main matcher's default branch so any condition it doesn't natively
 * handle gets a second chance here before falling back to 'unknown'. Returning
 * 'unknown' for a truly unfamiliar name keeps the existing "unknowns don't
 * poison matches" behavior intact.
 *
 * PoE1-only conditions live inline in matcher.ts; mixing them across files
 * would be cross-talk we explicitly want to avoid. Anything PoE2-exclusive
 * belongs in this file.
 *
 * Conditions that the clipboard parser doesn't yet populate (IsVaalUnique,
 * HasVaalUniqueMod, TwiceCorrupted, UnidentifiedItemTier) deliberately fall
 * through to 'unknown' rather than hardcoding 'false' -- a hardcoded false
 * makes "X False" rules silently match every item, which is worse than
 * reporting the result as undetermined. Re-enable each case once the parser
 * surfaces the underlying field.
 */
export function evaluatePoe2Condition(cond: FilterCondition, item: PoeItem): ConditionResult {
  const { type, operator, values } = cond

  switch (type) {
    case 'UnidentifiedItemTier':
      if (item.unidentifiedItemTier == null) return 'unknown'
      return compareNum(item.unidentifiedItemTier, operator, parseInt(values[0])) ? 'pass' : 'fail'

    default:
      return 'unknown'
  }
}
