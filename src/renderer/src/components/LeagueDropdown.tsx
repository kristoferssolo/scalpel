/** Native-select-backed league picker that renders like a `setting-box`.
 *  Used by both onboarding (PreferencesStep) and settings (GeneralTab) so
 *  the look + behavior stays in lockstep. */
export function LeagueDropdown({
  id,
  label,
  value,
  options,
  onChange,
}: {
  /** DOM id for the underlying <select>; must be unique per page so the
   *  Change button can target it via showPicker(). */
  id: string
  /** Optional caption rendered above the box. Omitted in single-league mode. */
  label?: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div>
      {label && <label className="block text-[11px] text-text-dim mb-1">{label}</label>}
      <div className="setting-box relative">
        <span className="value">{value}</span>
        <button
          className="primary"
          onClick={() => {
            const sel = document.getElementById(id) as HTMLSelectElement | null
            sel?.showPicker?.()
            sel?.focus()
          }}
        >
          Change
        </button>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        >
          {options.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
