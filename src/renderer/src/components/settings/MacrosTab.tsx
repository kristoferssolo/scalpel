import type { AppSettings } from '../../../../shared/types'
import { Toggle } from '../Toggle'
import { RemoveButton } from '../RemoveButton'
import { HotkeyRecorder } from './HotkeyRecorder'
import { CommandInput } from './CommandInput'
import { APP_MACRO_DEFS } from './utils'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

export function MacrosTab({ settings, update }: Props): JSX.Element {
  return (
    <>
      {/* Chat Macros */}
      <div className="text-[10px] text-accent tracking-[1.5px] uppercase mt-3 font-bold">Chat Macros</div>
      <section>
        <div className="flex flex-col gap-2">
          {(settings.chatCommands ?? []).map((cmd, i) => {
            const updateCmd = (patch: Partial<typeof cmd>) => {
              const cmds = [...(settings.chatCommands ?? [])]
              cmds[i] = { ...cmds[i], ...patch }
              update('chatCommands', cmds)
            }
            return (
              <div key={i} className="flex flex-col gap-1.5 bg-black/15 rounded p-[5px]">
                <div className="flex gap-[6px] items-center">
                  <HotkeyRecorder value={cmd.hotkey} onChange={(hotkey) => updateCmd({ hotkey })} />
                  <CommandInput value={cmd.command} onChange={(command) => updateCmd({ command })} />
                  <RemoveButton
                    onClick={() =>
                      update(
                        'chatCommands',
                        (settings.chatCommands ?? []).filter((_, j) => j !== i),
                      )
                    }
                  />
                </div>
                <div
                  onClick={() => updateCmd({ autoSubmit: cmd.autoSubmit === false })}
                  className="flex items-center gap-[10px] cursor-pointer select-none ml-0.5"
                >
                  <Toggle checked={cmd.autoSubmit !== false} onChange={(autoSubmit) => updateCmd({ autoSubmit })} />
                  <span className="text-[11px] text-text-dim">Submit automatically (press Enter)</span>
                </div>
              </div>
            )
          })}
          <button
            onClick={() => {
              const cmds = [...(settings.chatCommands ?? []), { hotkey: '', command: '', autoSubmit: true }]
              update('chatCommands', cmds)
            }}
            className="text-[11px] text-text-dim self-start px-3 py-1.5"
          >
            + Add Command
          </button>
        </div>
      </section>

      {/* Other Macros */}
      <div className="text-[10px] text-accent tracking-[1.5px] uppercase mt-3 font-bold">Other Macros</div>
      <section>
        <div
          onClick={() => update('stashScrollEnabled', !settings.stashScrollEnabled)}
          className="flex items-center gap-[10px] cursor-pointer select-none"
        >
          <Toggle
            checked={settings.stashScrollEnabled ?? false}
            onChange={(val) => update('stashScrollEnabled', val)}
          />
          <span className="text-xs text-text">Stash tab scrolling (Ctrl + Scroll Wheel)</span>
        </div>
      </section>

      {/* App Macros */}
      <div className="text-[10px] text-accent tracking-[1.5px] uppercase mt-3 font-bold">App Macros</div>
      <section>
        <div className="flex flex-col gap-2">
          {(settings.appMacros ?? []).map((macro, i) => {
            const usedActions = new Set((settings.appMacros ?? []).map((m, j) => (j !== i ? m.action : '')))
            const availableActions = APP_MACRO_DEFS.filter((d) => d.id === macro.action || !usedActions.has(d.id))
            return (
              <div key={i} className="flex gap-[6px] items-center bg-black/15 rounded p-[5px]">
                <HotkeyRecorder
                  value={macro.hotkey}
                  onChange={(hotkey) => {
                    const macros = [...(settings.appMacros ?? [])]
                    macros[i] = { ...macros[i], hotkey }
                    update('appMacros', macros)
                  }}
                />
                <select
                  value={macro.action}
                  onChange={(e) => {
                    const macros = [...(settings.appMacros ?? [])]
                    macros[i] = { ...macros[i], action: e.target.value }
                    update('appMacros', macros)
                  }}
                  className="text-[11px] flex-1 rounded h-[34px] box-border"
                  style={{ padding: '4px 24px 4px 8px' }}
                >
                  {availableActions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <RemoveButton
                  onClick={() =>
                    update(
                      'appMacros',
                      (settings.appMacros ?? []).filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            )
          })}
          {(settings.appMacros ?? []).length < APP_MACRO_DEFS.length && (
            <button
              onClick={() => {
                const used = new Set((settings.appMacros ?? []).map((m) => m.action))
                const next = APP_MACRO_DEFS.find((d) => !used.has(d.id))
                if (next) update('appMacros', [...(settings.appMacros ?? []), { action: next.id, hotkey: '' }])
              }}
              className="text-[11px] text-text-dim self-start px-3 py-1.5"
            >
              + Add App Macro
            </button>
          )}
        </div>
      </section>
    </>
  )
}
