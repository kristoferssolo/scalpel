import { useState } from 'react'
import type { AppSettings, PoeItem } from '../../../shared/types'
import { GeneralTab, MacrosTab, FilterTab, PriceCheckTab, FaqTab } from './settings'
import { HistoryPanel } from './HistoryPanel'
import { ErrorBanner } from './ErrorBanner'
import { findHotkeyCollision, type HotkeySlot } from './settings/hotkey-collisions'

interface Props {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  mode: 'overlay' | 'app'
  onDone?: () => void
  onOnlineFilterUpdated?: (name: string) => void
  onOnlineImport?: (name: string) => void
  onShowOnboarding?: () => void
  /** Item currently loaded in the overlay, used to preserve context when undoing/restoring */
  currentItem?: PoeItem
  /** Optional callback to show a short error banner at the top of the overlay */
  onError?: (message: string) => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  mode,
  onDone: _onDone,
  onOnlineFilterUpdated,
  onOnlineImport,
  onShowOnboarding,
  currentItem,
  onError,
}: Props): JSX.Element {
  const [tab, setTab] = useState<'general' | 'macros' | 'filter' | 'pricecheck' | 'history' | 'faq'>('general')
  const [localError, setLocalError] = useState<string | null>(null)

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    window.api.setSetting(key, value)
    onSettingsChange({ ...settings, [key]: value })
  }

  const showError = (msg: string): void => {
    if (onError) {
      onError(msg)
    } else {
      setLocalError(msg)
      setTimeout(() => setLocalError(null), 3000)
    }
  }

  /** Check if a hotkey collides with another slot; if so, show the banner and return false. */
  const tryHotkey = (hotkey: string, slot: HotkeySlot): boolean => {
    const collisionLabel = findHotkeyCollision(settings, hotkey, slot)
    if (collisionLabel) {
      showError(`Hotkey already in use for ${collisionLabel}`)
      return false
    }
    return true
  }

  const isOverlay = mode === 'overlay'

  return (
    <div className={`flex flex-col ${isOverlay ? 'gap-5 bg-bg-card rounded p-4 pb-5' : 'gap-6 pb-[18px]'} relative`}>
      {/* Local error banner (only shown when no onError handler lifts it out) */}
      {!onError && <ErrorBanner message={localError} />}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <h2
            className="section-title"
            style={!isOverlay ? { color: 'var(--accent)', fontSize: 16, fontWeight: 700 } : undefined}
          >
            Settings
          </h2>
          <span className="text-[9px] text-accent opacity-60">Beta {__APP_VERSION__}</span>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {(['general', 'macros', 'filter', 'pricecheck', 'history', 'faq'] as const).map((t) => {
            const label =
              t === 'general'
                ? 'General'
                : t === 'macros'
                  ? 'Macros'
                  : t === 'filter'
                    ? 'Filter'
                    : t === 'pricecheck'
                      ? 'Trade'
                      : t === 'history'
                        ? 'History'
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
      {tab === 'macros' && <MacrosTab settings={settings} update={update} tryHotkey={tryHotkey} />}
      {tab === 'filter' && (
        <FilterTab
          settings={settings}
          update={update}
          isOverlay={isOverlay}
          onOnlineFilterUpdated={onOnlineFilterUpdated}
          onOnlineImport={onOnlineImport}
          onSettingsChange={onSettingsChange}
          tryHotkey={tryHotkey}
        />
      )}
      {tab === 'pricecheck' && <PriceCheckTab settings={settings} update={update} tryHotkey={tryHotkey} />}
      {tab === 'history' && <HistoryPanel item={currentItem} onDone={() => setTab('general')} />}
      {tab === 'faq' && <FaqTab />}
    </div>
  )
}
