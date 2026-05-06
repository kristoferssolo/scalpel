export type TrendDirection = 'up' | 'down' | 'flat'

/** Minimum percent change (on the last graph entry) to count as up or down. */
export const TREND_THRESHOLD_PCT = 15

/** Trend color tokens. Shared between the inline arrow (PriceTrend) and the
 *  hover overlay (SparklineOverlay) so the two render with the same hue. */
export const TREND_UP_COLOR = '#4a9eff'
export const TREND_DOWN_COLOR = '#ef5350'

/** Bucket a 7-day percent-change graph into a directional signal.
 *  Returns 'flat' for any missing, empty, or null-tailed graph. */
export function getTrendDirection(graph: (number | null)[] | undefined): TrendDirection {
  if (!graph || graph.length === 0) return 'flat'
  const latest = graph[graph.length - 1]
  if (latest == null) return 'flat'
  if (latest > TREND_THRESHOLD_PCT) return 'up'
  if (latest < -TREND_THRESHOLD_PCT) return 'down'
  return 'flat'
}
