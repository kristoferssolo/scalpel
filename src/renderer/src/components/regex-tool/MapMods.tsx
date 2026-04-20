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
} from '@icon-park/react'
import { TAB_COLORS, TagSourceIcon, loadSet, loadStorage, tagChipStyle } from './mapmods-helpers'
import poereIconTight from '../../assets/other/poere-logo-tight.svg'
import { FilterChip } from '../price-check/FilterChip'
import { ErrorBanner } from '../ErrorBanner'
import { TradeResults } from './TradeResults'
import { MAP_TIER_ICONS, ORIGINATOR_TIER_ICONS, TierPicker } from './TierPicker'
import { SavedPresets } from './SavedPresets'
import { ModList } from './ModList'
import type { Listing } from '../price-check/types'
import { InfoChip } from '../../shared/PriceChip'
import { ScrubInput } from './ScrubInput'
import { generatePresetTags, CUSTOM_TAG_COLOR } from './preset-tags'
import type { RegexPreset, RegexPresetTag } from '../../../../shared/types'

const DANGER_ORDER: Danger[] = ['lethal', 'dangerous', 'annoying', 'mild', 'harmless', 'beneficial']

type Tab = 'qualifiers' | 'avoid' | 'want'
type WantMode = 'any' | 'all'

export function MapMods(): JSX.Element {
  const [generator, _setGenerator] = useState<'maps' | 'custom'>(() =>
    loadStorage('scalpel:regex:generator', 'maps' as 'maps' | 'custom', (s) => (s === 'custom' ? 'custom' : 'maps')),
  )
  const savedTagsByGenerator = useRef<Record<string, (RegexPresetTag & { id: number })[]>>(
    (() => {
      const byGen = loadStorage(
        'scalpel:regex:presetTagsByGenerator',
        {} as Record<string, (RegexPresetTag & { id: number })[]>,
      )
      // Migrate from the old flat-array storage key if per-generator storage is empty
      if (Object.keys(byGen).length === 0) {
        const legacy = loadStorage<(RegexPresetTag & { id: number })[]>('scalpel:regex:presetTags', [])
        if (legacy.length > 0) {
          const currentGen = loadStorage('scalpel:regex:generator', 'maps', (s) => (s === 'custom' ? 'custom' : 'maps'))
          byGen[currentGen] = legacy
        }
      }
      return byGen
    })(),
  )
  const setGenerator = (g: 'maps' | 'custom') => {
    // Stash current tags, restore target's tags
    savedTagsByGenerator.current[generator] = presetTags
    localStorage.setItem('scalpel:regex:presetTagsByGenerator', JSON.stringify(savedTagsByGenerator.current))
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
  const [saveOpen, setSaveOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [presetTags, setPresetTags] = useState<(RegexPresetTag & { id: number })[]>(
    () => savedTagsByGenerator.current[generator] ?? [],
  )
  useEffect(() => {
    savedTagsByGenerator.current[generator] = presetTags
    localStorage.setItem('scalpel:regex:presetTagsByGenerator', JSON.stringify(savedTagsByGenerator.current))
  }, [presetTags, generator])
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
      const migrated = loaded.map((p) =>
        p.tags
          ? p
          : { ...p, tags: [{ text: (p as unknown as { name: string }).name || 'preset', color: CUSTOM_TAG_COLOR }] },
      )
      setPresets(migrated)
      // Auto-open load panel if there are any saved presets for the current generator
      if (migrated.some((p) => (p.generator ?? 'maps') === generator)) {
        setLoadOpen(true)
      }
      // If we have tags in the save bar but the regex state is empty, restore from matching preset
      if (generator === 'custom' && presetTags.length > 0 && !customRegexInput) {
        const tagKey = [...presetTags.map((t) => t.text)].sort().join('|')
        const match = migrated.find(
          (p) => (p.generator ?? 'maps') === 'custom' && [...p.tags.map((t) => t.text)].sort().join('|') === tagKey,
        )
        if (match?.customRegex) setCustomRegexInput(match.customRegex)
      }
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

  // On mount, if no tags are stored yet for this generator, seed from auto-generated tags
  useEffect(() => {
    if (presetTags.length === 0) {
      const auto = getAutoTags()
      if (auto && auto.length > 0) {
        setPresetTags(auto.map((t, i) => ({ ...t, id: i })))
      }
    }
  }, [])

  // Keep auto-generated tags in sync with live state while panel is open.
  // Custom tags and tag order are preserved.
  useEffect(() => {
    const fresh = getAutoTags()
    if (!fresh) return
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
  }, [avoid, want, qualifiers])

  const removePresetTag = (index: number) => {
    setPresetTags((prev) => prev.filter((_, i) => i !== index))
  }

  const [macroTagError, setMacroTagError] = useState<string | null>(null)

  // Identify the preset (if any) that matches the current auto-tag set in the active generator.
  // For 'custom' uses the regex string; for 'maps' uses sorted auto-tag text (ignoring custom tags).
  const findMatchingPreset = (): RegexPreset | undefined => {
    if (generator === 'custom') {
      return presets.find((p) => (p.generator ?? 'maps') === 'custom' && p.customRegex === customRegexInput)
    }
    const isAuto = (t: RegexPresetTag) => !!t.source && t.source !== 'custom'
    const autoKey = (tags: RegexPresetTag[]) =>
      tags
        .filter(isAuto)
        .map((t) => t.text)
        .sort()
        .join('|')
    const currentKey = autoKey(presetTags)
    return presets.find((p) => (p.generator ?? 'maps') === generator && autoKey(p.tags) === currentKey)
  }

  const addCustomTag = () => {
    const text = customTagInput.trim()
    if (!text) return
    // Macro tags (text containing "macro") must be unique across all other presets
    if (/macro/i.test(text)) {
      const ownPreset = findMatchingPreset()
      const inUseByOther = presets.some(
        (p) => p.id !== ownPreset?.id && p.tags?.some((t) => t.text === text && (!t.source || t.source === 'custom')),
      )
      if (inUseByOther) {
        setMacroTagError('Macro tag is in use')
        setTimeout(() => setMacroTagError(null), 3000)
        return
      }
    }
    setPresetTags((prev) => [...prev, { text, color: CUSTOM_TAG_COLOR, id: Date.now() }])
    setCustomTagInput('')
  }

  const savePreset = async () => {
    if (presetTags.length === 0) return
    const existingDupe = findMatchingPreset()
    const preset: RegexPreset = {
      id: existingDupe?.id ?? crypto.randomUUID(),
      generator,
      tags: presetTags,
      avoid: [...avoid],
      want: [...want],
      wantMode,
      qualifiers: Object.fromEntries(Object.entries(qualifiers).filter(([, v]) => v != null)) as Record<string, number>,
      nightmare: showNightmare,
      ...(generator === 'custom' ? { customRegex: customRegexInput } : {}),
      regex,
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
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Macro tag duplicate error bar */}
      <ErrorBanner message={macroTagError} />
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
                    setPresetTags([])
                    setCustomTagInput('')
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
                  setShowTierPicker(false)
                  setShowTradeResults(false)
                  setSaveOpen(false)
                  setLoadOpen(false)
                }
              }}
            />
          )}
          <FilterChip
            label={
              <>
                <Save size={12} theme="outline" fill="currentColor" /> Save
              </>
            }
            active={saveOpen}
            onClick={() => {
              setSaveOpen((v) => !v)
              if (!saveOpen) {
                setSearchOpen(false)
                setSearch('')
                setShowTierPicker(false)
                setShowTradeResults(false)
              }
            }}
          />
          <FilterChip
            label={
              <>
                <Save size={12} theme="outline" fill="currentColor" /> Load
              </>
            }
            active={loadOpen}
            onClick={() => {
              setLoadOpen((v) => !v)
              if (!loadOpen) {
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
                  setSaveOpen(false)
                  setLoadOpen(false)
                } else {
                  setShowTierPicker((v) => !v)
                  if (!showTierPicker) {
                    setSearchOpen(false)
                    setSearch('')
                    setSaveOpen(false)
                    setLoadOpen(false)
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
            maxHeight: saveOpen ? 300 : 0,
            marginTop: saveOpen ? 8 : 0,
            opacity: saveOpen ? 1 : 0,
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
        <TierPicker
          showTierPicker={showTierPicker}
          showTradeResults={showTradeResults}
          showAllTiers={showAllTiers}
          setShowAllTiers={setShowAllTiers}
          tradeOriginator={tradeOriginator}
          setTradeOriginator={setTradeOriginator}
          tradeCorrupted8mod={tradeCorrupted8mod}
          setTradeCorrupted8mod={setTradeCorrupted8mod}
          hasNightmareMod={hasNightmareMod}
          tradeSearching={tradeSearching}
          regex={regex}
          tierIcons={tierIcons}
          searchMapTrade={searchMapTrade}
        />
      </div>
      {/* close px-3 chips section */}
      {loadOpen && (
        <SavedPresets
          presets={presets}
          setPresets={setPresets}
          generator={generator}
          loadPreset={loadPreset}
          deletePreset={deletePreset}
        />
      )}

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

          {showTradeResults && (
            <TradeResults
              tradeTotal={tradeTotal}
              tradeQueryId={tradeQueryId}
              tradeLeague={tradeLeague}
              tradeError={tradeError}
              tradeListings={tradeListings}
              tradeRemainingIds={tradeRemainingIds}
              tradeLoadMore={tradeLoadMore}
              loadingMore={loadingMore}
              expandedListing={expandedListing}
              setExpandedListing={setExpandedListing}
              priceChipMinWidth={priceChipMinWidth}
              loggedIn={loggedIn}
              actionStatus={actionStatus}
              setActionStatus={setActionStatus}
              rateLimitTiers={rateLimitTiers}
            />
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

          {!showTradeResults && (tab === 'avoid' || tab === 'want') && (
            <ModList
              grouped={grouped}
              selected={selected}
              collapsed={collapsed}
              tab={tab}
              toggle={toggle}
              toggleCollapse={toggleCollapse}
            />
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
