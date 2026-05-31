import { useState } from 'react'
import type { AppSettings, HideableTabKey } from '../../../../shared/types'
import { ScrubInput } from '../regex-tool/ScrubInput'
import { SettingToggleBox } from './SettingToggleBox'
import { ThemeSettings } from './ThemeSettings'
import { Setting, CloseSmall, Buy, Filter } from '@icon-park/react'
import { getGameFeatures } from '../../../../shared/game-features'
import { DIV_CARD_ICON_URL, IP } from '../../shared/constants'
import dustIconAsset from '../../assets/currency/thaumaturgic-dust.png'
import poereIcon from '../../assets/other/poere-logo.svg'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateMany: (patch: Partial<AppSettings>) => void
}

const SCALE_PRESETS = [0.75, 1, 1.25, 1.5, 2] as const

const TAB_BUTTON_BASE = 'w-[30px] h-[30px] flex items-center justify-center'
// Three button states for the Show/Hide Tabs preview, communicated by fill color.
// Active = accent gold (matches the active state in the actual TitleBar buttons).
// Hidden = muted red. Ineligible = neutral grey for Settings/Close.
const TAB_FILL_ON = 'var(--accent)'
const TAB_FILL_OFF = 'rgba(239,83,80,0.85)'
const TAB_FILL_FIXED = 'rgba(255,255,255,0.12)'

export function ViewTab({ settings, update, updateMany }: Props): JSX.Element {
  const [startupMainPanelMode] = useState(settings.mainPanelMode)
  // Custom scale mode is auto-enabled when the saved scale isn't one of the presets,
  // and toggled by the Custom/preset buttons otherwise.
  const [customScale, setCustomScale] = useState<boolean>(
    !(SCALE_PRESETS as readonly number[]).includes(settings.overlayScale),
  )

  // Show/Hide Tabs registry. Order matches the title bar (left-to-right). Features-gated
  // tabs only render if the current PoE version supports them, mirroring TitleBar
  // behavior -- if dust explorer isn't available for this game, there's nothing to toggle.
  const features = getGameFeatures(settings.poeVersion)
  const hidden = new Set<HideableTabKey>(settings.hiddenTabs ?? [])
  const toggleHidden = (key: HideableTabKey): void => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update('hiddenTabs', [...next])
  }

  const TOGGLEABLE: Array<{ key: HideableTabKey; icon: React.ReactNode; title: string; show: boolean }> = [
    { key: 'item', icon: <Filter size={16} {...IP} />, title: 'Filter Editor', show: true },
    { key: 'pricecheck', icon: <Buy size={16} {...IP} />, title: 'Price Checker', show: true },
    {
      key: 'dust',
      icon: <img src={dustIconAsset} alt="" className="w-[18px] h-[18px] object-contain" />,
      title: 'Dust Explorer',
      show: features.dustExplorer,
    },
    {
      key: 'divcards',
      icon: <img src={DIV_CARD_ICON_URL} alt="" className="w-[18px] h-[18px] object-contain" />,
      title: 'Div Card Explorer',
      show: features.divCards,
    },
    {
      key: 'regex',
      icon: <img src={poereIcon} alt="" className="w-[18px] h-[18px] object-contain" />,
      title: 'Regex Tool',
      show: features.regexTool,
    },
  ]

  // Settings and Close get a grey border in the preview row -- they exist in the title
  // bar but the user can't hide them.
  const FIXED_PREVIEW: Array<{ icon: React.ReactNode; title: string }> = [
    { icon: <Setting size={16} {...IP} />, title: 'Settings (always visible)' },
    { icon: <CloseSmall size={16} {...IP} />, title: 'Close (always visible)' },
  ]

  return (
    <>
      <div className="settings-section-title mt-3">Customize View</div>

      <section>
        <label>Main panel mode</label>
        <div className="flex gap-1.5 mt-[6px]">
          {(
            [
              ['overlay', 'Overlay'],
              ['standalone', 'Standalone window'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => update('mainPanelMode', value)}
              className={`text-[11px] px-3 py-1.5 ${
                settings.mainPanelMode === value ? 'bg-accent text-bg-solid' : 'text-text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {settings.mainPanelMode !== startupMainPanelMode && (
          <div className="mt-2 text-[11px] text-text-dim">Restart Scalpel to apply this mode.</div>
        )}
      </section>

      <section>
        <label>Show/Hide Tabs</label>
        <div className="flex gap-1.5 mt-[6px] items-center">
          {TOGGLEABLE.filter((t) => t.show).map((t) => {
            const isHidden = hidden.has(t.key)
            // poere logo is a fixed-color SVG, so we darken it via a brightness filter
            // when the button is in the gold "on" state -- mirrors TitleBar.tsx behavior
            // for the regex tab so the logo stays legible against the gold background.
            const darkenPoere = t.key === 'regex' && !isHidden
            return (
              <button
                key={t.key}
                onClick={() => toggleHidden(t.key)}
                title={t.title}
                className={TAB_BUTTON_BASE}
                style={{
                  background: isHidden ? TAB_FILL_OFF : TAB_FILL_ON,
                  // Dark glyph on the gold "on" fill (matches active TitleBar look),
                  // white on the red "off" fill so the icon stays legible.
                  color: isHidden ? '#fff' : '#171821',
                  border: 'none',
                }}
              >
                <span style={darkenPoere ? { filter: 'brightness(0.1)', display: 'flex' } : undefined}>{t.icon}</span>
              </button>
            )
          })}
          {FIXED_PREVIEW.map((b) => (
            <button
              key={b.title}
              disabled
              title={b.title}
              className={`${TAB_BUTTON_BASE} cursor-default`}
              style={{
                background: TAB_FILL_FIXED,
                color: 'var(--text-dim)',
                border: 'none',
              }}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </section>

      {/* Overlay scale */}
      <section>
        <label>Overlay scale</label>
        <div className="flex items-center gap-1.5 mt-[6px]">
          {SCALE_PRESETS.map((scale) => (
            <button
              key={scale}
              onClick={() => {
                setCustomScale(false)
                update('overlayScale', scale)
              }}
              className={`text-[11px] px-3 py-1.5 ${
                !customScale && settings.overlayScale === scale ? 'bg-accent text-bg-solid' : 'text-text-dim'
              }`}
            >
              {Math.round(scale * 100)}%
            </button>
          ))}
          <button
            onClick={() => setCustomScale(true)}
            className={`text-[11px] px-3 py-1.5 ${customScale ? 'bg-accent text-bg-solid' : 'text-text-dim'}`}
          >
            Custom
          </button>
          {customScale && (
            <ScrubInput
              value={Math.round(settings.overlayScale * 100)}
              onChange={(v) => {
                if (v != null) update('overlayScale', v / 100)
              }}
              min={50}
              max={300}
              step={5}
              suffix="%"
            />
          )}
        </div>
      </section>

      {/* Open side (mount side at scan time; doesn't affect dragging) */}
      <section>
        <label>Open Scalpel on:</label>
        <div className="flex gap-1.5 mt-[6px]">
          {(
            [
              ['both', 'Both sides'],
              ['right', 'Only right'],
              ['left', 'Only left'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => update('openSide', value)}
              className={`text-[11px] px-3 py-1.5 ${
                (settings.openSide ?? 'both') === value ? 'bg-accent text-bg-solid' : 'text-text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Close on click outside */}
      <SettingToggleBox
        label="Close overlay when clicking outside"
        checked={settings.closeOnClickOutside}
        onChange={(val) => update('closeOnClickOutside', val)}
      />
      <SettingToggleBox
        label="Show currency names instead of icons (accessibility)"
        checked={settings.currencyLabelsAsText}
        onChange={(val) => update('currencyLabelsAsText', val)}
      />
      <ThemeSettings settings={settings} update={update} updateMany={updateMany} />
    </>
  )
}
