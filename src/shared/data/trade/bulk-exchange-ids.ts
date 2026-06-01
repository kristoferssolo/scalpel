import poe1 from './bulk-exchange-ids-poe1.json'
import poe2 from './bulk-exchange-ids-poe2.json'

/** Item-name to trade-API exchange ID, per game. These IDs are the slugs the
 *  `/api/trade<N>/exchange` endpoint wants under `want`/`have`. PoE1's map is
 *  the legacy hand-maintained file; PoE2's is generated from GGG's live
 *  `/api/trade2/data/static` (the exchange's own item list), with EE2's
 *  items.ndjson as a fallback (see scripts/local/fetch-poe2-bulk-exchange-ids.js). */
const POE1 = poe1 as Record<string, string>
const POE2 = poe2 as Record<string, string>

export function getBulkExchangeIdMap(version: 1 | 2): Record<string, string> {
  return version === 2 ? POE2 : POE1
}
