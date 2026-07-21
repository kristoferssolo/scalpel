# Cheat-sheet starter packs

Each subdirectory is one starter pack offered in Settings -> Sheets. Images
are NOT bundled into the installer; the app fetches them on demand from this
repo's raw.githubusercontent.com URLs when the user imports a pack (see
`CHEAT_SHEET_PREFAB_BASE_URL` in `src/shared/endpoints.ts`).

After adding, removing, or renaming files here, run `npm run sync-prefabs` to
regenerate `src/shared/data/cheat-sheet-prefabs.ts`. Sidecar files per pack:

- `_name.txt` - display name override for the pack.
- `_poe.txt` - "1" or "2" to scope the pack to that game (absent = both).
- `_zones.json` - maps image filenames to Client.txt area codes for zone
  detection. Codes are validated against `src/shared/data/poe1-zones.json` /
  `poe2-zones.json` by the sync script.

## Image credits

- `poe1-act-01` through `poe1-act-10`: zone layout images from Cyclon's
  Definitiv Guide (https://www.definitivguide.com), created by
  CyclonDefinitiv. Used with explicit permission (July 2026). An attribution
  line linking to the guide is shown under the starter packs in
  Settings -> Sheets.
- `act-1` through `act-4` (PoE2): layout images by lolcohol
  (mobalytics.gg/poe-2/guides), used with permission; the credit is baked
  into each image.
- Zone area-code registries (`poe1-zones.json` / `poe2-zones.json`) are
  derived from XileHUD's poe_overlay data (MIT).
