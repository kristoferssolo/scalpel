import { forwardRef, useEffect, useMemo, useState } from 'react'
import { IconGlow } from '../shared/IconGlow'
import { PriceChip } from '../shared/PriceChip'
import { iconMap } from '../shared/constants'
import { SisterShell } from './SisterShell'

type PriceMap = Record<string, { chaosValue: number; divineValue?: number } | null>

interface TierItemsSisterProps {
  /** Base types to display — the tier's BaseType condition values. */
  baseTypes: string[]
  /** Item class carried through to lookupBaseType so the new item lookup preserves class. */
  itemClass: string
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
  { baseTypes, itemClass, league, uniqueTier, left, top, width, dragOffset, scale, scaleOrigin, maxHeight, animKey },
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
          return (
            <div
              key={`${name}-${i}`}
              onClick={() => window.api.lookupBaseType(name, itemClass)}
              className="px-2 py-2 first:pt-5 last:pb-5 flex flex-col gap-1 cursor-pointer hover:bg-white/[0.07]"
              style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
              title={`Switch to ${name}`}
            >
              <div className="text-[11px] text-center leading-tight text-text">{name}</div>
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
            </div>
          )
        })}
      </div>
    </SisterShell>
  )
})
