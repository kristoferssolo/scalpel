import { Setting, CloseSmall, ChartHistogram, Flask, Buy } from '@icon-park/react'
import type { HideableTabKey, OverlayData } from '../../../shared/types'
import type { GameFeatures } from '../../../shared/game-features'
import { getCurrencyIcons } from '../shared/icons'
import { DIV_CARD_ICON_URL, divCardArtMap, iconMap, IP } from '../shared/constants'
import dustIconAsset from '../assets/currency/thaumaturgic-dust.png'
import appIcon from '../../../../resources/icon.png'
import poereIcon from '../assets/other/poere-logo.svg'

type View =
  | 'idle'
  | 'item'
  | 'no-filter'
  | 'no-item'
  | 'setup'
  | 'audit'
  | 'tools'
  | 'dust'
  | 'divcards'
  | 'pricecheck'
  | 'regex'

interface TitleBarProps {
  view: View
  overlayData: OverlayData | null
  poeVersion: 1 | 2 | null
  features: GameFeatures
  hasPriceCheckData: boolean
  hiddenTabs: Set<HideableTabKey>
  onSetView: (view: View | ((prev: View) => View)) => void
  onClose: () => void
  onMouseDown: (e: React.MouseEvent) => void
}

export function TitleBar({
  view,
  overlayData,
  poeVersion,
  features,
  hasPriceCheckData,
  hiddenTabs,
  onSetView,
  onClose,
  onMouseDown,
}: TitleBarProps): JSX.Element {
  const fallbackIcon = getCurrencyIcons(poeVersion ?? 1).baseline
  return (
    <div
      className="flex items-center justify-between px-3.5 py-2.5 border-b border-border cursor-grab"
      onMouseDown={onMouseDown}
    >
      <span className="text-accent font-bold tracking-[1px] flex items-center gap-1.5">
        <img src={appIcon} alt="" className="w-4 h-4" />
        Scalpel
        <span className="text-[9px] text-accent font-medium opacity-60 self-end mb-px -ml-0.5">
          Beta {__APP_VERSION__}
          {poeVersion ? ` / PoE${poeVersion}` : ''}
        </span>
      </span>
      <div className="flex gap-1.5 items-center">
        {/* Tools tab -- only visible when active */}
        {view === 'tools' && (
          <button
            onClick={() => onSetView('tools')}
            title="Tools"
            className="w-[30px] h-[30px] flex items-center justify-center bg-accent text-[#171821]"
          >
            <Flask size={16} {...IP} />
          </button>
        )}
        {/* Audit tab -- only visible when active. Procced by the audit-tier button in the
            filter editor or the openAudit hotkey, never user-toggleable. Click is a no-op
            re-affirm (matches Tools); navigation away clears it. */}
        {view === 'audit' && (
          <button
            onClick={() => onSetView('audit')}
            title="Price Audit"
            className="w-[30px] h-[30px] flex items-center justify-center bg-accent text-[#171821]"
          >
            <ChartHistogram size={16} {...IP} />
          </button>
        )}
        {/* Item icon -- always navigates back to search results */}
        {!hiddenTabs.has('item') && (
          <button
            onClick={() => {
              if (overlayData) onSetView('item')
            }}
            title="Filter Editor"
            className="p-0.5 w-[30px] h-[30px] flex items-center justify-center"
            style={{
              background: view === 'item' ? 'var(--accent)' : undefined,
              color: view === 'item' ? '#171821' : undefined,
              opacity: overlayData ? 1 : 0.35,
              cursor: overlayData ? 'pointer' : 'default',
            }}
          >
            {(() => {
              const isDivCard = overlayData && overlayData.item.itemClass === 'Divination Cards'
              const divArt = isDivCard
                ? (divCardArtMap.get(overlayData.item.baseType) ?? divCardArtMap.get(overlayData.item.name))
                : undefined
              const src = divArt
                ? `https://web.poecdn.com/image/divination-card/${divArt}.png`
                : overlayData
                  ? (iconMap[overlayData.item.name] ?? iconMap[overlayData.item.baseType] ?? fallbackIcon)
                  : fallbackIcon
              return (
                <img
                  src={src}
                  alt=""
                  className="w-5 h-5 object-cover"
                  style={{
                    imageRendering: 'auto',
                    borderRadius: divArt ? 2 : 0,
                  }}
                />
              )
            })()}
          </button>
        )}
        {!hiddenTabs.has('pricecheck') && (
          <button
            onClick={() => hasPriceCheckData && onSetView('pricecheck')}
            disabled={!hasPriceCheckData}
            title={hasPriceCheckData ? 'Price Checker' : 'Price Checker (no item checked yet)'}
            className="w-[30px] h-[30px] flex items-center justify-center disabled:cursor-default"
            style={{
              background: view === 'pricecheck' ? 'var(--accent)' : undefined,
              color: view === 'pricecheck' ? '#171821' : undefined,
              opacity: hasPriceCheckData ? 1 : 0.35,
            }}
          >
            <Buy size={16} {...IP} />
          </button>
        )}
        {features.dustExplorer && !hiddenTabs.has('dust') && (
          <button
            onClick={() => onSetView('dust')}
            title="Dust Explorer"
            className="w-[30px] h-[30px] flex items-center justify-center p-0.5"
            style={{
              background: view === 'dust' ? 'var(--accent)' : undefined,
            }}
          >
            <img src={dustIconAsset} alt="" className="w-[18px] h-[18px] object-contain" />
          </button>
        )}
        {features.divCards && !hiddenTabs.has('divcards') && (
          <button
            onClick={() => onSetView('divcards')}
            title="Div Card Explorer"
            className="w-[30px] h-[30px] flex items-center justify-center p-0.5 text-[15px]"
            style={{
              background: view === 'divcards' ? 'var(--accent)' : undefined,
            }}
          >
            <img src={DIV_CARD_ICON_URL} alt="" className="w-[18px] h-[18px] object-contain" />
          </button>
        )}
        {features.regexTool && !hiddenTabs.has('regex') && (
          <button
            onClick={() => onSetView('regex')}
            title="Regex Tool"
            className="w-[30px] h-[30px] flex items-center justify-center p-0.5"
            style={{
              background: view === 'regex' ? 'var(--accent)' : undefined,
            }}
          >
            <img
              src={poereIcon}
              alt=""
              className="w-[18px] h-[18px] object-contain"
              style={{ filter: view === 'regex' ? 'brightness(0.1)' : 'none' }}
            />
          </button>
        )}
        <button
          onClick={() => onSetView('setup')}
          className="w-[30px] h-[30px] flex items-center justify-center"
          style={{
            background: view === 'setup' ? 'var(--accent)' : undefined,
            color: view === 'setup' ? '#171821' : undefined,
          }}
        >
          <Setting size={16} {...IP} />
        </button>
        <button onClick={onClose} className="w-[30px] h-[30px] flex items-center justify-center">
          <CloseSmall size={16} {...IP} />
        </button>
      </div>
    </div>
  )
}
