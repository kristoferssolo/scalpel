import type { AppSettings } from '../../../../shared/types'
import { Toggle } from '../Toggle'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

export function GeneralTab({ settings, update }: Props): JSX.Element {
  return (
    <>
      {/* League */}
      <section>
        <label>League</label>
        <div className="setting-box mt-[6px] relative">
          <span className="value">{settings.league}</span>
          <button
            className="primary"
            onClick={() => {
              const sel = document.getElementById('league-select-unified') as HTMLSelectElement | null
              sel?.showPicker?.()
              sel?.focus()
            }}
          >
            Change
          </button>
          <select
            id="league-select-unified"
            value={settings.league}
            onChange={(e) => update('league', e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            {['Mirage', 'Hardcore Mirage', 'Standard', 'Hardcore'].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* PoE version switcher in case we can't automate */}
      {import.meta.env.DEV && (
        <section>
          <label>Game version: Debug</label>
          <p className="text-[10px] text-text-dim mt-0.5 mb-1.5">Restart required after changing</p>
          <div className="flex gap-1.5">
            {([1, 2] as const).map((v) => (
              <button
                key={v}
                onClick={() => update('poeVersion', v)}
                className={`text-[11px] px-3 py-1.5 ${
                  settings.poeVersion === v ? 'bg-accent text-bg-solid' : 'text-text-dim'
                }`}
              >
                Path of Exile{v === 2 ? ' 2' : ''}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Overlay scale */}
      <section>
        <label>Overlay scale</label>
        <div className="flex gap-1.5 mt-[6px]">
          {[0.75, 1, 1.25, 1.5, 2].map((scale) => (
            <button
              key={scale}
              onClick={() => update('overlayScale', scale)}
              className={`text-[11px] px-3 py-1.5 ${
                settings.overlayScale === scale ? 'bg-accent text-bg-solid' : 'text-text-dim'
              }`}
            >
              {Math.round(scale * 100)}%
            </button>
          ))}
        </div>
      </section>

      {/* Close on click outside */}
      <section>
        <div
          onClick={() => update('closeOnClickOutside', !settings.closeOnClickOutside)}
          className="flex items-center gap-[10px] cursor-pointer select-none"
        >
          <Toggle checked={settings.closeOnClickOutside} onChange={(val) => update('closeOnClickOutside', val)} />
          <span className="text-xs text-text">Close overlay when clicking outside</span>
        </div>
      </section>
    </>
  )
}
