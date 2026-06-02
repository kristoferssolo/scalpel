/** Bump whenever the compact tier-dataset shape changes, so older clients
 *  refuse remote data shaped for a newer resolver. Must equal the value the
 *  build script writes into tiers-poe*.json / tier-manifest.json. */
export const SCHEMA_VERSION = 1
