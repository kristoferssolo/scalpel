#!/usr/bin/env node
/**
 * Build src/shared/data/tiers/tiers-poe{1,2}.json from RePoE-fork.
 *
 * Joins three upstream files per game:
 *   - mods_by_base.json : item class -> tag-combo -> { bases, mods{family{group{modId:gate}}} }
 *   - mods.json         : modId -> { name, required_level, groups, domain, stats[], text }
 *   - base_items.json   : metadata path -> { name, tags, item_class }
 *
 * Emits a compact, interned dataset: a global deduped `mods` array plus a
 * `bases` map of displayBaseType -> group -> ascending tier-index list.
 *
 * Source: https://repoe-fork.github.io/ (PoE1) and /poe2/ (PoE2). Build-time
 * only; never bundled into the app. Attribution to RePoE-fork.
 *
 * Usage: node scripts/build-tier-data.js
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const https = require('node:https')

const OUT_DIR = path.join(__dirname, '..', 'src', 'shared', 'data', 'tiers')
const SCHEMA_VERSION = 1

const SOURCES = {
  poe1: 'https://repoe-fork.github.io/',
  poe2: 'https://repoe-fork.github.io/poe2/',
}

/** Pure: join the three upstream objects into the compact dataset. */
function buildCompact(modsByBase, mods, baseItems) {
  const modIndex = new Map() // modId -> index into `out.mods`
  const outMods = []

  function internMod(modId) {
    if (modIndex.has(modId)) return modIndex.get(modId)
    const m = mods[modId]
    if (!m || m.domain !== 'item') return -1
    const stats = (m.stats || []).map((s) => [s.id, s.min, s.max])
    if (stats.length === 0) return -1
    const idx = outMods.length
    outMods.push({ n: m.name, l: m.required_level, g: (m.groups && m.groups[0]) || '', s: stats, t: m.text })
    modIndex.set(modId, idx)
    return idx
  }

  // First accumulate each base's full group-map (a base can appear in several
  // tag-combos, whose groups merge).
  const baseMaps = {}
  for (const cls of Object.keys(modsByBase)) {
    for (const combo of Object.keys(modsByBase[cls])) {
      const entry = modsByBase[cls][combo]
      // Flatten every family (prefix, suffix, influence/delve/etc.) into one
      // group -> [modId] map; group names are disjoint across families.
      const groupToIds = {}
      for (const family of Object.keys(entry.mods || {})) {
        for (const group of Object.keys(entry.mods[family])) {
          const ids = Object.keys(entry.mods[family][group])
          if (!groupToIds[group]) groupToIds[group] = []
          groupToIds[group].push(...ids)
        }
      }
      // Resolve to compact indices, drop excluded mods, order ascending by req level.
      const compactGroups = {}
      for (const group of Object.keys(groupToIds)) {
        const indices = groupToIds[group]
          .map(internMod)
          .filter((i) => i >= 0)
          .sort((a, b) => outMods[a].l - outMods[b].l)
        if (indices.length > 0) compactGroups[group] = indices
      }
      if (Object.keys(compactGroups).length === 0) continue
      for (const metaPath of entry.bases || []) {
        const bi = baseItems[metaPath]
        if (!bi || !bi.name) continue
        baseMaps[bi.name] = { ...(baseMaps[bi.name] || {}), ...compactGroups }
      }
    }
  }

  // Intern identical pools: most bases share an identical group-map, so store the
  // distinct maps once in `pools` and point each base at its pool index.
  const pools = []
  const poolKey = new Map()
  const bases = {}
  for (const name of Object.keys(baseMaps)) {
    // Canonicalize (sort group names) so equal maps stringify identically.
    const canon = {}
    for (const g of Object.keys(baseMaps[name]).sort()) canon[g] = baseMaps[name][g]
    const key = JSON.stringify(canon)
    let idx = poolKey.get(key)
    if (idx === undefined) {
      idx = pools.length
      pools.push(canon)
      poolKey.set(key, idx)
    }
    bases[name] = idx
  }

  return { schemaVersion: SCHEMA_VERSION, mods: outMods, pools, bases }
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

function httpGet(url, etag) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Scalpel-TierData' }
    if (etag) headers['If-None-Match'] = etag
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode === 304) {
          res.resume()
          return resolve({ notModified: true, etag })
        }
        if (res.statusCode === 301 || res.statusCode === 302) {
          return httpGet(res.headers.location, etag).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        let data = ''
        res.on('data', (c) => {
          data += c
        })
        res.on('end', () => resolve({ body: data, etag: res.headers.etag }))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function readMeta() {
  const p = path.join(OUT_DIR, '.sync-meta.json')
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return { repo: 'repoe-fork/repoe-fork.github.io', etags: {} }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const meta = readMeta()
  meta.etags = meta.etags || {}
  const perGameHash = {}
  let anyChange = false

  for (const [game, base] of Object.entries(SOURCES)) {
    const files = ['mods_by_base.json', 'mods.json', 'base_items.json']
    const fetched = {}
    let gameChanged = false
    for (const f of files) {
      const key = `${game}/${f}`
      const r = await httpGet(base + f, meta.etags[key])
      if (r.notModified) {
        console.log(`${key}: 304 (unchanged)`)
        continue
      }
      gameChanged = true
      fetched[f] = JSON.parse(r.body)
      meta.etags[key] = r.etag
    }
    const outPath = path.join(OUT_DIR, `tiers-${game}.json`)
    if (!gameChanged && fs.existsSync(outPath)) {
      perGameHash[game] = sha256(fs.readFileSync(outPath, 'utf8'))
      continue
    }
    // If only some files were 304, we still need the full set; refetch missing.
    for (const f of files) {
      if (!fetched[f]) {
        const r = await httpGet(base + f)
        fetched[f] = JSON.parse(r.body)
        meta.etags[`${game}/${f}`] = r.etag
      }
    }
    const compact = buildCompact(fetched['mods_by_base.json'], fetched['mods.json'], fetched['base_items.json'])
    const json = `${JSON.stringify(compact)}\n`
    perGameHash[game] = sha256(json)
    // Only write (and flag a change) when the bytes actually differ. A 200 that
    // returns identical content (repoe rebuilt with a new ETag but same data)
    // must not produce a diff, or the daily cron would open a no-op PR.
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null
    if (json !== existing) {
      fs.writeFileSync(outPath, json, 'utf8')
      anyChange = true
      console.log(`${game}: wrote ${(json.length / 1048576).toFixed(2)}MB, ${compact.mods.length} mods, ${Object.keys(compact.bases).length} bases`)
    } else {
      console.log(`${game}: refetched, content unchanged`)
    }
  }

  // Only rewrite the manifest + meta on a real data change. The timestamps below
  // would otherwise churn every run and make the cron PR daily for nothing.
  if (anyChange) {
    const manifest = {
      schemaVersion: SCHEMA_VERSION,
      perGameHash,
      hash: sha256(Object.values(perGameHash).join(':')),
      generatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(OUT_DIR, 'tier-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    meta.timestamp = new Date().toISOString()
    fs.writeFileSync(path.join(OUT_DIR, '.sync-meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
    console.log('tier data updated.')
  } else {
    console.log('tier data already current.')
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { buildCompact, sha256, main, SCHEMA_VERSION, OUT_DIR, SOURCES }
