import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { GeneralTab, MacrosTab, FilterTab, PriceCheckTab, FaqTab } from './settings'

interface Props {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  mode: 'overlay' | 'app'
  onDone?: () => void
  onOnlineFilterUpdated?: (name: string) => void
  onOnlineImport?: (name: string) => void
  onShowOnboarding?: () => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  mode,
  onDone: _onDone,
  onOnlineFilterUpdated,
  onOnlineImport,
  onShowOnboarding,
}: Props): JSX.Element {
  const [tab, setTab] = useState<'general' | 'macros' | 'filter' | 'pricecheck' | 'faq'>('general')

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    window.api.setSetting(key, value)
    onSettingsChange({ ...settings, [key]: value })
  }

  const isOverlay = mode === 'overlay'

  return (
    <div className={`flex flex-col ${isOverlay ? 'gap-5 bg-bg-card rounded p-4 pb-5' : 'gap-6 pb-[18px]'}`}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2
            className="section-title"
            style={!isOverlay ? { color: 'var(--accent)', fontSize: 16, fontWeight: 700 } : undefined}
          >
            Settings
          </h2>
          <span className="text-[9px] text-accent opacity-60">Beta {__APP_VERSION__}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-[6px]">
          {(['general', 'macros', 'filter', 'pricecheck', 'faq'] as const).map((t) => {
            const label =
              t === 'general'
                ? 'General'
                : t === 'macros'
                  ? 'Macros'
                  : t === 'filter'
                    ? 'Filter'
                    : t === 'pricecheck'
                      ? 'Trade'
                      : 'FAQ'
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[11px] px-3 py-1.5 ${tab === t ? 'bg-accent text-bg-solid' : 'text-text-dim'}`}
              >
                {label}
              </button>
            )
          })}
          {!isOverlay && onShowOnboarding && (
            <button onClick={onShowOnboarding} className="text-[11px] text-text-dim px-3 py-1.5">
              Setup Wizard
            </button>
          )}
          {import.meta.env.DEV && (
            <button onClick={() => window.api.openDevTools()} className="text-[11px] text-text-dim px-3 py-1.5">
              DevTools
            </button>
          )}
        </div>
      </div>

      {tab === 'general' && <GeneralTab settings={settings} update={update} />}
      {tab === 'macros' && <MacrosTab settings={settings} update={update} />}
      {tab === 'filter' && (
        <FilterTab
          settings={settings}
          update={update}
          isOverlay={isOverlay}
          onOnlineFilterUpdated={onOnlineFilterUpdated}
          onOnlineImport={onOnlineImport}
          onSettingsChange={onSettingsChange}
        />
      )}
      {tab === 'pricecheck' && <PriceCheckTab settings={settings} update={update} />}
      {tab === 'faq' && <FaqTab />}
    </div>
  )
}
