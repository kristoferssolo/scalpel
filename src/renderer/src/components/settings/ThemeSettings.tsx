import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../../shared/types'
import type { ThemePalette } from '../../../../shared/theme/palette'
import { PRESETS } from '../../../../shared/theme/presets'
import { resolveActivePalette } from '../../../../shared/theme/active'
import { applyPalette } from '../../shared/apply-theme'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

// Order = how the swatches and color inputs are listed in the editor.
const FIELDS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'bgSolid', label: 'Background' },
  { key: 'bgCard', label: 'Card' },
  { key: 'accent', label: 'Accent' },
  { key: 'match', label: 'Match' },
  { key: 'secondaryMatch', label: 'Secondary match' },
  { key: 'text', label: 'Text' },
  { key: 'textDim', label: 'Dim text' },
  { key: 'border', label: 'Border' },
  { key: 'danger', label: 'Danger' },
  { key: 'warn', label: 'Warning' },
  { key: 'dangerBg', label: 'Danger background' },
  { key: 'hideColor', label: 'Filter: Hide' },
  { key: 'showColor', label: 'Filter: Show' },
  { key: 'minimalColor', label: 'Filter: Minimal' },
]

export function ThemeSettings({ settings, update }: Props): JSX.Element {
  // Working palette is local; live-applied to THIS window only until saved.
  const [working, setWorking] = useState<ThemePalette>(() =>
    resolveActivePalette(settings.themeId, settings.customThemePalette ?? null),
  )
  const [dirty, setDirty] = useState(false)

  // Keep working in sync when settings change from elsewhere and we have no
  // unsaved edits (e.g. a preset broadcast from another window).
  useEffect(() => {
    if (!dirty) setWorking(resolveActivePalette(settings.themeId, settings.customThemePalette ?? null))
  }, [settings.themeId, settings.customThemePalette, dirty])

  const selectPreset = (id: string): void => {
    const palette = resolveActivePalette(id, settings.customThemePalette ?? null)
    setWorking(palette)
    setDirty(false)
    applyPalette(palette)
    update('themeId', id)
  }

  const editColor = (key: keyof ThemePalette, value: string): void => {
    const next = { ...working, [key]: value }
    setWorking(next)
    setDirty(true)
    applyPalette(next) // live preview, this window only; not persisted until Save (reconciled by save/reset/reload)
  }

  const saveCustom = (): void => {
    // Persist palette before id so a 'custom' themeId never points at a stale custom palette.
    update('customThemePalette', working)
    update('themeId', 'custom')
    setDirty(false)
  }

  const reset = (): void => {
    const base = resolveActivePalette(settings.themeId, settings.customThemePalette ?? null)
    setWorking(base)
    setDirty(false)
    applyPalette(base)
  }

  return (
    <>
      <div className="settings-section-title mt-3">Theme</div>

      <section>
        <label>Presets</label>
        <div className="flex flex-wrap gap-1.5 mt-[6px]">
          {PRESETS.map((p) => {
            const selected = !dirty && settings.themeId === p.id
            return (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                title={p.name}
                className={`text-[11px] px-3 py-1.5 flex items-center gap-2 ${
                  selected ? 'bg-accent text-bg-solid' : 'text-text-dim'
                }`}
              >
                <span className="flex">
                  {[p.palette.bgCard, p.palette.accent, p.palette.match, p.palette.text].map((c, i) => (
                    <span
                      key={i}
                      className="w-3 h-3 inline-block"
                      style={{ background: c, border: '1px solid rgba(0,0,0,0.4)' }}
                    />
                  ))}
                </span>
                {p.name}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <label>Customize</label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-[6px]">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-2 text-[11px] text-text-dim">
              <span>{f.label}</span>
              <input
                type="color"
                value={working[f.key]}
                onChange={(e) => editColor(f.key, e.target.value)}
                className="w-8 h-6 bg-transparent cursor-pointer"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={saveCustom}
            disabled={!dirty}
            className={`text-[11px] px-3 py-1.5 ${dirty ? 'bg-accent text-bg-solid' : 'text-text-dim opacity-50'}`}
          >
            Save custom theme
          </button>
          <button
            onClick={reset}
            disabled={!dirty}
            className={`text-[11px] px-3 py-1.5 text-text-dim ${dirty ? '' : 'opacity-50'}`}
          >
            Reset
          </button>
        </div>
      </section>
    </>
  )
}
