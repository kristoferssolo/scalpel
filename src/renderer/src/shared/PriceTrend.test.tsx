// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PriceTrend } from './PriceTrend'

describe('PriceTrend', () => {
  it('renders the up icon when the last graph entry exceeds the threshold', () => {
    const { getByTestId } = render(<PriceTrend graph={[0, 0, 0, 0, 0, 0, 20]} />)
    expect(getByTestId('trend-up')).toBeDefined()
  })

  it('renders the down icon when the last graph entry is below the negative threshold', () => {
    const { getByTestId } = render(<PriceTrend graph={[0, 0, 0, 0, 0, 0, -20]} />)
    expect(getByTestId('trend-down')).toBeDefined()
  })

  it('renders the flat icon when the last entry is within the threshold band', () => {
    const { getByTestId } = render(<PriceTrend graph={[0, 0, 0, 0, 0, 0, 5]} />)
    expect(getByTestId('trend-flat')).toBeDefined()
  })

  it('renders nothing when graph is undefined', () => {
    const { container } = render(<PriceTrend graph={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when graph is absent', () => {
    const { container } = render(<PriceTrend />)
    expect(container.firstChild).toBeNull()
  })
})
