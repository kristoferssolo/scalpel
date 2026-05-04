import { useEffect, useState } from 'react'
import type { CheatSheetsSettings, CheatSheetCategory } from '../../../shared/types'
import { Chrome } from '../secondary-overlay/Chrome'

export function App(): JSX.Element {
  const [settings, setSettings] = useState<CheatSheetsSettings | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setSettings(s.cheatSheets)
      setActiveCategoryId(s.cheatSheets.categories[0]?.id ?? null)
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

  const onClose = (): void => window.api.closeCheatSheets()

  if (settings.categories.length === 0) {
    return (
      <Chrome onClose={onClose}>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-[11px] text-text-dim">You didn&apos;t add any cheat sheets. Add some in Settings</span>
          <button onClick={() => window.api.openSettingsTab('cheatsheets')} className="text-[11px] px-3 py-1.5">
            Open Sheet Settings
          </button>
        </div>
      </Chrome>
    )
  }

  const active = settings.categories.find((c) => c.id === activeCategoryId) ?? settings.categories[0]
  // Don't show tabs when there's only one - it'd be a single non-functional
  // chip in the header.
  const tabs =
    settings.categories.length > 1 ? (
      <CategoryTabs categories={settings.categories} activeId={active.id} onSelect={setActiveCategoryId} />
    ) : undefined

  return (
    <Chrome onClose={onClose} headerContent={tabs}>
      <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-2 content-start">
        {active.sheets.map((sheet) => (
          <Thumbnail key={sheet.id} categoryId={active.id} sheet={sheet} />
        ))}
      </div>
    </Chrome>
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
    <>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`text-[10px] px-2 py-1 ${activeId === c.id ? 'bg-accent text-bg-solid' : 'text-text-dim'}`}
        >
          {c.name}
        </button>
      ))}
    </>
  )
}

function Thumbnail({ categoryId, sheet }: { categoryId: string; sheet: { id: string; ext: string } }): JSX.Element {
  const fullSrc = `cheatsheet://${categoryId}/${sheet.id}.${sheet.ext}`
  const thumbSrc = `${fullSrc}?thumb=1`
  return (
    <div
      className="relative rounded overflow-hidden bg-black/30 cursor-pointer"
      style={{ width: 150, height: 100 }}
      onMouseEnter={() => window.api.showCheatSheetPreview(fullSrc)}
      onMouseLeave={() => window.api.hideCheatSheetPreview()}
    >
      <img src={thumbSrc} alt="" draggable={false} className="w-full h-full object-cover" />
    </div>
  )
}
