/* Minimal slice of poe2.re's Settings type, scoped to just the `waystone` key
 * needed by `generateWaystoneRegex`. Trimmed from src/app/settings.ts. */
import type { SelectOption } from './SelectOption'

export interface ResultSettings {
  customText: string
  autoCopy: boolean
}

export interface Settings {
  waystone: {
    resultSettings: ResultSettings
    tier: {
      min: number
      max: number
    }
    rarity: {
      corrupted: boolean
      uncorrupted: boolean
    }
    modifier: {
      over100: boolean
      round10: boolean
      dropOverX: boolean
      dropOverValue: number
      delirious: boolean
      anyPack: boolean
      prefixSelectType: string
      prefixes: SelectOption[]
      suffixes: SelectOption[]
    }
  }
}
