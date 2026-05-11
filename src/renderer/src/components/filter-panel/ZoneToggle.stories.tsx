import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ZoneToggle } from './ZoneToggle'

const meta: Meta<typeof ZoneToggle> = {
  component: ZoneToggle,
  title: 'FilterPanel/ZoneToggle',
}
export default meta

type Story = StoryObj<typeof ZoneToggle>

function Wrapped(props: { initial: boolean; compact?: boolean; zone: { areaLevel: number; areaCode: string } | null }) {
  const [enabled, setEnabled] = useState(props.initial)
  return <ZoneToggle currentZone={props.zone} enabled={enabled} onChange={setEnabled} compact={props.compact} />
}

export const Off: Story = {
  render: () => <Wrapped initial={false} zone={{ areaLevel: 68, areaCode: 'MapWorldsAtoll' }} />,
}
export const On: Story = {
  render: () => <Wrapped initial={true} zone={{ areaLevel: 68, areaCode: 'MapWorldsAtoll' }} />,
}
export const Compact: Story = {
  render: () => <Wrapped initial={true} compact zone={{ areaLevel: 68, areaCode: 'MapWorldsAtoll' }} />,
}
export const InTownHidden: Story = {
  render: () => <Wrapped initial={true} zone={null} />,
}
