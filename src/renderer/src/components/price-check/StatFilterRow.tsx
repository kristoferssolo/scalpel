import { Star } from '@icon-park/react'
import { ScrubInput } from '../regex-tool/ScrubInput'
import { getModColor, MOD_BOLD_TYPES } from './constants'
import type { StatFilter } from './types'

export function StatFilterRow({
  f,
  i,
  rowIdx,
  toggleFilter,
  updateFilterMin,
  updateFilterMax,
}: {
  f: StatFilter
  i: number
  rowIdx: number
  toggleFilter: (i: number) => void
  updateFilterMin: (i: number, val: string) => void
  updateFilterMax: (i: number, val: string) => void
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-2 px-3 py-[2px] text-xs"
      style={{
        opacity: f.enabled ? 1 : 0.4,
        background: rowIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
          toggleFilter(i)
        }}
        className="w-4 h-4 shrink-0 rounded-[3px] cursor-pointer flex items-center justify-center transition-[background] duration-100"
        style={{
          background: f.enabled ? 'var(--accent)' : 'rgba(255,255,255,0.14)',
        }}
      >
        {f.enabled && <span className="text-[11px] text-[#171821] font-bold leading-none">&#10003;</span>}
      </div>
      <span
        onClick={() => toggleFilter(i)}
        className="flex-1 text-[11px] cursor-pointer select-none flex items-center gap-1"
        style={{
          color: getModColor(f.type, f.foulborn),
          fontWeight: MOD_BOLD_TYPES.has(f.type) ? 600 : 400,
        }}
      >
        {f.type === 'temple-key' && <Star size={12} theme="filled" fill="#ffd700" />}
        {f.text}
      </span>
      <ScrubInput
        value={f.min}
        placeholder="min"
        min={-99999}
        onChange={(val) => updateFilterMin(i, val == null ? '' : String(val))}
      />
      <ScrubInput
        value={f.max}
        placeholder="max"
        min={-99999}
        onChange={(val) => updateFilterMax(i, val == null ? '' : String(val))}
      />
    </div>
  )
}
