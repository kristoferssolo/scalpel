import { forwardRef, useEffect, useMemo, useState } from 'react'
import { IconGlow } from '../shared/IconGlow'
import { PriceChip } from '../shared/PriceChip'
import { iconMap, RARITY_COLORS } from '../shared/constants'
import { SisterShell } from './SisterShell'
import { SisterRow } from './SisterRow'
import type { ItemRarity } from '../../../shared/types'

type PriceMap = Record<string, { chaosValue: number; divineValue?: number } | null>

interface TierItemsSisterProps {
  /** Base types to display — the tier's BaseType condition values. */
  baseTypes: string[]
  /** Item class carried through to lookupBaseType so the new item lookup preserves class. */
  itemClass: string
  /** The user's current item base. Highlighted and made unclickable in the list. */
  currentBaseType?: string
  /** Rarity of the user's current item; used to color the row titles + drive the
   *  synthesized item's rarity when clicking a base. uniqueTier overrides this. */
  currentRarity?: ItemRarity
  /** League for the poe.ninja price lookup. */
  league: string
  /** True when the tier's Rarity is Unique, so the price backend returns the best-priced
   *  unique for each base rather than a generic base price. */
  uniqueTier?: boolean
  /** Positioning + slide-animation props are passed straight to SisterShell. */
  left: number
  top: number
  width: number
  dragOffset?: { x: number; y: number }
  scale?: number
  scaleOrigin?: 'top left' | 'top right'
  maxHeight?: number
  /** Key the slide animation off the tier so switching tiers re-animates entry. */
  animKey?: string
}

export const TierItemsSister = forwardRef<HTMLDivElement, TierItemsSisterProps>(function TierItemsSister(
  {
    baseTypes,
    itemClass,
    currentBaseType,
    currentRarity,
    league,
    uniqueTier,
    left,
    top,
    width,
    dragOffset,
    scale,
    scaleOrigin,
    maxHeight,
    animKey,
  },
  ref,
): JSX.Element | null {
  const [prices, setPrices] = useState<PriceMap>({})

  useEffect(() => {
    if (baseTypes.length === 0) return
    let cancelled = false
    window.api.batchLookupPrices(baseTypes, league, uniqueTier).then((p) => {
      if (!cancelled) setPrices(p)
    })
    return () => {
      cancelled = true
    }
  }, [baseTypes.join('|'), league, uniqueTier])

  // Sort by chaos price descending so the most valuable base in the tier is at the top.
  // Unpriced bases fall to the bottom, original order preserved among them.
  const sortedNames = useMemo(() => {
    return [...baseTypes].sort((a, b) => (prices[b]?.chaosValue ?? -1) - (prices[a]?.chaosValue ?? -1))
  }, [baseTypes.join('|'), prices])

  // Synthetic rarity for clicked rows: a unique-rarity tier always produces a unique
  // synthetic; otherwise carry the current item's rarity through so swapping bases
  // stays in context (rare -> rare, magic -> magic, etc.).
  const synthRarity: ItemRarity | undefined = uniqueTier ? 'Unique' : currentRarity
  const titleColor =
    synthRarity === 'Unique' || synthRarity === 'Rare' || synthRarity === 'Magic'
      ? RARITY_COLORS[synthRarity]
      : 'var(--text)'

  if (baseTypes.length === 0) return null
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
      animKey={animKey}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {sortedNames.map((name, i) => {
          const iconUrl = iconMap[name]
          const price = prices[name]
          const isCurrent = name === currentBaseType
          return (
            <SisterRow
              key={`${name}-${i}`}
              isCurrent={isCurrent}
              zebraEven={i % 2 === 0}
              onClick={() => window.api.lookupBaseType(name, itemClass, synthRarity)}
              title={isCurrent ? name : `Switch to ${name}`}
            >
              <div className="text-[11px] text-center leading-tight" style={{ color: titleColor }}>
                {name}
              </div>
              <div className="flex items-center justify-center gap-2">
                {iconUrl ? (
                  <IconGlow src={iconUrl} size={44} blur={14} saturate={2.5} opacity={0.35} />
                ) : (
                  <div className="w-[44px] h-[44px] shrink-0" />
                )}
                {price && price.chaosValue > 0 && (
                  <PriceChip chaosValue={price.chaosValue} divineValue={price.divineValue} size="sm" />
                )}
              </div>
            </SisterRow>
          )
        })}
      </div>
    </SisterShell>
  )
})
