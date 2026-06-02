/** Advance a scrub accumulator by a horizontal delta. Speed scales with the
 *  current magnitude so small values scrub finely and large values scrub fast.
 *  Returns the new (un-clamped, un-snapped) accumulator; callers clamp + snap. */
export function scrubAccumulate(accumulator: number, dx: number, step: number): number {
  const magnitude = Math.abs(accumulator)
  const speed = magnitude >= 1000 ? 5 : magnitude >= 100 ? 2 : magnitude >= 10 ? 1 : 0.5
  return accumulator + (dx * speed * step) / 3
}

/** Round a scrubbed value to the nearest `step`, then to `decimals` precision,
 *  so floating-point scrub math doesn't emit 1.4500000001-style junk. */
export function snapToStep(value: number, step: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(Math.round(value / step) * step * factor) / factor
}
