// Type definitions for the IPC and the frontend to talk to eachother. Truly boring stuff.

export type Visibility = 'Show' | 'Hide' | 'Minimal'
export type ComparisonOperator = '>' | '>=' | '=' | '==' | '<=' | '<'

// Any string is valid as new things can pop up from league to league
// Known types are handled explicitly by the matcher; unknown ones evaluate as 'unknown'.
export type ConditionType = string

export type ActionType =
  | 'SetTextColor'
  | 'SetBorderColor'
  | 'SetBackgroundColor'
  | 'SetFontSize'
  | 'PlaySound'
  | 'PlayAlertSound'
  | 'PlayAlertSoundPositional'
  | 'CustomAlertSound'
  | 'CustomAlertSoundOptional'
  | 'PlayEffect'
  | 'MinimapIcon'
  | 'DisableDropSound'
  | 'EnableDropSound'
  | 'DisableDropSoundIfAlertSound'
  | 'EnableDropSoundIfAlertSound'

export interface FilterCondition {
  type: ConditionType
  operator: ComparisonOperator // defaults to '=' for string/bool conditions
  values: string[] // always strings in storage; parsed as needed
  /** True if the operator was explicitly written in the filter file (e.g. "=0" vs bare values) */
  explicitOperator?: boolean
}

export interface RgbaColor {
  r: number
  g: number
  b: number
  a: number // 0-255
}

export interface FilterAction {
  type: ActionType
  values: string[]
}

export interface TierTag {
  /** e.g. "currency->fossil" */
  typePath: string
  /** e.g. "t1", "t2", "exhide" */
  tier: string
}

export interface FilterBlock {
  id: string // stable UUID for React keys
  visibility: Visibility
  conditions: FilterCondition[]
  actions: FilterAction[]
  continue: boolean
  lineStart: number
  lineEnd: number
  /** Any comment line immediately above the block */
  leadingComment?: string
  /** The inline comment on the Show/Hide line (e.g. "%D9 $type->currency->fossil $tier->t1") */
  inlineComment?: string
  /** Parsed FilterBlade tier tag from the inline comment */
  tierTag?: TierTag
}

export interface FilterFile {
  path: string
  blocks: FilterBlock[]
  /** Raw lines — used to write back changes while preserving unmodified sections */
  rawLines: string[]
}

// ─── Item Types ───────────────────────────────────────────────────────────

export type ItemRarity = 'Normal' | 'Magic' | 'Rare' | 'Unique' | 'Gem' | 'Currency'

export interface PoeItem {
  itemClass: string
  rarity: ItemRarity
  name: string
  baseType: string
  mapTier: number
  itemLevel: number
  quality: number
  sockets: string // e.g. "R-G-B B-G"
  linkedSockets: number
  armour: number
  evasion: number
  energyShield: number
  ward: number
  block: number
  reqStr: number
  reqDex: number
  reqInt: number
  corrupted: boolean
  identified: boolean
  mirrored: boolean
  synthesised: boolean
  /** True when the item was constructed by Scalpel (e.g. sister-overlay click,
   *  unique-card click) rather than parsed from a real clipboard paste. UI uses
   *  this to suppress fields that have no meaning on a placeholder item. */
  isSynthetic?: boolean
  fractured: boolean
  transfigured: boolean
  vaalGem?: boolean
  blighted: boolean
  uberBlighted: boolean
  scourged: boolean
  zanaMemory: boolean
  implicitCount: number
  gemLevel: number
  stackSize: number
  maxStackSize?: number
  influence: string[]
  explicits: string[]
  implicits: string[]
  enchants: string[]
  imbues: string[]
  memoryStrands?: number
  /** PoE2: unidentified item implicit tier (rough rarity signal on unid drops).
   *  Not currently populated by the clipboard parser -- consumers should treat
   *  the absence as "unknown", not "tier 0". Same applies to vaal-unique flags
   *  (isVaalUnique / hasVaalUniqueMod / twiceCorrupted) which were declared
   *  ahead of parser support and have been removed for now to avoid silently
   *  evaluating "X False" rules as matching every item. */
  unidentifiedItemTier?: number
  areaLevel?: number
  advancedMods?: AdvancedMod[]
  mapQuantity?: number
  mapRarity?: number
  mapPackSize?: number
  mapMoreScarabs?: number
  mapMoreCurrency?: number
  mapMoreMaps?: number
  mapMoreDivCards?: number
  mapReward?: string
  physDamageMin?: number
  physDamageMax?: number
  eleDamageAvg?: number
  chaosDamageAvg?: number
  attacksPerSecond?: number
  critChance?: number
  width?: number
  height?: number
  heistJob?: { skill: string; level: number }
  monsterLevel?: number
  wingsRevealed?: number
  wingsTotal?: number
  logbookFactions?: string[]
  logbookBosses?: string[]
  atzoatlRooms?: string[]
  atzoatlOpenCount?: number
  storedExperience?: number
}

export interface AdvancedMod {
  type: 'prefix' | 'suffix' | 'implicit'
  name: string
  tier: number
  tags: string[]
  lines: string[] // the actual mod text lines
  ranges: Array<{ value: number; min: number; max: number }> // parsed roll ranges
  fractured?: boolean
  crafted?: boolean
  eldritch?: boolean
  foulborn?: boolean
  magnitudeMultiplier?: number
}

// ─── IPC Channel Payloads ─────────────────────────────────────────────────────

export type ConditionResult = 'pass' | 'fail' | 'unknown'

export interface EvaluatedCondition {
  condition: FilterCondition
  result: ConditionResult
}

export interface MatchResult {
  block: FilterBlock
  /** Index of the block in the filter file */
  blockIndex: number
  /** True if this is the first matching block (what the game actually applies) */
  isFirstMatch: boolean
  /** Per-condition evaluation results */
  evaluatedConditions: EvaluatedCondition[]
  /** True if some conditions couldn't be evaluated from clipboard data */
  hasUnknowns: boolean
}

/** Shows which filter block is active at a given stack size range */
export interface StackSizeBreakpoint {
  /** Minimum stack size for this range (inclusive) */
  min: number
  /** Maximum stack size for this range (inclusive), Infinity for unbounded */
  max: number
  /** The active (first) match at this stack size, or null if hidden by default */
  activeMatch: MatchResult | null
  /** Tier group for the active match at this stack size */
  tierGroup?: TierGroup
}

export interface TierSibling {
  tier: string
  visibility: Visibility
  blockIndex: number
  block: FilterBlock
  /** Pre-evaluated match result so FilterBlockEditor can display it directly */
  match: MatchResult
}

export interface TierGroup {
  typePath: string
  siblings: TierSibling[]
  /** The tier of the currently matched block */
  currentTier: string
}

export interface OverlayData {
  item: PoeItem
  matches: MatchResult[]
  /** For stackable items, shows how the active match changes at different stack sizes */
  stackBreakpoints?: StackSizeBreakpoint[]
  /** For items with quality, shows how the active match changes at different quality levels */
  qualityBreakpoints?: StackSizeBreakpoint[]
  /** For items with memory strands, shows how the active match changes at different strand levels */
  strandBreakpoints?: StackSizeBreakpoint[]
  /** For FilterBlade-style tiered blocks, the sibling tiers */
  tierGroup?: TierGroup
  /** poe.ninja price data */
  priceInfo?: PriceInfo
}

export interface InstallManifest {
  version: string
  electronVersion: string
  asarUrl: string
  asarSha512: string
  asarSize: number
  unpackedUrl?: string
  unpackedSha512?: string
  unpackedSize?: number
  nativeModules: Record<string, string>
  /**
   * Version rules that are known-bricked (stuck, unable to auto-update, etc.). Each entry
   * is either a bare version (exact match) or comparator-prefixed (`<`, `<=`, `>`, `>=`,
   * `=`). When the running version matches, the app surfaces a banner asking the user to
   * reinstall manually. Parsed by `versionMatches` in `shared/version-match.ts`.
   */
  brickedReleases?: string[]
  /** Optional message shown on the bricked-release banner. Falls back to a generic one. */
  brickedMessage?: string
}

export interface RegexPresetTag {
  text: string
  color: string
  source?: 'qualifier' | 'avoid' | 'want' | 'custom' | 'flask'
  sourceId?: string | number
}

export interface RegexPreset {
  id: string
  generator?: string
  tags: RegexPresetTag[]
  avoid: number[]
  want: number[]
  wantMode: 'any' | 'all'
  qualifiers: Record<string, number>
  nightmare: boolean
  customRegex?: string
  /** Computed regex string (stored so main process can paste without rebuilding) */
  regex?: string
  selectedPrefix?: string[]
  selectedSuffix?: string[]
  flaskIlevel?: number
  flaskHighestOnly?: boolean
  flaskMatchBoth?: boolean
  flaskMatchOpen?: boolean
  flaskIgnoreEffectTiers?: boolean
}

export interface AppSettings {
  /** Active filter path + dir + league. Mirrored to/from the per-version fields
   *  (filterPathPoe1, filterPathPoe2, etc.) based on the current poeVersion at
   *  startup and on every set. Consumers read these flat fields as before --
   *  the version namespacing is an implementation detail of the store layer. */
  filterPath: string
  filterDir: string
  league: string
  filterPathPoe1: string
  filterPathPoe2: string
  filterDirPoe1: string
  filterDirPoe2: string
  leaguePoe1: string
  leaguePoe2: string
  hotkey: string
  priceCheckHotkey: string
  overlayOpacity: number
  overlayScale: number
  /** Which side the overlay mounts on when a new item is scanned. 'both' = based on
   *  cursor X (default); 'right'/'left' = always that side regardless of cursor. Drag
   *  behavior is unaffected; this only picks the mount side at scan time. */
  openSide: 'both' | 'right' | 'left'
  closeOnClickOutside: boolean
  reloadOnSave: boolean
  updateChannel: 'stable' | 'beta'
  tradeStatus: 'securable' | 'online' | 'available'
  /** Maps to PoE trade `trade_filters.collapse.option`. When true, the API groups
   *  multiple listings from the same seller into one row. */
  tradeCollapseListings?: boolean
  /** Volume (0.0-1.0) for the filter sound preview button. */
  previewVolume?: number
  tradePriceOption:
    | 'chaos_divine'
    | 'chaos_equivalent'
    | 'chaos'
    | 'divine'
    | 'exalted_divine'
    | 'exalted_equivalent'
    | 'exalted'
  tradePriceOptionPoe1: AppSettings['tradePriceOption']
  tradePriceOptionPoe2: AppSettings['tradePriceOption']
  /** Default "Listed" time for price-check searches. Empty string = any time. */
  tradeDefaultListedTime?:
    | ''
    | '1hour'
    | '3hours'
    | '12hours'
    | '1day'
    | '3days'
    | '1week'
    | '2weeks'
    | '1month'
    | '2months'
  /** How price-check trade results render. Default = one-at-a-time expandable rows;
   *  Open All = every row pre-expanded; Shrinkydink = compact rows (no icon, inline meta). */
  tradeResultsView?: 'default' | 'open-all' | 'shrinkydink'
  priceCheckDefaultPercent: number
  tradeDefaultToBase: boolean
  tradeKeepUncheckedVisible?: boolean
  tradeNeverAutoSearch?: boolean
  chatCommands: Array<{ hotkey: string; command: string; autoSubmit?: boolean }>
  appMacros: Array<{ action: string; hotkey: string; tag?: string }>
  stashScrollEnabled: boolean
  poeVersion: 1 | 2
  regexPresets: RegexPreset[]
  /** Title-bar tab keys the user has hidden. Toggleable from View settings.
   *  'settings' and 'close' are never hidden. */
  hiddenTabs?: HideableTabKey[]
}

/** Title-bar tab keys the user is allowed to hide via View settings. Settings + Close
 *  intentionally aren't here (always-on); Audit + Tools also aren't here (temp tabs
 *  that only render when actively viewed). The tuple is the runtime source of truth;
 *  the union type is derived from it so the two can never drift. */
export const HIDEABLE_TAB_KEYS = ['item', 'pricecheck', 'dust', 'divcards', 'regex'] as const
export type HideableTabKey = (typeof HIDEABLE_TAB_KEYS)[number]

/** Type guard for filtering persisted-settings input. Existing users may have stale
 *  values in `hiddenTabs` (e.g. `'audit'` from before that became a temp tab); filter
 *  through this so consumers downstream never see a phantom key. */
export function isHideableTabKey(k: string): k is HideableTabKey {
  return (HIDEABLE_TAB_KEYS as readonly string[]).includes(k)
}

export interface FilterListEntry {
  /** Full path to the .filter file */
  path: string
  /** Display name (extracted from file for online filters, or filename for local) */
  name: string
  /** Whether this is from the onlinefilters subfolder */
  online: boolean
}

export interface PriceInfo {
  chaosValue: number
  divineValue?: number
  dustValue?: number
}

// ─── Item Search ────────────────────────────────────────────────────────────

/** A row surfaced in the item-search combobox. The main process assembles these from
 *  the active filter + live price data; the renderer decorates each row with an
 *  `iconUrl` after fetching. */
export interface SearchableItem {
  name: string
  baseType: string
  itemClass: string
  rarity: 'Unique' | 'Currency' | 'Gem'
  /** Minimal filter-block info the renderer reuses for `<LootLabel />` styling.
   *  The array is the full Continue chain that matches this item in filter order:
   *  zero or more Continue decorators first, ending with the primary non-Continue
   *  match. Renderer composes them so Continue overlays are reflected in the
   *  label preview. `null` when no block matches. */
  blocks: Array<{ visibility: 'Show' | 'Hide'; actions: FilterAction[]; continue: boolean }> | null
  /** Div-card reward text -- searchable and shown inline when the match came via reward. */
  reward?: string
  /** Explicit icon-map key when the display name doesn't match the iconMap key (e.g.
   *  Originator Map rows share the Map display name but render with a Zana Map icon). */
  iconKey?: string
  /** Extra flags that vary between rows sharing the same baseType (e.g. Originator
   *  Map rows set zanaMemory=true; regular Map rows at the same tier leave it unset). */
  flags?: { zanaMemory?: boolean }
}

// ─── Edit History ────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: number
  timestamp: number
  description: string
  /** The kind of edit that was made */
  action: 'block-edit' | 'tier-move' | 'stack-threshold'
  /** Item name/baseType — used to show the item icon in the history panel */
  itemName?: string
}

// ─── Filter Versions ──────────────────────────────────────────────────────────

export interface FilterVersion {
  filename: string
  timestamp: number
  isCheckpoint: boolean
  label?: string
  filterName?: string
}
