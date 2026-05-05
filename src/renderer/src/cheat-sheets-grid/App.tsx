import { useEffect, useState } from 'react'
import { GridFour, GridNine, GridSixteen } from '@icon-park/react'
import type { CheatSheetsSettings, CheatSheetCategory } from '../../../shared/types'
import { Chrome } from '../secondary-overlay/Chrome'

/** Three thumbnail sizes the user can flip between via the header icons. The
 *  3:2 aspect ratio is preserved so thumb sources don't need re-cropping. */
const THUMB_SIZES = {
  large: { w: 150, h: 100 },
  medium: { w: 105, h: 70 },
  small: { w: 66, h: 44 },
} as const
type ThumbSize = keyof typeof THUMB_SIZES

const STORAGE_KEY = 'scalpel:cheatsheets:thumbnailSize'
const DEFAULT_SIZE: ThumbSize = 'large'
/** Active-icon gold -- matches the league/badge gold used elsewhere. */
const ACTIVE_COLOR = '#fbbf24'

function loadThumbSize(): ThumbSize {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in THUMB_SIZES) return saved as ThumbSize
  } catch {
    /* localStorage disabled */
  }
  return DEFAULT_SIZE
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<CheatSheetsSettings | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [thumbSize, setThumbSize] = useState<ThumbSize>(loadThumbSize)

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, thumbSize)
    } catch {
      /* localStorage disabled -- silently drop the persist */
    }
  }, [thumbSize])

  if (!settings) return <div />

  const onClose = (): void => window.api.closeCheatSheets()
  const sizeControls = <SizeControls value={thumbSize} onChange={setThumbSize} />

  if (settings.categories.length === 0) {
    return (
      <Chrome onClose={onClose} headerEnd={sizeControls}>
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

  const dims = THUMB_SIZES[thumbSize]
  return (
    <Chrome onClose={onClose} headerContent={tabs} headerEnd={sizeControls}>
      <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-2 content-start">
        {active.sheets.map((sheet) => (
          <Thumbnail key={sheet.id} categoryId={active.id} sheet={sheet} width={dims.w} height={dims.h} />
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

function SizeControls({ value, onChange }: { value: ThumbSize; onChange: (s: ThumbSize) => void }): JSX.Element {
  // Order matches the visual progression on screen: GridFour = fewest cells in
  // the icon = largest thumbs in the grid. Hover bumps inactive icons to full
  // white; active stays gold.
  const buttons: Array<{ key: ThumbSize; Icon: typeof GridFour; title: string }> = [
    { key: 'large', Icon: GridFour, title: 'Large thumbnails' },
    { key: 'medium', Icon: GridNine, title: 'Medium thumbnails' },
    { key: 'small', Icon: GridSixteen, title: 'Small thumbnails' },
  ]
  return (
    <>
      {buttons.map(({ key, Icon, title }) => {
        const active = value === key
        // lineHeight:0 strips the inline baseline padding the icon-park <span>
        // wrapper inherits, so the glyph optically centers in the 24x24 box.
        const baseStyle: React.CSSProperties = { lineHeight: 0 }
        const style = active ? { ...baseStyle, color: ACTIVE_COLOR } : baseStyle
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={title}
            className={`w-6 h-6 flex items-center justify-center transition-colors ${active ? '' : 'text-text-dim hover:text-text'}`}
            style={style}
          >
            <Icon size={15} theme="outline" fill="currentColor" />
          </button>
        )
      })}
    </>
  )
}

function Thumbnail({
  categoryId,
  sheet,
  width,
  height,
}: {
  categoryId: string
  sheet: { id: string; ext: string }
  width: number
  height: number
}): JSX.Element {
  const fullSrc = `cheatsheet://${categoryId}/${sheet.id}.${sheet.ext}`
  const thumbSrc = `${fullSrc}?thumb=1`
  return (
    <div
      className="relative rounded overflow-hidden bg-black/30 cursor-pointer transition-[width,height] duration-150"
      style={{ width, height }}
      onMouseEnter={() => window.api.showCheatSheetPreview(fullSrc)}
      onMouseLeave={() => window.api.hideCheatSheetPreview()}
    >
      <img src={thumbSrc} alt="" draggable={false} className="w-full h-full object-cover" />
    </div>
  )
}
