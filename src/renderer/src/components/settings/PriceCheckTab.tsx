import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../../../shared/types'
import { PoeLoginButton } from './PoeLoginButton'
import { Toggle } from '../Toggle'
import { keyEventToAccelerator } from './utils'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  tryHotkey: (hotkey: string, slot: { kind: 'pricecheck' }) => boolean
}

export function PriceCheckTab({ settings, update, tryHotkey }: Props): JSX.Element {
  const [recording, setRecording] = useState(false)
  const recRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!recording) return
    window.api.suspendHotkeys()
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const acc = keyEventToAccelerator(e)
      if (!acc) return
      if (!tryHotkey(acc, { kind: 'pricecheck' })) {
        setRecording(false)
        return
      }
      update('priceCheckHotkey', acc)
      setRecording(false)
    }
    const onClick = (e: MouseEvent): void => {
      if (recRef.current && !recRef.current.contains(e.target as Node)) setRecording(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
      window.api.resumeHotkeys()
    }
  }, [recording, update, tryHotkey])

  return (
    <>
      {/* Price check hotkey */}
      <section>
        <label>Price check hotkey</label>
        <div ref={recRef} className="mt-[6px]">
          <div className="setting-box" onClick={() => setRecording(true)}>
            <span className={`value ${recording ? 'recording' : ''}`}>
              {recording ? 'Press your desired key combo...' : settings.priceCheckHotkey || '(none set)'}
            </span>
            {!recording && (
              <button
                className="primary"
                onClick={(e) => {
                  e.stopPropagation()
                  setRecording(true)
                }}
              >
                Change
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Trade listing type */}
      <section>
        <label>Trade listings</label>
        <div className="setting-box mt-[6px] relative">
          <span className="value">{settings.tradeStatus === 'securable' ? 'Instant buyout only' : 'All listings'}</span>
          <button
            className="primary"
            onClick={() => {
              const sel = document.getElementById('trade-status-select') as HTMLSelectElement | null
              sel?.showPicker?.()
              sel?.focus()
            }}
          >
            Change
          </button>
          <select
            id="trade-status-select"
            value={settings.tradeStatus}
            onChange={(e) => update('tradeStatus', e.target.value as 'available' | 'securable')}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            <option value="available">All listings</option>
            <option value="securable">Instant buyout only</option>
          </select>
        </div>
      </section>

      {/* Price display */}
      <section>
        <label>Buyout price currency</label>
        <div className="setting-box mt-[6px] relative">
          <span className="value">
            {(settings.tradePriceOption ?? 'chaos_divine') === 'chaos_divine'
              ? 'Chaos or Divine Orbs'
              : 'Chaos Orb equivalent'}
          </span>
          <button
            className="primary"
            onClick={() => {
              const sel = document.getElementById('trade-price-select') as HTMLSelectElement | null
              sel?.showPicker?.()
              sel?.focus()
            }}
          >
            Change
          </button>
          <select
            id="trade-price-select"
            value={settings.tradePriceOption ?? 'chaos_divine'}
            onChange={(e) => update('tradePriceOption', e.target.value as 'chaos_divine' | 'chaos_equivalent')}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            <option value="chaos_divine">Chaos or Divine Orbs</option>
            <option value="chaos_equivalent">Chaos Orb equivalent</option>
          </select>
        </div>
      </section>

      <section>
        <label>Default search percentage</label>
        <div className="flex items-center gap-[10px] mt-1">
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={settings.priceCheckDefaultPercent ?? 90}
            onChange={(e) => update('priceCheckDefaultPercent', parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-[13px] font-semibold text-text min-w-[36px] text-right">
            {settings.priceCheckDefaultPercent ?? 90}%
          </span>
        </div>
      </section>

      <section>
        <div
          onClick={() => update('tradeDefaultToBase', !settings.tradeDefaultToBase)}
          className="flex items-center gap-[10px] cursor-pointer select-none"
        >
          <Toggle
            checked={settings.tradeDefaultToBase ?? false}
            onChange={(val) => update('tradeDefaultToBase', val)}
          />
          <span className="text-xs text-text">
            Default all items to &quot;Base&quot; - can simplify unchecking unwanted mods
          </span>
        </div>
      </section>

      {/* Trade site login */}
      <section>
        <label>Trade site login</label>
        <div className="mt-[6px]">
          <PoeLoginButton />
        </div>
      </section>
    </>
  )
}
