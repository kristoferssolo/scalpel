import { regexMapModsENGLISH } from './vendor/mapmods/Generated.MapModsV3.ENGLISH'
import type { Regex, MapModsTokenOption } from './vendor/mapmods/GeneratedTypes'

export type Danger = 'lethal' | 'dangerous' | 'annoying' | 'mild' | 'harmless' | 'beneficial'

export interface MapMod {
  id: number
  regex: string
  text: string
  danger: Danger
  nightmare: boolean
}

function scaryToDanger(scary: number): Danger {
  if (scary >= 600) return 'lethal'
  if (scary >= 370) return 'dangerous'
  if (scary >= 85) return 'annoying'
  if (scary >= 10) return 'mild'
  if (scary >= 2) return 'harmless'
  return 'beneficial'
}

function formatText(rawText: string): string {
  return rawText
    .replace(/\([\d-]+\)/g, '#')
    .replace(/\b\d+%/g, '#%')
    .replace(/\b\d+\b/g, '#')
}

function tokensToMods(data: Regex<MapModsTokenOption>): MapMod[] {
  return data.tokens.map((t) => ({
    id: t.id,
    regex: t.regex,
    text: formatText(t.rawText),
    danger: scaryToDanger(t.options.scary),
    nightmare: t.options.nm,
  }))
}

export const MAP_MODS: MapMod[] = tokensToMods(regexMapModsENGLISH)

export const MAP_MOD_OPTIMIZATIONS = regexMapModsENGLISH.optimizationTable

export const DANGER_COLORS: Record<Danger, string> = {
  lethal: '#ef5350',
  dangerous: '#ff9800',
  annoying: '#ffd54f',
  mild: '#81c784',
  harmless: '#90a4ae',
  beneficial: '#4fc3f7',
}

export const DANGER_LABELS: Record<Danger, string> = {
  lethal: 'Lethal',
  dangerous: 'Dangerous',
  annoying: 'Annoying',
  mild: 'Mild',
  harmless: 'Harmless',
  beneficial: 'Beneficial',
}
