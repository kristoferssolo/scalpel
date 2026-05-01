interface FilterChipProps {
  label: React.ReactNode
  /** Binary mode: chip is on/off. Required when `state` is not provided. */
  active?: boolean
  /** Ternary/minmax mode: 'yes' | 'no' | 'min' | 'max' | undefined (= any).
   *  When provided, the chip cycles through states on click and renders a badge. */
  state?: 'yes' | 'no' | 'min' | 'max' | undefined
  onClick?: () => void
  onChange?: (next: 'yes' | 'no' | 'min' | 'max' | undefined) => void
  color?: string
  icon?: string
  /** Controls cycle behavior and badge labels. Defaults to 'yesno'. */
  mode?: 'yesno' | 'minmax'
}

const TERNARY_GREEN = '#5ba85b'
const TERNARY_RED = '#c95a4f'

function nextTernary(
  current: 'yes' | 'no' | 'min' | 'max' | undefined,
  mode: 'yesno' | 'minmax',
): 'yes' | 'no' | 'min' | 'max' | undefined {
  if (mode === 'minmax') {
    if (current === undefined) return 'min'
    if (current === 'min') return 'max'
    return undefined
  }
  // yesno cycle
  if (current === undefined) return 'yes'
  if (current === 'yes') return 'no'
  return undefined
}

function badgeLabel(state: 'yes' | 'no' | 'min' | 'max', mode: 'yesno' | 'minmax'): string {
  if (mode === 'minmax') return state === 'min' ? 'Min' : 'Max'
  return state === 'yes' ? 'Yes' : 'No'
}

export function FilterChip({
  label,
  active,
  state,
  onClick,
  onChange,
  color = 'var(--accent)',
  icon,
  mode = 'yesno',
}: FilterChipProps): JSX.Element {
  // Ternary/minmax mode is enabled when an `onChange` handler is provided -- this lets
  // us distinguish "ternary chip with current state = any" from "binary chip"
  // even though both can have undefined visual state.
  const ternary = onChange != null

  // For yesno mode: green for yes, red for no. For minmax mode: accent color
  // for both min and max (the badge label is the discriminator).
  const ternaryColor =
    mode === 'minmax' ? color : state === 'yes' ? TERNARY_GREEN : state === 'no' ? TERNARY_RED : color
  const effectiveColor = ternary ? ternaryColor : color
  const effectiveActive = ternary ? state !== undefined : !!active
  const isAccent = effectiveColor === 'var(--accent)'

  const handleClick = (): void => {
    if (ternary) onChange?.(nextTernary(state, mode))
    else onClick?.()
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-1 px-[10px] py-1 rounded-full cursor-pointer text-[11px] font-semibold select-none relative overflow-visible"
      style={{
        background: effectiveActive
          ? isAccent
            ? 'rgba(200,169,110,0.13)'
            : `${effectiveColor}22`
          : 'rgba(0,0,0,0.25)',
        border: effectiveActive
          ? isAccent
            ? '2px solid rgba(200,169,110,0.4)'
            : `2px solid ${effectiveColor}66`
          : '2px solid var(--border)',
        opacity: effectiveActive ? 1 : 0.5,
        color: effectiveActive ? effectiveColor : 'var(--text-dim)',
      }}
    >
      {icon && effectiveActive && (
        <img
          src={icon}
          alt=""
          className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: 28, height: 28, objectFit: 'contain', filter: 'blur(6px) saturate(3)', opacity: 0.5 }}
        />
      )}
      {icon && <img src={icon} alt="" className="relative -ml-[3px]" style={{ width: 14, height: 14 }} />}
      <span className="relative flex items-center gap-1">{label}</span>
      {ternary && state && (
        <span
          className="absolute -top-1.5 -right-1.5 px-1 rounded-full text-[8px] font-bold leading-[10px] select-none"
          style={{
            background: ternaryColor,
            color: '#0a0a0a',
            border: '1px solid rgba(0,0,0,0.4)',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {badgeLabel(state, mode)}
        </span>
      )}
    </div>
  )
}
