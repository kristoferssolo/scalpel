import { forwardRef, useEffect, useMemo, useState } from 'react'
import type { RelatedRef } from '../shared/related-items'
import { findRelated } from '../shared/related-items'
import { IconGlow } from '../shared/IconGlow'
import { PriceChip } from '../shared/PriceChip'
import { RARITY_COLORS, iconMap } from '../shared/constants'
import { SisterShell } from './SisterShell'

/** Map related-items category to the rarity key in the shared RARITY_COLORS palette. */
const CATEGORY_TO_RARITY: Record<RelatedRef['category'], string> = {
  base: 'Normal',
  unique: 'Unique',
  divination: 'Divination',
  gem: 'Gem',
  beast: 'Unique',
}

/** Display order buckets -- lower value renders higher in the list. Fragments/map items
 *  (all under the 'base' category in APT's data) go first, uniques last. */
const CATEGORY_ORDER: Record<RelatedRef['category'], number> = {
  base: 0,
  divination: 1,
  gem: 2,
  beast: 3,
  unique: 4,
}

type PriceMap = Record<string, { chaosValue: number; divineValue?: number } | null>

interface SisterOverlayProps {
  /** Triggering item's display name (PoeItem.name). */
  itemName: string
  league: string
  chaosPerDivine?: number
  /** Absolute px offsets inside the overlay canvas. */
  left: number
  top: number
  width: number
  /** Drag offset applied by the main panel so the sister follows it around. */
  dragOffset?: { x: number; y: number }
  /** Multiplier applied to match the main panel's scale setting. */
  scale?: number
  /** Origin edge for the scale transform -- matches the main panel's mount side. */
  scaleOrigin?: 'top left' | 'top right'
  /** Pre-scale max height in CSS px. Falls back to viewport-based bound if absent. */
  maxHeight?: number
}

export const SisterOverlay = forwardRef<HTMLDivElement, SisterOverlayProps>(function SisterOverlay(
  { itemName, league, chaosPerDivine, left, top, width, dragOffset, scale, scaleOrigin, maxHeight }: SisterOverlayProps,
  ref,
): JSX.Element | null {
  // Keep the displayed entry up as long as the user is drilling into items from the
  // current sister list (those clicks price-check items that may have no entry of their
  // own). If the new itemName isn't in the current entry's list AND has no entry itself,
  // the user hotkeyed something unrelated -- close the sister.
  const [entry, setEntry] = useState<ReturnType<typeof findRelated>>(() => findRelated(itemName))
  useEffect(() => {
    const next = findRelated(itemName)
    if (next) {
      setEntry(next)
      return
    }
    setEntry((prev) => {
      if (!prev) return prev
      const inList = prev.query.some((q) => q.name === itemName) || prev.items.some((i) => i.name === itemName)
      return inList ? prev : null
    })
  }, [itemName])

  const [prices, setPrices] = useState<PriceMap>({})

  useEffect(() => {
    if (!entry) return
    const refs = [...entry.query, ...entry.items].map((i) => ({ name: i.name, baseType: i.baseType }))
    window.api.batchLookupRefPrices(refs, league).then(setPrices)
  }, [league, entry])

  // Query siblings (the other trigger items in this entry, excluding the one currently
  // being price-checked) render at the top -- they're the "family" of the current item.
  // Below them, the entry's drop/reward items go sorted by category + chaos price desc.
  // Both groups get the same category-then-price-desc sort so every section shows the
  // highest value first (e.g. Golden/Silver oils above cheap ones).
  const sortedItems = useMemo(() => {
    if (!entry) return []
    const byCategoryThenPrice = (a: RelatedRef, b: RelatedRef): number => {
      const bucketDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
      if (bucketDiff !== 0) return bucketDiff
      const aPrice = prices[a.name]?.chaosValue ?? 0
      const bPrice = prices[b.name]?.chaosValue ?? 0
      return bPrice - aPrice
    }
    const sortedSiblings = entry.query.filter((q) => q.name !== itemName).sort(byCategoryThenPrice)
    const sortedDrops = [...entry.items].sort(byCategoryThenPrice)
    return [...sortedSiblings, ...sortedDrops]
  }, [entry, prices, itemName])

  if (!entry) return null

  return (
    <SisterShell
      ref={ref}
      left={left}
      top={top}
      width={width}
      dragOffset={dragOffset}
      scale={scale}
      scaleOrigin={scaleOrigin}
      maxHeight={maxHeight}
      // Key off the entry (not the clicked itemName) so drill-downs into an item without
      // its own related-items entry don't re-trigger the slide animation.
      animKey={entry.query[0].name}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {sortedItems.map((item, i) => {
          const price = prices[item.name]
          const iconUrl = iconMap[item.name] ?? (item.baseType ? iconMap[item.baseType] : undefined)
          return (
            <div
              key={`${item.name}-${i}`}
              onClick={() =>
                window.api.sisterOpenPriceCheck({
                  name: item.name,
                  baseType: item.baseType,
                  category: item.category,
                })
              }
              className="px-2 py-2 first:pt-5 last:pb-5 flex flex-col gap-1 cursor-pointer hover:bg-white/[0.07]"
              style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
            >
              <div
                className="text-[11px] text-center leading-tight"
                style={{ color: RARITY_COLORS[CATEGORY_TO_RARITY[item.category]] }}
              >
                {item.name}
              </div>
              <div className="flex items-center justify-center gap-2">
                {iconUrl ? (
                  <IconGlow src={iconUrl} size={44} blur={14} saturate={2.5} opacity={0.35} />
                ) : (
                  <div className="w-[44px] h-[44px] shrink-0" />
                )}
                {price && price.chaosValue > 0 && (
                  <PriceChip
                    chaosValue={price.chaosValue}
                    divineValue={price.divineValue}
                    chaosPerDivine={chaosPerDivine}
                    size="sm"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </SisterShell>
  )
})
