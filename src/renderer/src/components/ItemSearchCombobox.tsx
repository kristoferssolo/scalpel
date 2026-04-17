import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import itemIcons from '../../../shared/data/items/item-icons.json'
import type { FilterAction } from '../../../shared/types'
import { IconGlow } from '../shared/IconGlow'
import { LootLabel, HiddenLootLabel } from '../shared/LootLabel'
import { InfoChip } from '../shared/PriceChip'
import { goldIcon } from '../shared/icons'

interface SearchItem {
  name: string
  baseType: string
  itemClass: string
  rarity: 'Unique' | 'Currency'
  block: { visibility: 'Show' | 'Hide'; actions: FilterAction[] } | null
  reward?: string
  iconUrl: string | null
}

const iconMap = itemIcons as Record<string, string>

/** Embedded icons for items the PoE CDN doesn't have. */
const LOCAL_ICONS: Record<string, string> = {
  Gold: goldIcon,
}

const STACKABLE_MATERIAL_CLASSES = new Set([
  'Essences',
  'Map Fragments',
  'Scarabs',
  'Incubators',
  'Delve Socketable Currency',
  'Delve Stackable Socketable Currency',
])

/** Sort order when a search matches multiple buckets. Lower wins. */
function priority(item: SearchItem): number {
  if (item.name === 'Gold') return 0
  if (item.itemClass === 'Currency' || item.itemClass === 'Stackable Currency') return 1
  if (STACKABLE_MATERIAL_CLASSES.has(item.itemClass)) return 2
  if (item.itemClass === 'Divination Cards') return 3
  if (item.rarity === 'Unique') return 4
  return 5
}

export function ItemSearchCombobox({ onPicked }: { onPicked?: () => void }): JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SearchItem[]>([])
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getSearchableItems().then((entries) => {
      setItems(
        entries.map((e) => ({
          ...e,
          iconUrl: LOCAL_ICONS[e.name] ?? iconMap[e.name] ?? iconMap[e.baseType] ?? null,
        })),
      )
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onBlur = (): void => setOpen(false)
    window.addEventListener('mousedown', onClick)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('blur', onBlur)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return
    const update = (): void => {
      const rect = inputRef.current!.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open, query])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .map((it) => {
        const nameMatch = it.name.toLowerCase().includes(q)
        const rewardMatch = !nameMatch && !!it.reward && it.reward.toLowerCase().includes(q)
        if (!nameMatch && !rewardMatch) return null
        return { item: it, rewardMatch }
      })
      .filter((r): r is { item: SearchItem; rewardMatch: boolean } => r !== null)
      .sort((a, b) => {
        const pa = priority(a.item)
        const pb = priority(b.item)
        if (pa !== pb) return pa - pb
        return a.item.name.localeCompare(b.item.name)
      })
      .slice(0, 40)
  }, [query, items])

  useEffect(() => {
    const showingMenu = open && results.length > 0
    if (!showingMenu) return
    window.api.lockInteractive()
    return () => window.api.unlockInteractive()
  }, [open, results.length])

  const pick = (item: SearchItem): void => {
    const uniqueName = item.rarity === 'Unique' ? item.name : undefined
    window.api.lookupBaseType(item.baseType, item.itemClass, item.rarity, uniqueName)
    setQuery('')
    setOpen(false)
    onPicked?.()
  }

  return (
    <div ref={containerRef} className="mt-4">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search items..."
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="w-full text-[12px] px-3 py-2 rounded bg-black/30 border border-border text-text outline-none focus:border-accent"
      />
      {open &&
        results.length > 0 &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed bg-bg border border-border rounded overflow-hidden overflow-y-auto z-[9999]"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: 400,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            {results.map(({ item, rewardMatch }, i) => {
              const isHidden = item.block?.visibility === 'Hide'
              return (
                <div
                  key={`${item.rarity}-${item.name}-${i}`}
                  onClick={() => pick(item)}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ padding: '8px 10px', background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {item.iconUrl ? (
                    <IconGlow src={item.iconUrl} size={22} blur={10} saturate={2.5} opacity={0.35} />
                  ) : (
                    <div className="w-[22px] h-[22px] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 flex items-center gap-[6px] flex-wrap">
                    {item.block ? (
                      isHidden ? (
                        <HiddenLootLabel label={item.name} />
                      ) : (
                        <LootLabel block={item.block} label={item.name} />
                      )
                    ) : (
                      <span className="text-[11px] text-text-dim">{item.name}</span>
                    )}
                    {isHidden && <span className="text-[9px] font-bold text-hide shrink-0">[HIDDEN]</span>}
                    {rewardMatch && item.reward && (
                      <InfoChip size="sm" className="shrink min-w-0 max-w-full ml-2">
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.reward}</span>
                      </InfoChip>
                    )}
                  </div>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
