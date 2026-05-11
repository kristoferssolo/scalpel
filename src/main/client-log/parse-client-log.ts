const PATTERN = /Generating level (\d+) area "([^"]+)"/

/** Parse a single Client.txt line. Returns the captured area level and area
 *  code on match, null otherwise. Lines with level 0 (cutscenes, login
 *  areas) also return null since they're not meaningful gameplay zones. */
export function parseClientLogLine(line: string): { areaLevel: number; areaCode: string } | null {
  const m = PATTERN.exec(line)
  if (!m) return null
  const areaLevel = Number(m[1])
  if (!Number.isFinite(areaLevel) || areaLevel <= 0) return null
  return { areaLevel, areaCode: m[2] }
}
