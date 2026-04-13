import { atLeastRegex } from './number-regex'

export interface Qualifier {
  id: string
  label: string
  keyword: string
  suffix: string
}

export type QualifierValues = Record<string, number | null>

export interface QualifierGroup {
  label: string
  icon: string
  defaultOpen: boolean
  qualifiers: Qualifier[]
}

export const QUALIFIER_GROUPS: QualifierGroup[] = [
  {
    label: 'General',
    icon: 'setting-config',
    defaultOpen: true,
    qualifiers: [
      { id: 'quantity', label: 'Quantity', keyword: 'm q', suffix: '%' },
      { id: 'packsize', label: 'Pack Size', keyword: 'ack s', suffix: '%' },
      { id: 'morecurrency', label: 'More Currency', keyword: 'ore cu', suffix: '%' },
      { id: 'morescarabs', label: 'More Scarabs', keyword: 'ore sc', suffix: '%' },
      { id: 'moremaps', label: 'More Maps', keyword: 'ore ma', suffix: '%' },
      { id: 'rarity', label: 'Item Rarity', keyword: 'm r', suffix: '%' },
    ],
  },
  {
    label: 'Quality',
    icon: 'compass',
    defaultOpen: false,
    qualifiers: [
      { id: 'quality', label: 'Quality', keyword: 'lity:', suffix: '%' },
      { id: 'quality_packsize', label: 'Maven Quality - Pack Size', keyword: 'ack s', suffix: '%' },
      { id: 'quality_rarity', label: 'Maven Quality - Rarity', keyword: 'rity', suffix: '%' },
      { id: 'quality_currency', label: 'Maven Quality - Currency', keyword: 'rren', suffix: '%' },
      { id: 'quality_divination', label: 'Maven Quality - Divination Cards', keyword: 'ivin', suffix: '%' },
      { id: 'quality_scarab', label: 'Maven Quality - Scarabs', keyword: 'arab', suffix: '%' },
    ],
  },
]

export const QUALIFIERS = QUALIFIER_GROUPS.flatMap((g) => g.qualifiers)

export function buildQualifierRegex(values: QualifierValues): string {
  const parts: string[] = []
  for (const q of QUALIFIERS) {
    const val = values[q.id]
    if (val == null || val <= 0) continue
    parts.push(`"${q.keyword}.*${atLeastRegex(val)}${q.suffix}"`)
  }
  return parts.join(' ')
}
