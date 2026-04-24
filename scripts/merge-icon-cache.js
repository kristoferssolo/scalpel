#!/usr/bin/env node
/**
 * Promote the runtime icon cache (`icon-cache-poe{1,2}.json` in Electron's
 * userData dir) into the bundled `src/shared/data/items/item-icons-poe{1,2}.json`
 * sheet, then delete the cache file so it starts fresh. Use this after a
 * harvesting session where you price-checked a bunch of items whose icons
 * weren't in the bundle -- the runtime cache captured their CDN URLs and now
 * we ship them with the next release.
 *
 * Dedup is already handled at harvest time (see src/main/trade/icon-cache.ts),
 * so the cache only contains keys that weren't in the bundle when harvested.
 * We still guard against races here: if the bundle has since gained the same
 * key from another source (e.g. a sidekick pull), the bundle wins.
 *
 * Usage:
 *   node scripts/merge-icon-cache.js [--dry-run] [--keep-cache]
 *     --dry-run     print what would be added without writing either file
 *     --keep-cache  merge but don't delete the source cache file afterward
 *
 * Close Scalpel before running -- the app debounces cache writes by 2s and
 * won't flush mid-session (there's no flush-on-quit hook yet), so harvested
 * entries from the current session may otherwise be missed.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const PRODUCT_NAME = 'Scalpel'

/** Electron's app.getPath('userData') across platforms. Mirrors the logic at
 *  https://www.electronjs.org/docs/latest/api/app#appgetpathname so we can
 *  find the cache file from a plain Node script without booting Electron. */
function userDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), PRODUCT_NAME)
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', PRODUCT_NAME)
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), PRODUCT_NAME)
}

function mergeOne(version, { dryRun, keepCache }) {
  const cachePath = path.join(userDataDir(), `icon-cache-poe${version}.json`)
  const bundlePath = path.resolve(__dirname, '..', `src/shared/data/items/item-icons-poe${version}.json`)

  if (!fs.existsSync(cachePath)) {
    console.log(`poe${version}: no cache at ${cachePath} -- skipping`)
    return
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
  const before = Object.keys(bundle).length

  let added = 0
  let skipped = 0
  for (const [key, url] of Object.entries(cache)) {
    if (bundle[key]) {
      skipped++
      continue
    }
    bundle[key] = url
    added++
  }

  const sorted = Object.fromEntries(Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b)))

  console.log(
    `poe${version}: bundle ${before} -> ${Object.keys(sorted).length}  (added ${added}, skipped ${skipped} already-bundled)`,
  )

  if (dryRun) {
    console.log('  dry-run: not writing')
    return
  }

  fs.writeFileSync(bundlePath, JSON.stringify(sorted, null, 2) + '\n')
  if (!keepCache) {
    fs.unlinkSync(cachePath)
    console.log(`  cleared cache at ${cachePath}`)
  }
}

function main() {
  const flags = new Set(process.argv.slice(2))
  const opts = { dryRun: flags.has('--dry-run'), keepCache: flags.has('--keep-cache') }
  mergeOne(1, opts)
  mergeOne(2, opts)
}

main()
