import type { Meta, StoryObj } from '@storybook/react-vite'
import { SparklineOverlay } from './SparklineOverlay'

/** SparklineOverlay stories. The overlay portals to document.body and uses
 *  position:fixed at the cursor's viewport coords, so each story positions it
 *  at a known spot inside the Storybook canvas via the `cursor` arg. The line
 *  draws in left-to-right on mount; toggle `visible` in the controls panel to
 *  replay the animation.
 *
 *  Default `currentPrice` matches how PriceChip wires it in production - every
 *  real call passes the price so peak/valley render as translucent mini chips
 *  with the historical chaos value at that day. The `NoCurrentPrice` story
 *  exercises the dots-only fallback. */
const meta: Meta<typeof SparklineOverlay> = {
  title: 'Shared / SparklineOverlay',
  component: SparklineOverlay,
  args: {
    visible: true,
    cursor: { viewportX: 200, viewportY: 80, scale: 1 },
    currentPrice: { chaosValue: 100 },
  },
}
export default meta

type Story = StoryObj<typeof SparklineOverlay>

export const TrendUp: Story = {
  args: { graph: [3, 6, 9, 13, 16, 19, 22] },
  parameters: { docs: { description: { story: 'Steady climb. Peak chip at the rightmost point.' } } },
}

export const TrendDown: Story = {
  args: { graph: [-3, -6, -10, -14, -18, -22, -26] },
  parameters: { docs: { description: { story: 'Steady drop. Valley chip at the rightmost point.' } } },
}

export const TrendFlat: Story = {
  args: { graph: [1, -2, 3, -1, 5, 2, 4] },
  parameters: {
    docs: { description: { story: 'Last entry within the +/-15% threshold renders the muted flat color.' } },
  },
}

export const WithNullGaps: Story = {
  args: { graph: [10, null, 5, 8, null, 20, 15] },
  parameters: {
    docs: {
      description: { story: 'null entries split the line into separate segments. Each segment animates in parallel.' },
    },
  },
}

export const PeakAndValleyMidline: Story = {
  args: { graph: [5, 18, 25, -3, -12, 10, 7] },
  parameters: {
    docs: { description: { story: 'Peak and valley both inside the series so chips sit above and below the line.' } },
  },
}

export const ExtremeSpike: Story = {
  args: { graph: [2, 4, 6, 1500, 8, 5, 9] },
  parameters: {
    docs: {
      description: {
        story:
          'A single 1500% spike. The line clamps to +/-200% on the y-axis so the rest of the series stays readable; the peak chip still shows the (large) historical price.',
      },
    },
  },
}

export const FlatData: Story = {
  args: { graph: [4, 4, 4, 4, 4, 4, 4] },
  parameters: {
    docs: {
      description: { story: 'All same value. Only one marker (peak) renders to avoid double-marking the same spot.' },
    },
  },
}

export const AllNull: Story = {
  args: { graph: [null, null, null, null, null, null, null] },
  parameters: {
    docs: { description: { story: 'No data. Overlay renders the frame and headers but no line, dots, or chips.' } },
  },
}

export const AutoPromotedToDivine: Story = {
  args: {
    graph: [5, 18, 25, -3, -12, 10, 7],
    currentPrice: { chaosValue: 500, chaosPerDivine: 200 },
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the historical chaos value crosses the chaosPerDivine threshold, the mini chip auto-promotes to divine, mirroring PriceChip behavior.',
      },
    },
  },
}

export const NoCurrentPrice: Story = {
  args: {
    graph: [5, 18, 25, -3, -12, 10, 7],
    currentPrice: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Fallback for callers that do not pass a currentPrice: peak/valley dots still render but no chips or labels. Production callers (PriceChip) always pass a price so this path is rarely hit at runtime.',
      },
    },
  },
}
