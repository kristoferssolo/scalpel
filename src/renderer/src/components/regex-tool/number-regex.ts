/**
 * Generate a regex that matches any integer >= min.
 * Uses character classes and alternation to stay compact.
 * E.g. atLeast(80) -> "([89]\\d|\\d{3})"
 *      atLeast(150) -> "(1[5-9]\\d|[2-9]\\d{2}|\\d{4})"
 */
export function atLeastRegex(min: number): string {
  if (min <= 0) return '\\d+'
  if (min <= 1) return '[1-9]\\d*'

  const parts: string[] = []
  const digits = String(min)
  const len = digits.length

  // Handle the partial range in the same digit count as min
  // e.g. for 150: 150-199, 200-999
  addSameLength(min, Math.pow(10, len) - 1, parts)

  // All numbers with more digits are automatically >= min
  parts.push(`\\d{${len + 1},}`)

  if (parts.length === 1) return parts[0]
  return `(${parts.join('|')})`
}

function addSameLength(min: number, max: number, parts: string[]): void {
  const minStr = String(min)
  const maxStr = String(max)
  if (minStr.length !== maxStr.length) return

  const len = minStr.length
  if (len === 1) {
    if (min === max) parts.push(String(min))
    else if (min === 0 && max === 9) parts.push('\\d')
    else parts.push(`[${min}-${max}]`)
    return
  }

  const firstMin = parseInt(minStr[0])
  const firstMax = parseInt(maxStr[0])

  // Same first digit
  if (firstMin === firstMax) {
    const suffix = buildSuffix(minStr.slice(1), maxStr.slice(1))
    parts.push(`${firstMin}${suffix}`)
    return
  }

  // First digit range: handle the partial first bucket, full middle buckets, partial last bucket
  // Partial first: e.g. for 150, handle 150-199
  if (minStr.slice(1) !== '0'.repeat(len - 1)) {
    const suffix = buildSuffix(minStr.slice(1), '9'.repeat(len - 1))
    parts.push(`${firstMin}${suffix}`)
    // Full middle buckets
    if (firstMin + 1 <= firstMax) {
      addFullRange(firstMin + 1, firstMax, len - 1, parts)
    }
  } else {
    // min is exactly X000..., handle full range from firstMin
    addFullRange(firstMin, firstMax, len - 1, parts)
  }
}

function addFullRange(fromDigit: number, toDigit: number, suffixLen: number, parts: string[]): void {
  const suffix = suffixLen === 1 ? '\\d' : `\\d{${suffixLen}}`
  if (fromDigit === toDigit) {
    parts.push(`${fromDigit}${suffix}`)
  } else if (fromDigit === 0 && toDigit === 9) {
    parts.push(`\\d${suffix}`)
  } else {
    parts.push(`[${fromDigit}-${toDigit}]${suffix}`)
  }
}

function buildSuffix(minSuffix: string, maxSuffix: string): string {
  if (minSuffix === '0'.repeat(minSuffix.length)) {
    return minSuffix.length === 1 ? '\\d' : `\\d{${minSuffix.length}}`
  }
  const parts: string[] = []
  addSameLength(parseInt(minSuffix), parseInt(maxSuffix), parts)
  if (parts.length === 1) return parts[0]
  return `(${parts.join('|')})`
}
