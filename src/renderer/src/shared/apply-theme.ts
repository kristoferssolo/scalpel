import type { ThemePalette } from '../../../shared/theme/palette'
import { resolveCssVars } from '../../../shared/theme/derive'
import { resolveActivePalette } from '../../../shared/theme/active'

export const THEME_CACHE_KEY = 'scalpel:theme-vars'

/** Write a resolved palette to :root and cache it for the next cold start. */
export function applyPalette(palette: ThemePalette): void {
  const vars = resolveCssVars(palette)
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(vars))
  } catch {
    // localStorage can throw in private mode / quota; theme still applied.
  }
}

/** Synchronous pre-paint: apply the last cached var map before React mounts.
 *  Eliminates the default-theme flash for non-default themes. Safe no-op
 *  when there is no cache or it is corrupt. */
export function applyCachedVars(): void {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(THEME_CACHE_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const vars = JSON.parse(raw) as Record<string, string>
    const root = document.documentElement
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  } catch {
    // corrupt cache - styles.css default fallback stays in effect.
  }
}

/** Run once per renderer entry. Pre-paints from cache, then reconciles with
 *  persisted settings, then re-applies on every relevant setting change. */
export async function bootstrapTheme(): Promise<void> {
  applyCachedVars()

  const apiCandidate = (window as unknown as { api?: ScalpelThemeApi }).api
  if (!apiCandidate?.getSettings) return
  const api = apiCandidate

  let snapshot: ThemeSettingsSnapshot = { themeId: 'default', customThemePalette: null }

  const reapply = (): void => {
    applyPalette(resolveActivePalette(snapshot.themeId, snapshot.customThemePalette))
  }

  const settings = (await api.getSettings()) as Partial<ThemeSettingsSnapshot>
  snapshot = {
    themeId: settings.themeId ?? 'default',
    customThemePalette: settings.customThemePalette ?? null,
  }
  reapply()

  api.onSettingUpdated?.((key, value) => {
    if (key === 'themeId') snapshot = { ...snapshot, themeId: value as string }
    else if (key === 'customThemePalette') snapshot = { ...snapshot, customThemePalette: value as ThemePalette | null }
    else return
    reapply()
  })
}

interface ThemeSettingsSnapshot {
  themeId: string
  customThemePalette: ThemePalette | null
}

interface ScalpelThemeApi {
  getSettings: () => Promise<unknown>
  onSettingUpdated?: (cb: (key: string, value: unknown) => void) => () => void
}
