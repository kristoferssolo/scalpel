import { useState, useEffect, useRef, useMemo } from 'react'
import { ReactSortable } from 'react-sortablejs'
import {
  MAP_MODS,
  DANGER_COLORS,
  DANGER_LABELS,
  NIGHTMARE_REGROUPED,
  type Danger,
} from '../../../../shared/data/regex/map-mods'
import { buildMapRegex, POE_REGEX_MAX_LENGTH } from './regex-engine'
import { buildQualifierRegex, QUALIFIERS, QUALIFIER_GROUPS, type QualifierValues } from './Qualifiers'
import {
  Down,
  Right,
  CloseSmall,
  AddOne,
  Forbid,
  CheckOne,
  SettingConfig,
  Compass,
  Search,
  Save,
  Buy,
  Drag,
} from '@icon-park/react'
import poereIconTight from '../../assets/other/poere-logo-tight.svg'
import itemIcons from '../../../../shared/data/items/item-icons.json'
import { FilterChip } from '../price-check/FilterChip'
import { TradeListings } from '../price-check/TradeListings'
import { RateLimitBar } from '../price-check/RateLimitBar'
import type { Listing } from '../price-check/types'
import { InfoChip } from '../../shared/PriceChip'
import { ScrubInput } from './ScrubInput'
import { generatePresetTags, CUSTOM_TAG_COLOR } from './preset-tags'
import type { RegexPreset, RegexPresetTag } from '../../../../shared/types'

const DANGER_ORDER: Danger[] = ['lethal', 'dangerous', 'annoying', 'mild', 'harmless', 'beneficial']

const icons = itemIcons as Record<string, string>
const MAP_TIER_ICONS: Record<number | string, string> = Object.fromEntries([
  ...Array.from({ length: 16 }, (_, i) => [i + 1, icons[`Map (Tier ${i + 1})`]]),
  ['nightmare', icons['Nightmare Map']],
])
const ORIGINATOR_TIER_ICONS: Record<number, string> = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [i + 1, icons[`Zana Map (Tier ${i + 1})`]]),
)

const TAB_COLORS = {
  qualifiers: '#81c784',
  avoid: '#ef5350',
  want: '#81c784',
  nightmare: '#b71c1c',
} as const

function TierButton({
  icon,
  size,
  title,
  disabled,
  onClick,
}: {
  icon: string
  size: number
  title: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center border-none cursor-pointer disabled:opacity-30"
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        padding: size > 30 ? '3px 3px 2px' : '2px 2px 1px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
      }}
      title={title}
    >
      <img src={icon} alt={title} style={{ width: size, height: size, objectFit: 'contain' }} />
    </button>
  )
}

function formatModText(text: string): string {
  return text.replace(/\d+[-to ]*\d*%/g, '#%').replace(/\d+[-to ]*\d+/g, '#')
}

type Tab = 'qualifiers' | 'avoid' | 'want'
type WantMode = 'any' | 'all'

function loadStorage<T>(key: string, fallback: T, parse: (s: string) => T = JSON.parse): T {
  try {
    const saved = localStorage.getItem(key)
    return saved != null ? parse(saved) : fallback
  } catch {
    return fallback
  }
}

function loadSet(key: string): Set<number> {
  return new Set(loadStorage<number[]>(key, []))
}

const CUSTOM_TAG_TEXT = '#E40000'

/** Style for a preset tag chip */
function tagChipStyle(tag: RegexPresetTag): React.CSSProperties {
  const isCustom = !tag.source || tag.source === 'custom'
  return {
    background: isCustom ? '#fff' : `${tag.color}cc`,
    color: isCustom ? CUSTOM_TAG_TEXT : '#fff',
    border: isCustom ? `1px solid ${CUSTOM_TAG_TEXT}` : undefined,
    borderRadius: 2,
    textShadow: isCustom ? undefined : '0 1px 2px rgba(0,0,0,0.4)',
  }
}

/** Icon for a preset tag source type */
function TagSourceIcon({ source, size = 12 }: { source?: string; size?: number }): JSX.Element | null {
  const fill: [string, string] = ['currentColor', 'rgba(255,255,255,0.2)']
  const style = { marginTop: size > 10 ? 1 : 0, marginLeft: size > 10 ? -2 : -1 }
  if (source === 'qualifier') return <AddOne size={size} theme="two-tone" fill={fill} style={style} />
  if (source === 'avoid') return <Forbid size={size} theme="two-tone" fill={fill} style={style} />
  if (source === 'want') return <CheckOne size={size} theme="two-tone" fill={fill} style={style} />
  return null
}

/** Attach momentum-based drag-to-scroll to an element */
function useMomentumScroll(ignoreSelectors: string[] = []) {
  return (e: React.MouseEvent<HTMLDivElement>) => {
    if (ignoreSelectors.some((s) => (e.target as HTMLElement).closest(s))) return
    const el = e.currentTarget
    const startX = e.pageX
    const scrollLeft = el.scrollLeft
    let moved = false
    let velocity = 0
    let lastX = startX
    let lastTime = Date.now()
    const onMove = (ev: MouseEvent) => {
      const dx = ev.pageX - startX
      if (Math.abs(dx) > 3) moved = true
      const now = Date.now()
      const dt = now - lastTime
      if (dt > 0) velocity = (ev.pageX - lastX) / dt
      lastX = ev.pageX
      lastTime = now
      el.scrollLeft = scrollLeft - dx
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!moved) return
      let v = velocity * 15
      const decay = () => {
        if (Math.abs(v) < 0.5) return
        el.scrollLeft -= v
        v *= 0.92
        requestAnimationFrame(decay)
      }
      requestAnimationFrame(decay)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

export function MapMods(): JSX.Element {
  const [generator, _setGenerator] = useState<'maps' | 'custom'>(() =>
    loadStorage('scalpel:regex:generator', 'maps' as 'maps' | 'custom', (s) => (s === 'custom' ? 'custom' : 'maps')),
  )
  const savedTagsByGenerator = useRef<Record<string, (RegexPresetTag & { id: number })[]>>({})
  const setGenerator = (g: 'maps' | 'custom') => {
    // Stash current tags, restore target's tags
    savedTagsByGenerator.current[generator] = presetTags
    setPresetTags(savedTagsByGenerator.current[g] ?? [])
    setCustomTagInput('')
    setShowTradeResults(false)
    setShowTierPicker(false)
    localStorage.setItem('scalpel:regex:generator', g)
    _setGenerator(g)
  }
  const [tab, setTab] = useState<Tab>('qualifiers')
  const [avoid, setAvoid] = useState<Set<number>>(() => loadSet('scalpel:regex:map-avoid'))
  const [want, setWant] = useState<Set<number>>(() => loadSet('scalpel:regex:map-want'))
  const [wantMode, setWantMode] = useState<WantMode>(() =>
    loadStorage('scalpel:regex:map-want-mode', 'any' as WantMode, (s) => s as WantMode),
  )
  const [qualifiers, setQualifiers] = useState<QualifierValues>(() => loadStorage('scalpel:regex:qualifiers', {}))
  const [optimizeNumbers, setOptimizeNumbers] = useState(() =>
    loadStorage('scalpel:regex:optimize', true, (s) => s !== 'false'),
  )
  const [showNightmare, setShowNightmare] = useState(() =>
    loadStorage('scalpel:regex:nightmare', false, (s) => s === 'true'),
  )
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presetTags, setPresetTags] = useState<(RegexPresetTag & { id: number })[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [customRegexInput, setCustomRegexInput] = useState(() => loadStorage('scalpel:regex:custom', '', (s) => s))
  useEffect(() => {
    localStorage.setItem('scalpel:regex:custom', customRegexInput)
  }, [customRegexInput])
  const [showTierPicker, setShowTierPicker] = useState(false)
  const [showAllTiers, setShowAllTiers] = useState(false)
  const [tradeSearching, setTradeSearching] = useState(false)
  const [tradeListings, setTradeListings] = useState<Listing[]>([])
  const [tradeTotal, setTradeTotal] = useState<number | null>(null)
  const [tradeQueryId, setTradeQueryId] = useState<string | null>(null)
  const [tradeLeague, setTradeLeague] = useState<string>('')
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [tradeRemainingIds, setTradeRemainingIds] = useState<string[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedListing, setExpandedListing] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<Record<string, 'pending' | 'success' | 'failed'>>({})
  const [loggedIn, setLoggedIn] = useState(false)
  const [showTradeResults, setShowTradeResults] = useState(false)
  const [rateLimitTiers, setRateLimitTiers] = useState<
    Array<{ used: number; max: number; window: number; penalty: number }>
  >([])
  const priceChipMinWidth = useMemo(() => {
    const maxDigits = tradeListings.reduce((max, l) => Math.max(max, l.price ? String(l.price.amount).length : 0), 0)
    return 38 + maxDigits * 9
  }, [tradeListings])

  useEffect(() => {
    window.api.poeCheckAuth().then((r) => setLoggedIn(r.loggedIn))
    const unsub = window.api.onRateLimit((state) => setRateLimitTiers(state.tiers))
    return unsub
  }, [])

  const [tradeOriginator, setTradeOriginator] = useState(false)
  const [tradeCorrupted8mod, setTradeCorrupted8mod] = useState(false)

  const searchMapTrade = async (tier: number, nightmare: boolean) => {
    setTradeSearching(true)
    setTradeError(null)
    setExpandedListing(null)
    setActionStatus({})
    try {
      const avoidTexts = MAP_MODS.filter((m) => avoid.has(m.id)).map((m) => m.text)
      const wantTexts = MAP_MODS.filter((m) => want.has(m.id)).map((m) => m.text)
      const qualObj: Record<string, number> = {}
      for (const [k, v] of Object.entries(qualifiers)) {
        if (v != null && v > 0) qualObj[k] = v
      }
      const result = (await window.api.mapRegexTrade({
        tier,
        avoidTexts,
        wantTexts,
        wantMode,
        qualifiers: qualObj,
        nightmare,
        originator: tradeOriginator,
        corrupted8mod: tradeCorrupted8mod,
      })) as { total: number; listings: Listing[]; queryId: string; league: string; remainingIds: string[] }
      setTradeListings(result.listings)
      setTradeTotal(result.total)
      setTradeQueryId(result.queryId)
      setTradeLeague(result.league)
      setTradeRemainingIds(result.remainingIds)
      setShowTradeResults(true)
    } catch (e) {
      console.error('[regex] Trade search failed:', e)
      setTradeError(e instanceof Error ? e.message : 'Search failed')
      setShowTradeResults(true)
    } finally {
      setTradeSearching(false)
      setShowTierPicker(false)
    }
  }

  const tradeLoadMore = async (): Promise<void> => {
    if (!tradeQueryId || tradeRemainingIds.length === 0 || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await window.api.fetchMoreListings(tradeQueryId, tradeRemainingIds)
      setTradeListings((prev) => [...prev, ...result.listings])
      setTradeRemainingIds(result.remainingIds)
    } catch {
      // silently fail
    }
    setLoadingMore(false)
  }

  const [presets, setPresets] = useState<RegexPreset[]>([])
  const [copied, setCopied] = useState(false)
  const [avoidCollapsed, setAvoidCollapsed] = useState<Set<string>>(
    new Set(['dangerous', 'annoying', 'mild', 'harmless', 'beneficial']),
  )
  const [wantCollapsed, setWantCollapsed] = useState<Set<string>>(
    new Set(['nightmare', 'lethal', 'dangerous', 'annoying', 'mild', 'harmless']),
  )
  const [qualCollapsed, setQualCollapsed] = useState<Set<string>>(
    () => new Set(QUALIFIER_GROUPS.filter((g) => !g.defaultOpen).map((g) => g.label)),
  )

  useEffect(() => {
    localStorage.setItem('scalpel:regex:map-avoid', JSON.stringify([...avoid]))
  }, [avoid])
  useEffect(() => {
    localStorage.setItem('scalpel:regex:map-want', JSON.stringify([...want]))
  }, [want])
  useEffect(() => {
    localStorage.setItem('scalpel:regex:map-want-mode', wantMode)
  }, [wantMode])
  useEffect(() => {
    localStorage.setItem('scalpel:regex:qualifiers', JSON.stringify(qualifiers))
  }, [qualifiers])
  useEffect(() => {
    localStorage.setItem('scalpel:regex:nightmare', String(showNightmare))
  }, [showNightmare])
  useEffect(() => {
    localStorage.setItem('scalpel:regex:optimize', String(optimizeNumbers))
  }, [optimizeNumbers])
  useEffect(() => {
    window.api.getRegexPresets().then((loaded) => {
      // Migrate old presets that used 'name' instead of 'tags'
      setPresets(
        loaded.map((p) =>
          p.tags
            ? p
            : { ...p, tags: [{ text: (p as unknown as { name: string }).name || 'preset', color: CUSTOM_TAG_COLOR }] },
        ),
      )
    })
  }, [])

  const selected = tab === 'avoid' ? avoid : want
  const setSelected = tab === 'avoid' ? setAvoid : setWant

  const visibleMods = MAP_MODS.filter((m) => {
    if (!showNightmare && m.nightmare) return false
    if (search && !m.text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const dangerOrder = tab === 'want' ? [...DANGER_ORDER].reverse() : DANGER_ORDER
  const WANT_PRIORITY = new Set([583869527, -683043845, -1647756153]) // magic monsters, rare monsters, rare+modifier

  // Split nightmare mods into their own group when the chip is on.
  // Regrouped nightmare mods go with regular mods but still show NM badge and respect the toggle.
  const nonNightmareMods = visibleMods.filter((m) => !m.nightmare || NIGHTMARE_REGROUPED.has(m.id))
  const nightmareMods = showNightmare ? visibleMods.filter((m) => m.nightmare && !NIGHTMARE_REGROUPED.has(m.id)) : []

  const regularGroups = dangerOrder
    .map((danger) => {
      const mods = nonNightmareMods.filter((m) => m.danger === danger)
      if (tab === 'want') mods.sort((a, b) => (WANT_PRIORITY.has(b.id) ? 1 : 0) - (WANT_PRIORITY.has(a.id) ? 1 : 0))
      return { danger, mods, label: DANGER_LABELS[danger], color: DANGER_COLORS[danger], key: danger }
    })
    .filter((g) => g.mods.length > 0)

  const nightmareGroup =
    nightmareMods.length > 0
      ? [
          {
            danger: 'lethal' as Danger,
            mods: nightmareMods,
            label: 'Nightmare',
            color: TAB_COLORS.nightmare,
            key: 'nightmare',
          },
        ]
      : []

  const grouped = tab === 'want' ? [...regularGroups, ...nightmareGroup] : [...nightmareGroup, ...regularGroups]

  const avoidMods = MAP_MODS.filter((m) => avoid.has(m.id))
  const wantMods = MAP_MODS.filter((m) => want.has(m.id))
  const qualifierRegex = buildQualifierRegex(qualifiers)
  const modRegex = buildMapRegex(avoidMods, wantMods, wantMode)
  const mapRegex = [qualifierRegex, modRegex].filter(Boolean).join(' ')
  const regex = generator === 'custom' ? customRegexInput : mapRegex
  const isOverLimit = regex.length > POE_REGEX_MAX_LENGTH
  const qualifierCount = QUALIFIERS.filter((q) => qualifiers[q.id] != null && qualifiers[q.id]! > 0).length
  const hasMoreQualifier = ['morecurrency', 'morescarabs', 'moremaps'].some(
    (k) => qualifiers[k] != null && qualifiers[k]! > 0,
  )
  const tierIcons = hasMoreQualifier || tradeOriginator ? ORIGINATOR_TIER_ICONS : MAP_TIER_ICONS
  const hasNightmareMod = MAP_MODS.some((m) => m.nightmare && want.has(m.id))

  useEffect(() => {
    window.api.reportRegex(regex)
  }, [regex])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const collapsed = tab === 'avoid' ? avoidCollapsed : wantCollapsed
  const setCollapsedForTab = tab === 'avoid' ? setAvoidCollapsed : setWantCollapsed
  const toggleCollapse = (key: string) => {
    setCollapsedForTab((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const copyRegex = () => {
    if (!regex) return
    navigator.clipboard.writeText(regex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Auto-tag generation per generator. Generators without a function here (e.g. custom) have no auto-tags.
  const getAutoTags = (): RegexPresetTag[] | null => {
    if (generator === 'maps') return generatePresetTags({ avoid, want, qualifiers })
    return null
  }

  // Seed tags when presets panel first opens
  useEffect(() => {
    if (presetsOpen && presetTags.length === 0) {
      const auto = getAutoTags()
      if (auto) {
        setPresetTags(auto.map((t, i) => ({ ...t, id: i })))
        setCustomTagInput('')
      }
    }
  }, [presetsOpen])

  // Keep auto-generated tags in sync with live state while panel is open.
  // Custom tags and tag order are preserved.
  useEffect(() => {
    const fresh = getAutoTags()
    if (!presetsOpen || !fresh) return
    setPresetTags((prev) => {
      // Build a set of fresh sourceIds
      const freshBySourceId = new Map<string | number, (typeof fresh)[0]>()
      fresh.forEach((t) => {
        if (t.sourceId != null) freshBySourceId.set(t.sourceId, t)
      })

      // Update existing, remove stale
      const updated = prev
        .filter((t) => {
          if (t.source === 'custom' || t.sourceId == null) return true
          return freshBySourceId.has(t.sourceId)
        })
        .map((t) => {
          if (t.source === 'custom' || t.sourceId == null) return t
          const freshTag = freshBySourceId.get(t.sourceId)
          if (freshTag && freshTag.text !== t.text) {
            return { ...t, text: freshTag.text, color: freshTag.color }
          }
          return t
        })

      // Add new tags at the end
      let nextId = Math.max(0, ...prev.map((t) => t.id)) + 1
      const existingSourceIds = new Set(updated.filter((t) => t.sourceId != null).map((t) => t.sourceId))
      for (const ft of fresh) {
        if (ft.sourceId != null && !existingSourceIds.has(ft.sourceId)) {
          updated.push({ ...ft, id: nextId++ })
        }
      }

      return updated
    })
  }, [presetsOpen, avoid, want, qualifiers])

  const removePresetTag = (index: number) => {
    setPresetTags((prev) => prev.filter((_, i) => i !== index))
  }

  const addCustomTag = () => {
    const text = customTagInput.trim()
    if (!text) return
    setPresetTags((prev) => [...prev, { text, color: CUSTOM_TAG_COLOR, id: Date.now() }])
    setCustomTagInput('')
  }

  const savePreset = async () => {
    if (presetTags.length === 0) return
    // Detect dupes by sorted tag text (order-independent)
    const tagKey = [...presetTags.map((t) => t.text)].sort().join('|')
    const existingDupe = presets.find(
      (p) => (p.generator ?? 'maps') === generator && [...p.tags.map((t) => t.text)].sort().join('|') === tagKey,
    )
    if (existingDupe) {
      // Same tags, different order -- update the existing preset with new order
      const updated = await window.api.deleteRegexPreset(existingDupe.id)
      setPresets(updated)
    }
    const preset: RegexPreset = {
      id: crypto.randomUUID(),
      generator,
      tags: presetTags,
      avoid: [...avoid],
      want: [...want],
      wantMode,
      qualifiers: Object.fromEntries(Object.entries(qualifiers).filter(([, v]) => v != null)) as Record<string, number>,
      nightmare: showNightmare,
      ...(generator === 'custom' ? { customRegex: customRegexInput } : {}),
    }
    const updated = await window.api.saveRegexPreset(preset)
    setPresets(updated)
    setPresetTags([])
    setCustomTagInput('')
  }

  const loadPreset = (preset: RegexPreset) => {
    // Use the saved tags in their saved order
    setPresetTags((preset.tags || []).map((t, i) => ({ ...t, id: Date.now() + i })))
    if ((preset.generator ?? 'maps') === 'custom') {
      setCustomRegexInput(preset.customRegex ?? '')
    } else {
      setAvoid(new Set(preset.avoid))
      setWant(new Set(preset.want))
      setWantMode(preset.wantMode)
      setQualifiers(preset.qualifiers)
      setShowNightmare(preset.nightmare)
    }
  }

  const deletePreset = async (id: string) => {
    const updated = await window.api.deleteRegexPreset(id)
    setPresets(updated)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Regex output */}
      <div className="px-3 py-2 bg-bg-card border-b border-border">
        <div className="setting-box">
          <span className="value select-all" style={{ color: isOverLimit ? '#ef5350' : undefined }}>
            {regex || <span className="dim">Select mods to generate regex</span>}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              copyRegex()
            }}
            disabled={!regex}
            className="primary disabled:opacity-30 disabled:cursor-default"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="grid grid-cols-3 items-center mt-1">
          <div className="flex justify-start">
            <InfoChip size="sm">
              <span className="text-text-dim">
                {(() => {
                  const count = generator === 'custom' ? (customRegexInput ? 1 : 0) : avoidMods.length + wantMods.length
                  return `${count} mod${count !== 1 ? 's' : ''}`
                })()}
              </span>
            </InfoChip>
          </div>
          <div className="flex justify-center">
            <InfoChip size="sm">
              <a
                href="https://poe.re"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault()
                  window.api.openExternal('https://poe.re')
                }}
                className="flex items-center gap-1 no-underline"
              >
                <img
                  src={poereIconTight}
                  alt=""
                  className="w-[14px] h-[14px]"
                  style={{ marginTop: 1, marginLeft: -2 }}
                />
                <span className="text-text-dim">Powered by poe.re</span>
              </a>
            </InfoChip>
          </div>
          <div className="flex justify-end">
            <InfoChip size="sm" color={isOverLimit ? '#ef5350' : undefined} className="!pr-[3px]">
              <span className="flex items-center gap-1.5">
                {regex.length} / {POE_REGEX_MAX_LENGTH}
                <button
                  onClick={() => {
                    if (generator === 'custom') {
                      setCustomRegexInput('')
                    } else {
                      setAvoid(new Set())
                      setWant(new Set())
                      setQualifiers({})
                    }
                  }}
                  disabled={
                    generator === 'custom'
                      ? !customRegexInput
                      : avoid.size === 0 && want.size === 0 && qualifierCount === 0
                  }
                  className="text-[9px] font-semibold text-accent border-none rounded-full cursor-pointer px-2 py-[2px] bg-white/[0.08] disabled:opacity-30 disabled:cursor-default"
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  }}
                >
                  Clear
                </button>
              </span>
            </InfoChip>
          </div>
        </div>
      </div>

      {/* Generator tabs */}
      <div className="flex border-b border-border bg-bg-card">
        {(['maps', 'custom'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGenerator(g)}
            className="flex-1 text-[11px] py-[6px] border-none cursor-pointer font-semibold rounded-none"
            style={{
              background: generator === g ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: generator === g ? '#171821' : 'var(--text-dim)',
            }}
            onMouseEnter={(e) => {
              if (generator !== g) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={(e) => {
              if (generator !== g) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
          >
            {g === 'maps' ? 'Maps' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Chips + search/presets */}
      <div className="flex flex-col px-3 py-2 border-b border-border bg-bg-card">
        <div className="flex items-center gap-[6px]">
          {generator !== 'custom' && (
            <FilterChip
              label={
                <>
                  <Search size={12} theme="outline" fill="currentColor" /> Search
                </>
              }
              active={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v)
                if (searchOpen) setSearch('')
                if (!searchOpen) {
                  setPresetsOpen(false)
                  setShowTierPicker(false)
                  setShowTradeResults(false)
                }
              }}
            />
          )}
          <FilterChip
            label={
              <>
                <Save size={12} theme="outline" fill="currentColor" /> Save / Load
              </>
            }
            active={presetsOpen}
            onClick={() => {
              setPresetsOpen((v) => !v)
              if (!presetsOpen) {
                setSearchOpen(false)
                setSearch('')
                setShowTierPicker(false)
                setShowTradeResults(false)
              }
            }}
          />
          {generator === 'maps' && (
            <FilterChip
              label={
                <>
                  <Buy size={12} theme="outline" fill="currentColor" /> {tradeSearching ? 'Searching...' : 'Trade'}
                </>
              }
              active={showTierPicker || showTradeResults}
              onClick={() => {
                if (showTradeResults) {
                  // Viewing results, turn off trade and go back to regex UI
                  setShowTradeResults(false)
                  setShowTierPicker(false)
                } else if (tradeQueryId && !showTierPicker) {
                  // Cached results exist, show them
                  setShowTradeResults(true)
                  setShowTierPicker(false)
                  setSearchOpen(false)
                  setSearch('')
                  setPresetsOpen(false)
                } else {
                  setShowTierPicker((v) => !v)
                  if (!showTierPicker) {
                    setSearchOpen(false)
                    setSearch('')
                    setPresetsOpen(false)
                  }
                }
              }}
            />
          )}
        </div>
        <div
          className="overflow-hidden transition-all duration-150"
          style={{ maxHeight: searchOpen ? 40 : 0, marginTop: searchOpen ? 8 : 0, opacity: searchOpen ? 1 : 0 }}
        >
          <div className="relative">
            <input
              type="text"
              placeholder="Search mods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[11px] bg-black/30 rounded px-2 py-[5px] border-none pr-6"
            />
            {search && (
              <div
                onClick={() => setSearch('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer text-text-dim hover:text-text"
              >
                <CloseSmall size={14} theme="outline" fill="currentColor" />
              </div>
            )}
          </div>
        </div>
        <div
          className="overflow-hidden transition-all duration-150"
          style={{
            maxHeight: presetsOpen ? 300 : 0,
            marginTop: presetsOpen ? 8 : 0,
            opacity: presetsOpen ? 1 : 0,
          }}
        >
          <div className="flex flex-col gap-2">
            {/* Save area -- setting-box style with tag chips and input inside */}
            <div className="setting-box" style={{ flexWrap: 'wrap', gap: 4, padding: '6px 8px' }}>
              <ReactSortable
                list={presetTags}
                setList={setPresetTags}
                animation={150}
                className="flex flex-wrap gap-1 flex-1 items-center min-w-0"
                ghostClass="opacity-30"
                filter=".no-drag"
                preventOnFilter={false}
                onStart={() => document.body.classList.add('dragging')}
                onEnd={() => document.body.classList.remove('dragging')}
              >
                {presetTags.map((tag, i) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-[5px] px-[6px] py-[2px] rounded text-[10px] font-semibold shrink-0 cursor-grab"
                    style={{ ...tagChipStyle(tag), paddingTop: 1, paddingBottom: 3 }}
                  >
                    <TagSourceIcon source={tag.source} size={12} />
                    {tag.text}
                    <CloseSmall
                      size={13}
                      theme="outline"
                      fill="currentColor"
                      className="cursor-pointer opacity-60 hover:opacity-100 -mr-[2px] ml-[1px]"
                      onClick={() => removePresetTag(i)}
                    />
                  </span>
                ))}
                <input
                  key="input"
                  type="text"
                  placeholder={presetTags.length === 0 ? 'Add tags to remember what this regex does' : 'Add more tags'}
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || (e.key === ' ' && customTagInput.trim())) {
                      e.preventDefault()
                      addCustomTag()
                    }
                    if (e.key === 'Backspace' && !customTagInput && presetTags.length > 0) {
                      removePresetTag(presetTags.length - 1)
                    }
                  }}
                  className="no-drag flex-1 min-w-[60px] text-[11px] bg-transparent border-none outline-none text-text"
                  style={{ padding: '2px 0', marginLeft: presetTags.length > 0 ? 4 : 0 }}
                />
              </ReactSortable>
              <button
                onClick={savePreset}
                disabled={presetTags.length === 0}
                className="primary disabled:opacity-30 disabled:cursor-default shrink-0"
              >
                Save
              </button>
            </div>
          </div>
          {/* close flex-col gap-2 */}
        </div>
        {/* close overflow-hidden */}
        {/* Tier picker slide-down */}
        <div
          className="overflow-hidden transition-all duration-150"
          style={{
            maxHeight: showTierPicker || showTradeResults ? 150 : 0,
            opacity: showTierPicker || showTradeResults ? 1 : 0,
            margin: showTierPicker || showTradeResults ? '8px -12px 0' : '0',
            padding: showTierPicker || showTradeResults ? '0 12px' : '0',
            borderTop: '1px solid var(--border)',
            paddingTop: showTierPicker || showTradeResults ? 8 : 0,
          }}
        >
          {/* Map type chips */}
          <div className="flex gap-[4px] mb-[4px]">
            <FilterChip
              label="Originator"
              active={tradeOriginator}
              onClick={() => setTradeOriginator((v) => !v)}
              color="#dddddd"
            />
            <FilterChip
              label="8-mod Corrupted"
              active={tradeCorrupted8mod}
              onClick={() => setTradeCorrupted8mod((v) => !v)}
              color="#ef5350"
            />
          </div>
          {hasNightmareMod ? (
            <div className="flex gap-[4px] items-center">
              {[14, 15, 16].map((t) => (
                <TierButton
                  key={t}
                  icon={ORIGINATOR_TIER_ICONS[t]}
                  size={38}
                  title={`Originator Tier ${t}`}
                  disabled={tradeSearching || !regex}
                  onClick={() => searchMapTrade(t, false)}
                />
              ))}
              <TierButton
                icon={MAP_TIER_ICONS.nightmare}
                size={38}
                title="Nightmare"
                disabled={tradeSearching || !regex}
                onClick={() => searchMapTrade(16, true)}
              />
            </div>
          ) : (
            <>
              {/* T1-T13 expandable */}
              <div
                className="overflow-hidden transition-all duration-150"
                style={{ maxHeight: showAllTiers ? 50 : 0, marginBottom: showAllTiers ? 4 : 0 }}
              >
                <div className="flex gap-[3px] flex-wrap">
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((t) => (
                    <TierButton
                      key={t}
                      icon={tierIcons[t]}
                      size={26}
                      title={`Tier ${t}`}
                      disabled={tradeSearching || !regex}
                      onClick={() => searchMapTrade(t, false)}
                    />
                  ))}
                </div>
              </div>
              {/* All tiers toggle + T14-T16 + Nightmare */}
              <div className="flex gap-[4px] items-center">
                <button
                  onClick={() => setShowAllTiers((v) => !v)}
                  className="flex items-center justify-center border-none cursor-pointer"
                  style={{
                    background: showAllTiers ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 3,
                    padding: '3px 3px 2px',
                    width: 44,
                    height: 44,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = showAllTiers
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.05)'
                  }}
                  title="Show all tiers"
                >
                  <span className="text-[9px] font-semibold text-text-dim leading-tight text-center">
                    All
                    <br />
                    tiers
                  </span>
                </button>
                {[14, 15, 16].map((t) => (
                  <TierButton
                    key={t}
                    icon={tierIcons[t]}
                    size={38}
                    title={`Tier ${t}`}
                    disabled={tradeSearching || !regex}
                    onClick={() => searchMapTrade(t, false)}
                  />
                ))}
                <TierButton
                  icon={MAP_TIER_ICONS.nightmare}
                  size={38}
                  title="Nightmare"
                  disabled={tradeSearching || !regex}
                  onClick={() => searchMapTrade(16, true)}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {/* close px-3 chips section */}
      {/* Saved presets -- horizontal scrolling cards (outside px-3 and overflow-hidden) */}
      {(() => {
        const filtered = presets.filter((p) => (p.generator ?? 'maps') === generator)
        return (
          filtered.length > 0 &&
          presetsOpen && (
            <div className="border-b border-border bg-bg-card py-2">
              <span className="text-[9px] text-text-dim font-semibold uppercase tracking-wider ml-3 mb-1 block">
                Saved Regex
              </span>
              <div
                className="flex overflow-x-auto pb-1 preset-slider"
                style={{ paddingLeft: 12 }}
                onMouseDown={useMomentumScroll(['.preset-grab', '.preset-delete'])}
              >
                <ReactSortable
                  list={filtered}
                  setList={(newList) => {
                    // Merge reordered filtered presets back with the rest
                    const otherPresets = presets.filter((p) => (p.generator ?? 'maps') !== generator)
                    const merged = [...otherPresets, ...newList]
                    setPresets(merged)
                    window.api.reorderRegexPresets(merged.map((p) => p.id))
                  }}
                  animation={150}
                  handle=".preset-grab"
                  filter=".preset-delete"
                  preventOnFilter={false}
                  className="flex gap-2"
                >
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      className="flex shrink-0 rounded bg-black/20 hover:bg-black/30 transition-colors cursor-pointer relative group"
                      style={{ width: 160, minHeight: 60 }}
                      onClick={() => loadPreset(p)}
                    >
                      {/* Left strip: X delete + grab handle */}
                      <div className="flex flex-col items-center py-1.5 px-[3px] opacity-0 group-hover:opacity-100 transition-opacity preset-controls">
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePreset(p.id)
                          }}
                          className="preset-delete cursor-pointer text-text-dim hover:text-[#ef5350] transition-colors"
                        >
                          <CloseSmall size={11} theme="outline" fill="currentColor" />
                        </div>
                        <div
                          className="preset-grab cursor-grab text-text-dim hover:text-text transition-colors flex-1 flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Drag size={10} theme="outline" fill="currentColor" />
                        </div>
                      </div>
                      <div className="flex-1 p-2 pl-0 min-w-0">
                        <div
                          className="flex flex-wrap gap-[3px]"
                          style={{ maxHeight: 68, overflow: 'hidden' }}
                          ref={(el) => {
                            if (el) {
                              el.style.webkitMaskImage =
                                el.scrollHeight > el.clientHeight
                                  ? 'linear-gradient(to bottom, black 75%, transparent 100%)'
                                  : 'none'
                            }
                          }}
                        >
                          {p.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-[3px] px-[5px] py-[1px] text-[9px] font-semibold shrink-0"
                              style={tagChipStyle(tag)}
                            >
                              <TagSourceIcon source={tag.source} size={8} />
                              {tag.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </ReactSortable>
                <div style={{ minWidth: 12, flexShrink: 0 }} />
              </div>
            </div>
          )
        )
      })()}

      {/* Maps generator */}
      {generator === 'maps' && (
        <>
          {/* Qualifiers / Avoid / Want tabs */}
          <div
            className="flex gap-1 px-2 pt-1 pb-0 bg-bg-card"
            style={{ display: showTradeResults ? 'none' : undefined }}
          >
            {(['qualifiers', 'avoid', 'want'] as const).map((t) => {
              const isActive = tab === t && !showTradeResults
              const color = TAB_COLORS[t]
              const count = t === 'avoid' ? avoid.size : t === 'want' ? want.size : qualifierCount
              return (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t)
                    setShowTradeResults(false)
                  }}
                  className={`flex-1 flex items-center justify-between px-3 text-[11px] py-[5px] border-none cursor-pointer transition-colors relative ${isActive ? 'regex-tab-active' : ''}`}
                  style={{
                    background: isActive ? 'var(--bg-solid)' : 'transparent',
                    color: isActive ? color : 'var(--text-dim)',
                    fontWeight: 600,
                    borderRadius: isActive ? '6px 6px 0 0' : '6px',
                    padding: isActive ? '5px 12px' : '1px 11px',
                    ...(isActive ? {} : { margin: '4px 1px' }),
                    minHeight: isActive ? 30 : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="flex items-center gap-[6px]">
                    {t === 'qualifiers' && (
                      <AddOne size={18} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} />
                    )}
                    {t === 'avoid' && (
                      <Forbid size={18} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} />
                    )}
                    {t === 'want' && (
                      <CheckOne size={18} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} />
                    )}
                    {t === 'qualifiers' ? 'Qualifiers' : t === 'avoid' ? 'Avoid' : 'Want'}
                  </span>
                  {count > 0 && (
                    <span style={{ transform: 'translateY(1px)' }}>
                      <InfoChip color={color}>
                        <span className="font-bold">{count}</span>
                      </InfoChip>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Trade results */}
          {showTradeResults && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-bg">
              <div className="flex items-center gap-2 px-[14px] py-[6px]">
                <span className="text-[11px] text-text-dim flex-1">
                  {tradeTotal != null ? `${tradeTotal} result${tradeTotal !== 1 ? 's' : ''}` : ''}
                </span>
                {tradeQueryId && (
                  <button
                    onClick={() =>
                      window.api.openExternal(
                        `https://www.pathofexile.com/trade/search/${encodeURIComponent(tradeLeague)}/${tradeQueryId}`,
                      )
                    }
                    className="text-[10px] px-2 py-[3px] border-none cursor-pointer font-semibold bg-white/[0.08] text-text-dim rounded-[3px]"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    }}
                  >
                    Open in Trade
                  </button>
                )}
              </div>
              {tradeError && <div className="text-[10px] text-[#ef5350] px-3 py-2">{tradeError}</div>}
              {!tradeError && tradeListings.length === 0 && (
                <div className="text-[11px] text-text-dim text-center p-4">No listings found</div>
              )}
              {tradeListings.length > 0 && (
                <div className="flex-1 overflow-y-auto px-[14px]">
                  <TradeListings
                    listings={tradeListings}
                    total={tradeTotal}
                    itemClass="Maps"
                    itemName=""
                    itemRarity="Normal"
                    expandedListing={expandedListing}
                    setExpandedListing={setExpandedListing}
                    priceChipMinWidth={priceChipMinWidth}
                    loggedIn={loggedIn}
                    actionStatus={actionStatus}
                    setActionStatus={setActionStatus}
                    queryId={tradeQueryId}
                    league={tradeLeague}
                    onLoadMore={tradeRemainingIds.length > 0 ? tradeLoadMore : undefined}
                    loadingMore={loadingMore}
                  />
                </div>
              )}
              <RateLimitBar rateLimitTiers={rateLimitTiers} />
            </div>
          )}

          {/* Qualifier optimization toggle */}
          {!showTradeResults && tab === 'qualifiers' && (
            <div
              className="flex items-center gap-[6px] px-3 py-[6px] border-b border-border"
              style={{ background: 'var(--bg-solid)' }}
            >
              <FilterChip
                label="Regular"
                active={!optimizeNumbers}
                onClick={() => setOptimizeNumbers(false)}
                color={TAB_COLORS.qualifiers}
              />
              <FilterChip
                label="Optimized"
                active={optimizeNumbers}
                onClick={() => {
                  setOptimizeNumbers(true)
                  // Snap current values to 10s
                  setQualifiers((prev) => {
                    const snapped: QualifierValues = {}
                    for (const [k, v] of Object.entries(prev)) {
                      snapped[k] = v != null && v > 0 ? Math.floor(v / 10) * 10 || v : v
                    }
                    return snapped
                  })
                }}
                color={TAB_COLORS.qualifiers}
              />
            </div>
          )}

          {/* Avoid sub-header */}
          {!showTradeResults && tab === 'avoid' && (
            <div
              className="flex items-center justify-center gap-[6px] px-3 py-[6px] border-b border-border"
              style={{ background: 'var(--bg-solid)' }}
            >
              <FilterChip
                label="Show Nightmare mods"
                active={showNightmare}
                onClick={() => setShowNightmare((v) => !v)}
                color={TAB_COLORS.avoid}
              />
            </div>
          )}

          {/* Want sub-header */}
          {!showTradeResults && tab === 'want' && (
            <div
              className="flex items-center gap-[6px] px-3 py-[6px] border-b border-border"
              style={{ background: 'var(--bg-solid)' }}
            >
              <div className="flex-1" />
              <FilterChip
                label="Show Nightmare mods"
                active={showNightmare}
                onClick={() => setShowNightmare((v) => !v)}
                color={TAB_COLORS.avoid}
              />
              <div className="flex-1 flex justify-end gap-[6px]">
                <FilterChip
                  label="Any"
                  active={wantMode === 'any'}
                  onClick={() => setWantMode('any')}
                  color={TAB_COLORS.want}
                />
                <FilterChip
                  label="All"
                  active={wantMode === 'all'}
                  onClick={() => setWantMode('all')}
                  color={TAB_COLORS.want}
                />
              </div>
            </div>
          )}

          {/* Qualifiers list */}
          {!showTradeResults && tab === 'qualifiers' && (
            <div className="flex-1 overflow-y-auto bg-bg-card">
              {QUALIFIER_GROUPS.map((group) => {
                const filteredQuals = search
                  ? group.qualifiers.filter((q) => q.label.toLowerCase().includes(search.toLowerCase()))
                  : group.qualifiers
                if (filteredQuals.length === 0) return null
                const isGroupCollapsed = qualCollapsed.has(group.label)
                const activeInGroup = group.qualifiers.filter(
                  (q) => qualifiers[q.id] != null && qualifiers[q.id]! > 0,
                ).length
                return (
                  <div key={group.label}>
                    <div
                      className="flex items-center gap-2 px-3 py-[8px] sticky-group-header cursor-pointer select-none sticky top-0 z-[1]"
                      style={{ height: 39, boxSizing: 'border-box' }}
                      onClick={() =>
                        setQualCollapsed((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.label)) next.delete(group.label)
                          else next.add(group.label)
                          return next
                        })
                      }
                    >
                      {group.icon === 'setting-config' && (
                        <SettingConfig
                          size={14}
                          theme="two-tone"
                          fill={['var(--text)', 'rgba(255,255,255,0.2)']}
                          style={{ marginTop: 1, marginLeft: -2 }}
                        />
                      )}
                      {group.icon === 'compass' && (
                        <Compass
                          size={14}
                          theme="two-tone"
                          fill={['var(--text)', 'rgba(255,255,255,0.2)']}
                          style={{ marginTop: 1, marginLeft: -2 }}
                        />
                      )}
                      <span className="text-[10px] uppercase tracking-wider font-bold flex-1 text-text">
                        {group.label}
                      </span>
                      {activeInGroup > 0 && (
                        <InfoChip color={TAB_COLORS.qualifiers}>
                          <span className="font-bold">{activeInGroup}</span>
                        </InfoChip>
                      )}
                      {isGroupCollapsed ? (
                        <Right
                          size={12}
                          theme="two-tone"
                          fill={['currentColor', 'currentColor']}
                          className="text-text-dim"
                        />
                      ) : (
                        <Down
                          size={12}
                          theme="two-tone"
                          fill={['currentColor', 'currentColor']}
                          className="text-text-dim"
                        />
                      )}
                    </div>
                    {!isGroupCollapsed &&
                      filteredQuals.map((q, qi) => (
                        <div
                          key={q.id}
                          className="flex items-center gap-2 px-3 py-[6px]"
                          style={{
                            background:
                              qualifiers[q.id] != null && qualifiers[q.id]! > 0
                                ? 'rgba(129,199,132,0.08)'
                                : qi % 2 === 0
                                  ? 'rgba(255,255,255,0.02)'
                                  : 'transparent',
                          }}
                        >
                          <span
                            className="text-[11px] flex-1"
                            style={{
                              color:
                                qualifiers[q.id] != null && qualifiers[q.id]! > 0 ? 'var(--text)' : 'var(--text-dim)',
                            }}
                          >
                            {q.label}
                          </span>
                          <ScrubInput
                            value={qualifiers[q.id] ?? null}
                            placeholder="--"
                            step={optimizeNumbers ? 10 : 1}
                            onChange={(val) => {
                              const snapped =
                                optimizeNumbers && val != null && val > 0 ? Math.floor(val / 10) * 10 || val : val
                              setQualifiers((prev) => ({ ...prev, [q.id]: snapped }))
                            }}
                          />
                        </div>
                      ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Mod list (avoid/want) */}
          {!showTradeResults && (tab === 'avoid' || tab === 'want') && (
            <div className="flex-1 overflow-y-auto bg-bg-card">
              {grouped.map(({ mods, label, color, key }) => {
                const isCollapsed = collapsed.has(key)
                const selectedInGroup = mods.filter((m) => selected.has(m.id)).length
                return (
                  <div key={key}>
                    <div
                      className="flex items-center gap-2 px-3 py-[8px] sticky-group-header cursor-pointer select-none sticky top-0 z-[1]"
                      style={{ height: 39, boxSizing: 'border-box' }}
                      onClick={() => toggleCollapse(key)}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[10px] uppercase tracking-wider font-bold flex-1" style={{ color }}>
                        {label}
                      </span>
                      {selectedInGroup > 0 && (
                        <InfoChip color={color}>
                          <span className="font-bold">{selectedInGroup}</span>
                        </InfoChip>
                      )}
                      {isCollapsed ? (
                        <Right
                          size={12}
                          theme="two-tone"
                          fill={['currentColor', 'currentColor']}
                          className="text-text-dim"
                        />
                      ) : (
                        <Down
                          size={12}
                          theme="two-tone"
                          fill={['currentColor', 'currentColor']}
                          className="text-text-dim"
                        />
                      )}
                    </div>
                    {!isCollapsed &&
                      mods.map((m, mi) => {
                        const isSelected = selected.has(m.id)
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggle(m.id)}
                            className="flex items-center gap-2 px-3 py-[4px] cursor-pointer select-none transition-colors"
                            style={{
                              background: isSelected
                                ? tab === 'avoid'
                                  ? 'rgba(239,83,80,0.08)'
                                  : 'rgba(129,199,132,0.08)'
                                : mi % 2 === 0
                                  ? 'rgba(255,255,255,0.02)'
                                  : 'transparent',
                            }}
                          >
                            <div
                              className="w-[14px] h-[14px] shrink-0 rounded-[3px] flex items-center justify-center transition-[background] duration-100"
                              style={{
                                background: isSelected
                                  ? tab === 'avoid'
                                    ? TAB_COLORS.avoid
                                    : TAB_COLORS.want
                                  : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              {isSelected && (
                                <span className="text-[10px] text-[#171821] font-bold leading-none">&#10003;</span>
                              )}
                            </div>
                            <span
                              className="text-[11px] flex-1"
                              style={{ color: isSelected ? 'var(--text)' : 'var(--text-dim)' }}
                            >
                              {formatModText(m.text)}
                            </span>
                            {m.nightmare && (
                              <span className="text-[8px] font-semibold shrink-0" style={{ color: TAB_COLORS.avoid }}>
                                NM
                              </span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Custom generator */}
      {generator === 'custom' && (
        <div className="flex-1 flex flex-col bg-bg-card px-3 py-3">
          <textarea
            value={customRegexInput}
            onChange={(e) => setCustomRegexInput(e.target.value)}
            placeholder="Paste or type your custom regex"
            className="flex-1 w-full text-[12px] font-mono bg-black/30 rounded px-3 py-2 resize-none text-text outline-none"
            style={{ minHeight: 120, border: '1px solid rgba(0,0,0,0.3)' }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.5)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'
            }}
          />
        </div>
      )}
    </div>
  )
}
