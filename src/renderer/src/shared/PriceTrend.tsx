import { TrendingUp, TrendingDown, Minus } from '@icon-park/react'
import { getTrendDirection, TREND_DOWN_COLOR, TREND_UP_COLOR } from './price-trend'

interface Props {
  graph?: (number | null)[]
}

/** Renders a 12px directional arrow for the given price trend graph.
 *  Renders nothing when graph is absent. */
export function PriceTrend({ graph }: Props): JSX.Element | null {
  if (!graph) return null
  const direction = getTrendDirection(graph)

  if (direction === 'up') {
    return <TrendingUp size={12} fill={TREND_UP_COLOR} data-testid="trend-up" />
  }
  if (direction === 'down') {
    return <TrendingDown size={12} fill={TREND_DOWN_COLOR} data-testid="trend-down" />
  }
  return <Minus size={12} className="text-text-dim" data-testid="trend-flat" />
}
