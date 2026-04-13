import { useState, useEffect } from 'react'
import { MAP_MODS, DANGER_COLORS, DANGER_LABELS, type Danger } from '../../../../shared/data/regex/map-mods'
import { buildMapRegex, POE_REGEX_MAX_LENGTH } from './regex-engine'
import { buildQualifierRegex, QUALIFIERS, QUALIFIER_GROUPS, type QualifierValues } from './Qualifiers'
import { Down, Right, CloseSmall, AddOne, Forbid, CheckOne, SettingConfig, Compass, Search } from '@icon-park/react'
import poereIconTight from '../../assets/other/poere-logo-tight.svg'
import { FilterChip } from '../price-check/FilterChip'
import { InfoChip } from '../../shared/PriceChip'
import { ScrubInput } from './ScrubInput'

const DANGER_ORDER: Danger[] = ['lethal', 'dangerous', 'annoying', 'mild', 'harmless', 'beneficial']

const TAB_COLORS = {
  qualifiers: '#81c784',
  avoid: '#ef5350',
  want: '#81c784',
  nightmare: '#b71c1c',
} as const

function formatModText(text: string): string {
  return text.replace(/\d+[-to ]*\d*%/g, '#%').replace(/\d+[-to ]*\d+/g, '#')
}

type Tab = 'qualifiers' | 'avoid' | 'want'
type WantMode = 'any' | 'all'

function loadSet(key: string): Set<number> {
  try {
    const saved = localStorage.getItem(key)
    return saved ? new Set(JSON.parse(saved) as number[]) : new Set()
  } catch {
    return new Set()
  }
}

export function MapMods(): JSX.Element {
  const [tab, setTab] = useState<Tab>('qualifiers')
  const [avoid, setAvoid] = useState<Set<number>>(() => loadSet('scalpel:regex:map-avoid'))
  const [want, setWant] = useState<Set<number>>(() => loadSet('scalpel:regex:map-want'))
  const [wantMode, setWantMode] = useState<WantMode>(() => {
    try {
      return (localStorage.getItem('scalpel:regex:map-want-mode') as WantMode) ?? 'any'
    } catch {
      return 'any'
    }
  })
  const [qualifiers, setQualifiers] = useState<QualifierValues>(() => {
    try {
      const saved = localStorage.getItem('scalpel:regex:qualifiers')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [showNightmare, setShowNightmare] = useState(() => {
    try {
      return localStorage.getItem('scalpel:regex:nightmare') === 'true'
    } catch {
      return false
    }
  })
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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

  const selected = tab === 'avoid' ? avoid : want
  const setSelected = tab === 'avoid' ? setAvoid : setWant

  const visibleMods = MAP_MODS.filter((m) => {
    if (!showNightmare && m.nightmare) return false
    if (search && !m.text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const dangerOrder = tab === 'want' ? [...DANGER_ORDER].reverse() : DANGER_ORDER
  const WANT_PRIORITY = new Set([583869527, -683043845, -1647756153]) // magic monsters, rare monsters, rare+modifier

  // Split nightmare mods into their own group when the chip is on
  const nonNightmareMods = visibleMods.filter((m) => !m.nightmare)
  const nightmareMods = showNightmare ? visibleMods.filter((m) => m.nightmare) : []

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
  const regex = [qualifierRegex, modRegex].filter(Boolean).join(' ')
  const isOverLimit = regex.length > POE_REGEX_MAX_LENGTH
  const qualifierCount = QUALIFIERS.filter((q) => qualifiers[q.id] != null && qualifiers[q.id]! > 0).length

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
        <div className="flex items-center justify-between mt-1">
          <InfoChip size="sm">
            <span className="text-text-dim">
              {avoidMods.length + wantMods.length} mod{avoidMods.length + wantMods.length !== 1 ? 's' : ''}
            </span>
          </InfoChip>
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
              <img src={poereIconTight} alt="" className="w-[14px] h-[14px]" style={{ marginTop: -1 }} />
              <span className="text-text-dim">Powered by poe.re</span>
            </a>
          </InfoChip>
          <InfoChip size="sm" color={isOverLimit ? '#ef5350' : undefined}>
            <span>
              {regex.length} / {POE_REGEX_MAX_LENGTH}
            </span>
          </InfoChip>
        </div>
      </div>

      {/* Chips + search */}
      <div className="flex flex-col px-3 py-2 border-b border-border bg-bg-card">
        <div className="flex items-center gap-[6px]">
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
            }}
          />
          {tab !== 'qualifiers' && (
            <FilterChip
              label="Nightmare"
              active={showNightmare}
              onClick={() => setShowNightmare((v) => !v)}
              color={TAB_COLORS.avoid}
            />
          )}
          {((tab === 'qualifiers' && qualifierCount > 0) || (tab !== 'qualifiers' && selected.size > 0)) && (
            <FilterChip
              label="Clear"
              active={false}
              onClick={() => {
                if (tab === 'qualifiers') setQualifiers({})
                else setSelected(new Set())
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
      </div>

      {/* Qualifiers / Avoid / Want tabs */}
      <div className="flex gap-1 px-2 pt-1 pb-0 bg-bg-card">
        {(['qualifiers', 'avoid', 'want'] as const).map((t) => {
          const isActive = tab === t
          const color = TAB_COLORS[t]
          const count = t === 'avoid' ? avoid.size : t === 'want' ? want.size : qualifierCount
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
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

      {/* Want mode toggle */}
      {tab === 'want' && (
        <div
          className="flex items-center justify-end gap-[6px] px-3 py-[6px] border-b border-border"
          style={{ background: 'var(--bg-solid)' }}
        >
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
      )}

      {/* Qualifiers list */}
      {tab === 'qualifiers' && (
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
                      style={{ marginTop: -1 }}
                    />
                  )}
                  {group.icon === 'compass' && (
                    <Compass
                      size={14}
                      theme="two-tone"
                      fill={['var(--text)', 'rgba(255,255,255,0.2)']}
                      style={{ marginTop: -1 }}
                    />
                  )}
                  <span className="text-[10px] uppercase tracking-wider font-bold flex-1 text-text">{group.label}</span>
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
                          color: qualifiers[q.id] != null && qualifiers[q.id]! > 0 ? 'var(--text)' : 'var(--text-dim)',
                        }}
                      >
                        {q.label}
                      </span>
                      <ScrubInput
                        value={qualifiers[q.id] ?? null}
                        placeholder="--"
                        onChange={(val) => setQualifiers((prev) => ({ ...prev, [q.id]: val }))}
                      />
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Mod list (avoid/want) */}
      {(tab === 'avoid' || tab === 'want') && (
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
    </div>
  )
}
