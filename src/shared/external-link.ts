/** Shared types and URL builder for "Open in poewiki / poedb" buttons and
 *  app macros. Used by both main (macro routing) and renderer (button onClick,
 *  preload IPC subscription). */

export type ExternalLinkTarget = 'wiki' | 'poedb'

/** Foulborn unique items carry a "Foulborn " prefix (e.g. "Foulborn Headhunter")
 *  that the wiki/poedb pages don't. The prefix only applies on uniques -- a
 *  currency named "Foulborn Exalted Orb" has its own page and stays as-is. */
function externalLookupName(item: { name: string; rarity: string }): string {
  if (item.rarity === 'Unique' && item.name.startsWith('Foulborn ')) {
    return item.name.slice('Foulborn '.length)
  }
  return item.name
}

/** One config entry per target: hosts split by game version, the path prefix,
 *  and the per-target slug rule. wiki accepts URI-encoded names directly
 *  (MediaWiki 301s %20 to underscore, %27 round-trips). poedb is stricter --
 *  apostrophes get stripped and spaces become underscores before encoding. */
const TARGETS: Record<
  ExternalLinkTarget,
  {
    hostByVersion: Record<1 | 2, string>
    path: string
    slug: (rawName: string) => string
  }
> = {
  wiki: {
    hostByVersion: { 1: 'www.poewiki.net', 2: 'www.poe2wiki.net' },
    path: '/wiki/',
    slug: (raw) => encodeURIComponent(raw),
  },
  poedb: {
    hostByVersion: { 1: 'poedb.tw', 2: 'poe2db.tw' },
    path: '/us/',
    slug: (raw) => encodeURIComponent(raw.replace(/'/g, '').replace(/\s+/g, '_')),
  },
}

export function externalLinkUrl(
  target: ExternalLinkTarget,
  item: { name: string; rarity: string },
  poeVersion: 1 | 2,
): string {
  const cfg = TARGETS[target]
  return `https://${cfg.hostByVersion[poeVersion]}${cfg.path}${cfg.slug(externalLookupName(item))}`
}
