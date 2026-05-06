import { app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Manifest } from '../shared/types'
import { MANIFEST_URL } from '../shared/endpoints'

function loadBundledManifest(): Manifest {
  // In a packaged app, extraResources land at process.resourcesPath.
  // In dev, the repo root is the app path.
  // process.resourcesPath is undefined outside Electron (e.g. vitest); guard it.
  const prodPath = process.resourcesPath ? join(process.resourcesPath, 'manifest.json') : null
  const devPath = join(app.getAppPath(), 'manifest.json')
  const manifestPath = prodPath && existsSync(prodPath) ? prodPath : devPath
  const raw = readFileSync(manifestPath, 'utf-8')
  return JSON.parse(raw) as Manifest
}

let cached: Manifest = loadBundledManifest()

export function getManifest(): Manifest {
  return cached
}

function isStringRecord(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

function isValidManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  if (!m['ninjaLeagues'] || typeof m['ninjaLeagues'] !== 'object') return false
  const nl = m['ninjaLeagues'] as Record<string, unknown>
  if (!isStringRecord(nl['poe1']) || !isStringRecord(nl['poe2'])) return false
  return isStringRecord(m['poe2NinjaCategories'])
}

export async function refreshManifest(): Promise<void> {
  try {
    const res = await fetch(MANIFEST_URL, {
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Scalpel-Manifest', Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const parsed = await res.json()
    if (isValidManifest(parsed)) {
      cached = parsed
    } else if (process.env['SCALPEL_DEBUG_LOG']) {
      console.warn('[manifest] remote manifest failed shape validation, keeping bundled copy')
    }
  } catch (e) {
    if (process.env['SCALPEL_DEBUG_LOG']) {
      console.warn('[manifest] fetch failed, keeping bundled copy:', e)
    }
  }
}
