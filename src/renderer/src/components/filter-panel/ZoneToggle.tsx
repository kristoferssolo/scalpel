import type { Zone } from '../../../../shared/types'
import { Toggle } from '../Toggle'

interface ZoneToggleProps {
  currentZone: Zone | null
  enabled: boolean
  onChange: (next: boolean) => void
}

/** AreaLevel cutoff above which the toggle hides itself. Picked to match
 *  the Neversink convention of treating `AreaLevel >= 75` as the
 *  high-tier-map threshold: above this, the synthetic default
 *  (83/80) is already close enough that the override has no useful
 *  effect. Below it (campaign + low maps) is where filter behavior
 *  meaningfully diverges from the default. */
const ZONE_TOGGLE_LEVEL_CAP = 75

/** Row that lets the user opt in to overriding the displayed item's
 *  areaLevel with the live zone level from Client.txt. Designed to be
 *  rendered inside ItemSummary's `extraRow` slot. Returns null when the
 *  player isn't in a real drop zone (town, hideout, or no zone seen
 *  yet) or is already in a high-tier map, so the call site doesn't
 *  need to guard. */
export function ZoneToggle({ currentZone, enabled, onChange }: ZoneToggleProps): JSX.Element | null {
  if (!currentZone) return null
  if (currentZone.areaLevel > ZONE_TOGGLE_LEVEL_CAP) return null
  return (
    <div className="flex mt-0.5">
      <div
        onClick={() => onChange(!enabled)}
        className="inline-flex items-center gap-[6px] bg-black/30 rounded-full px-2 py-[3px] text-[11px] cursor-pointer select-none"
        title={`Override item area level with the current zone (${currentZone.areaCode})`}
      >
        <Toggle checked={enabled} onChange={() => {}} />
        <span className="text-text-dim">Use Zone Level</span>
        <span className="text-text font-semibold">{currentZone.areaLevel}</span>
      </div>
    </div>
  )
}
