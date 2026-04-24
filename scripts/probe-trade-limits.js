#!/usr/bin/env node
/**
 * Hit each game's trade API once per endpoint and print the rate-limit tier
 * policies in the response headers. Used to sanity-check whether PoE2's
 * policies match PoE1's so we can calibrate MIN_INTERVAL and timeouts
 * correctly (see src/main/trade/trade.ts).
 *
 * Only reads publicly-accessible endpoints with minimal bodies. Doesn't hit
 * /fetch (needs a real query id) or /exchange (needs stat IDs that differ per
 * game). One GET /data/stats and one POST /search per game is enough to see
 * the tier structure.
 *
 * Usage:
 *   node scripts/probe-trade-limits.js           # uses Standard leagues by default
 *   node scripts/probe-trade-limits.js POE1_LEAGUE POE2_LEAGUE
 */

const https = require('https')

const POE1_LEAGUE = process.argv[2] || 'Standard'
const POE2_LEAGUE = process.argv[3] || 'Standard'

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        }),
      )
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function pickLimitHeaders(headers) {
  const out = {}
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase().startsWith('x-rate-limit') || k.toLowerCase() === 'retry-after') out[k] = v
  }
  return out
}

function parseTiers(rulesHeader, stateHeader) {
  // "max:window:timeout" x N, comma separated
  if (!rulesHeader) return null
  const rules = String(rulesHeader).split(',')
  const states = String(stateHeader || '').split(',')
  return rules.map((r, i) => {
    const [max, window, timeout] = r.split(':').map(Number)
    const s = states[i]?.split(':').map(Number) ?? []
    return { max, windowSec: window, timeoutSec: timeout, used: s[0] ?? 0, penalty: s[2] ?? 0 }
  })
}

function printPolicy(label, headers) {
  const policy = headers['x-rate-limit-policy']
  const accounts = headers['x-rate-limit-account']
  const accountsState = headers['x-rate-limit-account-state']
  const ips = headers['x-rate-limit-ip']
  const ipsState = headers['x-rate-limit-ip-state']
  const rules = headers['x-rate-limit-rules']

  console.log(`  policy:      ${policy || '(missing)'}`)
  console.log(`  rules:       ${rules || '(missing)'}`)
  if (ips) {
    const tiers = parseTiers(ips, ipsState)
    console.log(`  ip tiers:    ${tiers.map((t) => `${t.max}/${t.windowSec}s (timeout ${t.timeoutSec}s)`).join('  ')}`)
    console.log(`  ip state:    ${tiers.map((t) => `used ${t.used}, pen ${t.penalty}s`).join('  ')}`)
  }
  if (accounts) {
    const tiers = parseTiers(accounts, accountsState)
    console.log(
      `  acct tiers:  ${tiers.map((t) => `${t.max}/${t.windowSec}s (timeout ${t.timeoutSec}s)`).join('  ')}`,
    )
  }
}

async function probeGame(version, league) {
  const prefix = version === 2 ? 'trade2' : 'trade'
  const refererPath = version === 2 ? '/trade2' : '/trade'
  // Mirror the exact header set Scalpel now sends in-app so the probe reflects
  // what production requests look like, not a naked node https default.
  const header = {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36 Scalpel/0.9.6 (+https://github.com/scalpelpoe/scalpel)',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://www.pathofexile.com',
    Referer: `https://www.pathofexile.com${refererPath}`,
  }

  console.log(`\n== PoE${version} (league: ${league}) ==`)

  // GET /data/stats
  {
    console.log(`-- GET /api/${prefix}/data/stats`)
    const r = await request({
      hostname: 'www.pathofexile.com',
      path: `/api/${prefix}/data/stats`,
      method: 'GET',
      headers: header,
    })
    console.log(`  status:      ${r.status}`)
    printPolicy('stats', r.headers)
  }

  // POST /search with minimal body -- tiny query that returns zero results
  {
    console.log(`-- POST /api/${prefix}/search/${encodeURIComponent(league)}`)
    const body = JSON.stringify({
      query: { status: { option: 'online' }, stats: [] },
      sort: { price: 'asc' },
    })
    const r = await request(
      {
        hostname: 'www.pathofexile.com',
        path: `/api/${prefix}/search/${encodeURIComponent(league)}`,
        method: 'POST',
        headers: { ...header, 'Content-Length': Buffer.byteLength(body) },
      },
      body,
    )
    console.log(`  status:      ${r.status}`)
    printPolicy('search', r.headers)
    if (r.status >= 400) console.log(`  body:        ${r.body.slice(0, 200)}`)
  }

  // POST /search with a Scalpel-shaped body for a mid-tier rare Body Armour --
  // this matches what the price-check path actually sends for typical PoE2
  // items (class-only query + equipment_filters). If this one hangs or 400s
  // while the minimal body above succeeds, the bug is in our payload shape.
  {
    console.log(`-- POST /api/${prefix}/search/${encodeURIComponent(league)}  [scalpel-shape body]`)
    const filtersBlock =
      version === 2
        ? { equipment_filters: { filters: {} }, type_filters: { filters: { rarity: { option: 'nonunique' } } } }
        : { type_filters: { filters: { rarity: { option: 'nonunique' }, category: { option: 'armour.chest' } } } }
    const body = JSON.stringify({
      query: {
        status: { option: 'any' },
        stats: [{ type: 'and', filters: [] }],
        filters: filtersBlock,
      },
      sort: { price: 'asc' },
    })
    const start = Date.now()
    const r = await request(
      {
        hostname: 'www.pathofexile.com',
        path: `/api/${prefix}/search/${encodeURIComponent(league)}`,
        method: 'POST',
        headers: { ...header, 'Content-Length': Buffer.byteLength(body) },
      },
      body,
    )
    console.log(`  status:      ${r.status}  (${Date.now() - start}ms)`)
    printPolicy('search', r.headers)
    if (r.status >= 400) console.log(`  body:        ${r.body.slice(0, 400)}`)
    else {
      try {
        const parsed = JSON.parse(r.body)
        console.log(`  result:      total=${parsed.total ?? '?'}  id=${parsed.id ?? '?'}`)
      } catch (_e) {
        console.log(`  body (non-json): ${r.body.slice(0, 200)}`)
      }
    }
  }
}

async function main() {
  await probeGame(1, POE1_LEAGUE)
  // small gap so PoE2 hits a fresh window, not the same one we just dented
  await new Promise((r) => setTimeout(r, 1500))
  await probeGame(2, POE2_LEAGUE)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
