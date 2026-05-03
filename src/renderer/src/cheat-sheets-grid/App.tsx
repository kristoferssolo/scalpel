import { useEffect, useState } from 'react'
import { CloseSmall } from '@icon-park/react'
import type { CheatSheetsSettings, CheatSheetCategory } from '../../../shared/types'
import { Notice } from '../overlay/Notice'

export function App(): JSX.Element {
  const [settings, setSettings] = useState<CheatSheetsSettings | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setSettings(s.cheatSheets)
      const focusId = (window as unknown as { __focusCategory?: string }).__focusCategory
      setActiveCategoryId(focusId ?? s.cheatSheets.categories[0]?.id ?? null)
    })
    return window.api.onSettingUpdated((key, value) => {
      if (key === 'cheatSheets') setSettings(value as CheatSheetsSettings)
    })
  }, [])

  // Listen for late focus-category events fired when the window is already open.
  useEffect(() => {
    return window.api.onCheatSheetFocusCategory((categoryId) => {
      setActiveCategoryId(categoryId ?? null)
    })
  }, [])

  if (!settings) return <div />

  if (settings.categories.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-bg-card">
        <TitleBar onClose={() => window.api.closeCheatSheets()} />
        <div className="flex-1 flex items-center justify-center">
          <Notice icon="📋" title="No cheat sheets yet" body="Add some in Settings > Cheat Sheets." />
        </div>
      </div>
    )
  }

  const active = settings.categories.find((c) => c.id === activeCategoryId) ?? settings.categories[0]

  return (
    <div className="flex flex-col h-screen bg-bg-card">
      <TitleBar onClose={() => window.api.closeCheatSheets()} />
      {settings.categories.length > 1 && (
        <CategoryTabs categories={settings.categories} activeId={active.id} onSelect={setActiveCategoryId} />
      )}
      <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-2 content-start">
        {active.sheets.map((sheet) => (
          <Thumbnail key={sheet.id} categoryId={active.id} sheet={sheet} />
        ))}
      </div>
    </div>
  )
}

function TitleBar({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      className="flex items-center justify-between px-2 py-1 border-b border-border bg-bg-solid"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[10px] text-text-dim">Cheat Sheets</span>
      <button
        onClick={onClose}
        className="text-text-dim hover:text-text"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <CloseSmall size={14} theme="outline" fill="currentColor" />
      </button>
    </div>
  )
}

function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: CheatSheetCategory[]
  activeId: string
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div className="flex gap-[6px] px-2 py-1 border-b border-border">
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`text-[10px] px-2 py-1 ${activeId === c.id ? 'bg-accent text-bg-solid' : 'text-text-dim'}`}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

function Thumbnail({ categoryId, sheet }: { categoryId: string; sheet: { id: string; ext: string } }): JSX.Element {
  const src = `cheatsheet://${categoryId}/${sheet.id}.${sheet.ext}`
  const handleEnter = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    void window.api.showCheatSheetPreview(src, {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }
  const handleLeave = (): void => {
    void window.api.hideCheatSheetPreview()
  }
  return (
    <div
      className="relative rounded overflow-hidden bg-black/30 cursor-pointer"
      style={{ width: 150, height: 100 }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <img src={src} alt="" className="w-full h-full object-cover" />
    </div>
  )
}
