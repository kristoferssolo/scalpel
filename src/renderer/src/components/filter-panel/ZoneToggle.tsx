import type { Zone } from '../../shared/useCurrentZone'

interface ZoneToggleProps {
  currentZone: Zone | null
  enabled: boolean
  onChange: (next: boolean) => void
  /** Compact mode renders just "Zone ##" instead of "Use Current Zone (lvl ##)". */
  compact?: boolean
}

/** Pill that lets the user opt in to overriding the displayed item's
 *  areaLevel with the live zone level from Client.txt. Renders null when
 *  the player isn't in a real drop zone, so the call site doesn't need
 *  to wrap in a conditional. */
export function ZoneToggle({ currentZone, enabled, onChange, compact = false }: ZoneToggleProps): JSX.Element | null {
  if (!currentZone) return null
  const label = compact ? `Zone ${currentZone.areaLevel}` : `Use Current Zone (lvl ${currentZone.areaLevel})`
  return (
    <label
      className="flex items-center gap-1.5 text-[11px] text-text-dim cursor-pointer select-none whitespace-nowrap"
      title={`Override item area level with the current zone (${currentZone.areaCode}, level ${currentZone.areaLevel})`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent w-3 h-3"
      />
      {label}
    </label>
  )
}
