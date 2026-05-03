import { useState } from 'react'
import { ReactSortable } from 'react-sortablejs'
import { CloseSmall, AddOne, Drag, AddPicture, Link } from '@icon-park/react'
import type { AppSettings, CheatSheetCategory } from '../../../../shared/types'
import { RemoveButton } from '../RemoveButton'
import { HotkeyField } from './HotkeyField'
import { generateClientCategoryId } from './utils'
import type { HotkeySlot } from './hotkey-collisions'

interface Props {
  settings: AppSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  tryHotkey: (hotkey: string, slot: HotkeySlot) => boolean
}

export function CheatSheetsTab({ settings, update, tryHotkey }: Props): JSX.Element {
  const cheatSheets = settings.cheatSheets ?? { globalHotkey: '', categories: [] }
  const setCategories = (categories: CheatSheetCategory[]): void => {
    update('cheatSheets', { ...cheatSheets, categories })
  }

  return (
    <>
      <div className="settings-section-title mt-3">Cheat Sheets</div>

      {/* Global hotkey */}
      <section>
        <label>Cheat Sheet Hotkey</label>
        <div className="mt-[6px]">
          <HotkeyField
            value={cheatSheets.globalHotkey}
            onChange={(hotkey) => {
              if (!tryHotkey(hotkey, { kind: 'cheatsheet-global' })) return
              update('cheatSheets', { ...cheatSheets, globalHotkey: hotkey })
            }}
          />
        </div>
      </section>

      {/* Categories */}
      {cheatSheets.categories.length === 0 ? (
        <CategoriesEmptyState onAdd={() => setCategories([newCategory()])} />
      ) : (
        <section>
          <label>Categories</label>
          <div className="mt-[6px]">
            <ReactSortable
              list={cheatSheets.categories.map((c) => ({ ...c }))}
              setList={setCategories}
              animation={150}
              // Restrict drag to the explicit grip icon so text selection in
              // the name input and other interactions stay normal.
              handle=".category-grab"
              className="flex flex-col gap-2"
            >
              {cheatSheets.categories.map((cat, i) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  index={i}
                  tryHotkey={tryHotkey}
                  onUpdate={(next) => {
                    const arr = [...cheatSheets.categories]
                    arr[i] = next
                    setCategories(arr)
                  }}
                  onRemove={() => {
                    void window.api.removeCheatSheetCategory(cat.id)
                    setCategories(cheatSheets.categories.filter((_, j) => j !== i))
                  }}
                />
              ))}
            </ReactSortable>
            <button
              onClick={() => setCategories([...cheatSheets.categories, newCategory()])}
              className="text-[11px] text-text-dim self-start px-3 py-1.5 mt-2"
            >
              + Add Category
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function newCategory(): CheatSheetCategory {
  return { id: generateClientCategoryId(), name: 'New Category', hotkey: '', sheets: [] }
}

function CategoriesEmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <section>
      <div className="bg-black/15 rounded p-3 flex flex-col items-center gap-1">
        <button onClick={onAdd} className="text-[11px] px-3 py-1.5">
          + Add Category
        </button>
        <div className="text-[10px] text-text-dim">
          Categories group cheat sheets and can be hotkeyed independently.
        </div>
      </div>
    </section>
  )
}

interface CategoryCardProps {
  category: CheatSheetCategory
  index: number
  tryHotkey: (hotkey: string, slot: HotkeySlot) => boolean
  onUpdate: (next: CheatSheetCategory) => void
  onRemove: () => void
}

function CategoryCard({ category, index, tryHotkey, onUpdate, onRemove }: CategoryCardProps): JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const [showHotkey, setShowHotkey] = useState(category.hotkey !== '')
  const [urlInput, setUrlInput] = useState<string | null>(null)

  if (confirming) {
    return (
      <div className="bg-black/15 rounded p-[8px] flex items-center gap-2">
        <span className="text-xs text-text-dim flex-1">Delete category &quot;{category.name}&quot;?</span>
        <button onClick={onRemove} className="text-[11px] px-3 py-1 bg-danger/20">
          Confirm
        </button>
        <button onClick={() => setConfirming(false)} className="text-[11px] px-3 py-1">
          Cancel
        </button>
      </div>
    )
  }

  const addFromFile = async (): Promise<void> => {
    const added = await window.api.addCheatSheetFromFile(category.id)
    if (added.length === 0) return
    onUpdate({ ...category, sheets: [...category.sheets, ...added.map((a) => ({ id: a.id, ext: a.ext }))] })
  }
  const addFromUrl = async (url: string): Promise<void> => {
    if (!url.trim()) return
    try {
      const added = await window.api.addCheatSheetFromUrl(category.id, url.trim())
      onUpdate({ ...category, sheets: [...category.sheets, { id: added.id, ext: added.ext }] })
      setUrlInput(null)
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      setUrlInput(`error: ${err}`)
    }
  }

  return (
    <div className="bg-black/15 rounded p-[5px] flex flex-col gap-1.5">
      {/* Name + remove */}
      <div className="flex gap-[6px] items-center">
        <div
          className="category-grab cursor-grab text-text-dim hover:text-text shrink-0 flex items-center justify-center w-5 h-5"
          title="Drag to reorder"
        >
          <Drag size={14} theme="outline" fill="currentColor" />
        </div>
        <input
          type="text"
          value={category.name}
          onChange={(e) => onUpdate({ ...category, name: e.target.value })}
          className="flex-1 text-xs h-[34px] box-border px-3 py-2 bg-black/30"
        />
        <RemoveButton onClick={() => setConfirming(true)} />
      </div>

      {/* Thumbnail strip */}
      <div className="flex flex-wrap gap-2 no-drag" onClick={(e) => e.stopPropagation()}>
        <ReactSortable
          list={category.sheets.map((s) => ({ ...s }))}
          setList={(next) => onUpdate({ ...category, sheets: next.map((s) => ({ id: s.id, ext: s.ext })) })}
          animation={150}
          handle=".sheet-grab"
          className="contents"
        >
          {category.sheets.map((sheet) => (
            <ThumbnailTile
              key={sheet.id}
              categoryId={category.id}
              sheet={sheet}
              onRemove={() => {
                void window.api.removeCheatSheet(category.id, sheet.id, sheet.ext)
                onUpdate({ ...category, sheets: category.sheets.filter((s) => s.id !== sheet.id) })
              }}
            />
          ))}
        </ReactSortable>
        <PlaceholderTile onClickFile={addFromFile} onClickUrl={() => setUrlInput('')} />
      </div>

      {/* URL paste row - shown under the thumbnail strip when the user clicks
          the link half of the placeholder tile. Same setting-box chrome as the
          hotkey rows for visual consistency. */}
      {urlInput !== null && (
        <UrlPasteRow
          value={urlInput}
          onChange={setUrlInput}
          onSubmit={() => addFromUrl(urlInput ?? '')}
          onCancel={() => setUrlInput(null)}
        />
      )}

      {/* Per-category hotkey (optional) */}
      <div className="no-drag">
        {showHotkey || category.hotkey !== '' ? (
          <HotkeyField
            value={category.hotkey}
            onChange={(hotkey) => {
              if (hotkey === '') {
                // User cleared via the field's built-in X - collapse the row
                // back to the "Add hotkey" button.
                onUpdate({ ...category, hotkey: '' })
                setShowHotkey(false)
                return
              }
              if (!tryHotkey(hotkey, { kind: 'cheatsheet-category', index })) return
              onUpdate({ ...category, hotkey })
            }}
          />
        ) : (
          <button
            onClick={() => setShowHotkey(true)}
            className="inline-flex items-center gap-1 leading-none text-[10px] text-text-dim px-2 py-1"
          >
            <AddOne size={10} theme="outline" fill="currentColor" className="flex" />
            <span className="leading-none relative -top-px">Add hotkey (optional)</span>
          </button>
        )}
      </div>
    </div>
  )
}

function ThumbnailTile({
  categoryId,
  sheet,
  onRemove,
}: {
  categoryId: string
  sheet: { id: string; ext: string }
  onRemove: () => void
}): JSX.Element {
  const src = `cheatsheet://${categoryId}/${sheet.id}.${sheet.ext}?thumb=1`
  return (
    <div className="relative group rounded overflow-hidden bg-black/30" style={{ width: 80, height: 60 }}>
      <img src={src} alt="" className="w-full h-full object-cover" />
      <div
        className="sheet-grab cursor-grab absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-full p-0.5 text-text-dim hover:text-text"
        title="Drag to reorder"
      >
        <Drag size={10} theme="outline" fill="currentColor" />
      </div>
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-full p-0.5"
        title="Remove image"
      >
        <CloseSmall size={10} theme="outline" fill="currentColor" />
      </button>
    </div>
  )
}

function PlaceholderTile({
  onClickFile,
  onClickUrl,
}: {
  onClickFile: () => void
  onClickUrl: () => void
}): JSX.Element {
  return (
    <div
      className="flex rounded border-2 border-dashed border-text-dim/40 bg-white/[0.04] overflow-hidden"
      style={{ width: 80, height: 60 }}
    >
      <button
        onClick={onClickFile}
        title="Add from file"
        className="flex-1 flex items-center justify-center text-text-dim hover:bg-white/[0.06] hover:text-accent transition-colors border-none bg-transparent rounded-none cursor-pointer"
      >
        <AddPicture size={18} theme="outline" fill="currentColor" />
      </button>
      <div className="w-px bg-text-dim/30 self-stretch" />
      <button
        onClick={onClickUrl}
        title="Add from URL"
        className="flex-1 flex items-center justify-center text-text-dim hover:bg-white/[0.06] hover:text-accent transition-colors border-none bg-transparent rounded-none cursor-pointer"
      >
        <Link size={16} theme="outline" fill="currentColor" />
      </button>
    </div>
  )
}

/** Full-width URL paste row that appears under the thumbnails when the user
 *  clicks the link half of the placeholder tile. Mirrors the HotkeyField
 *  chrome (same setting-box height + right-cluster of buttons) so the form
 *  affordance reads the same across cheat-sheet rows. */
function UrlPasteRow({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}): JSX.Element {
  const isError = value.startsWith('error: ')
  const display = isError ? '' : value
  const errorMsg = isError ? value.slice(7) : null
  return (
    <div>
      <div className="setting-box" style={{ cursor: 'auto' }}>
        <input
          autoFocus
          type="text"
          placeholder="Paste image URL"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          className="value flex-1 bg-transparent border-none outline-none p-0 m-0 min-w-0"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            title="Cancel"
            className="flex items-center justify-center w-5 h-5 shrink-0 rounded bg-white/[0.06] border-none cursor-pointer text-text-dim p-0 hover:bg-[rgba(239,83,80,0.2)] hover:text-white"
          >
            <CloseSmall size={14} theme="outline" fill="currentColor" className="flex" />
          </button>
          <button onClick={onSubmit} className="primary">
            Add
          </button>
        </div>
      </div>
      {errorMsg && <div className="text-[10px] text-danger mt-1 px-2">{errorMsg}</div>}
    </div>
  )
}
