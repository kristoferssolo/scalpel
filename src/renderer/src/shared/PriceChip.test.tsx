// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PoeVersionProvider } from './poe-version-context'

// PNG imports resolve to asset URLs in vite; in vitest they return the path string.
// Mock the icons module so PriceChip doesn't fail on unresolvable asset imports.
vi.mock('./icons', () => ({
  getCurrencyIcons: () => ({ baseline: 'chaos.png', divine: 'divine.png' }),
}))
vi.mock('../assets/other/poe-ninja.png', () => ({ default: 'ninja.png' }))

import { PriceChip } from './PriceChip'

function wrap(node: React.ReactNode): React.ReactElement {
  return <PoeVersionProvider version={1}>{node}</PoeVersionProvider>
}

describe('PriceChip', () => {
  it('renders price without trend when no graph is provided', () => {
    const { container, queryByTestId } = render(wrap(<PriceChip chaosValue={47} />))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('47')
    expect(queryByTestId('trend-up')).toBeNull()
    expect(queryByTestId('trend-down')).toBeNull()
    expect(queryByTestId('trend-flat')).toBeNull()
    expect(queryByTestId('sparkline-overlay')).toBeNull()
  })

  it('renders the trend arrow and sparkline overlay when graph is provided', () => {
    const graph = [0, 0, 0, 0, 0, 0, 20]
    const { getByTestId, queryByTestId } = render(wrap(<PriceChip chaosValue={100} graph={graph} />))
    expect(getByTestId('trend-up')).toBeDefined()
    expect(queryByTestId('sparkline-overlay')).toBeDefined()
  })

  it('suppresses trend when hideTrend is true even when graph is provided', () => {
    const graph = [0, 0, 0, 0, 0, 0, 20]
    const { queryByTestId } = render(wrap(<PriceChip chaosValue={100} graph={graph} hideTrend />))
    expect(queryByTestId('trend-up')).toBeNull()
    expect(queryByTestId('sparkline-overlay')).toBeNull()
  })

  it('renders a down-trend arrow for a negative graph', () => {
    const graph = [0, 0, 0, 0, 0, 0, -25]
    const { getByTestId } = render(wrap(<PriceChip chaosValue={50} graph={graph} />))
    expect(getByTestId('trend-down')).toBeDefined()
  })

  it('renders a flat-trend icon for a graph within the threshold', () => {
    const graph = [0, 0, 0, 0, 0, 0, 5]
    const { getByTestId } = render(wrap(<PriceChip chaosValue={50} graph={graph} />))
    expect(getByTestId('trend-flat')).toBeDefined()
  })
})
