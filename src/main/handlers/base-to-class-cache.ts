/** Reverse map: base type -> item class, built lazily from the active game's
 *  class sheet. Lazy because getPoeVersion() isn't meaningful at module load
 *  time -- we resolve on first use, by which point game-state has been set. */
let _baseToClass: Record<string, string> | null = null

export function invalidateBaseToClass(): void {
  _baseToClass = null
}

export function getBaseToClassCache(): Record<string, string> | null {
  return _baseToClass
}

export function setBaseToClassCache(value: Record<string, string>): void {
  _baseToClass = value
}
