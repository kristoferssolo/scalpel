/**
 * Client-side mirror of one of GGG's rate-limit buckets. Port of Awakened PoE
 * Trade's RateLimiter (`renderer/src/web/price-check/trade/RateLimiter.ts`) --
 * same token-bucket model so we wait *before* the server would have to 429.
 *
 * Each call that `push`es a handle occupies a slot for `window * 1000` ms.
 * When the window rolls, the handle auto-releases and the slot frees up. A
 * limiter is "fully utilized" when every slot is occupied.
 *
 * Used in a proactive style: `waitMulti` across every bucket the server has
 * advertised for an endpoint, then fire the request; after the response,
 * `adjustRateLimits` re-syncs the client-side bucket set to match the server's
 * counters. Reactive retry-after handling stays as a last-resort fallback in
 * `trade.ts`.
 */
export class RateLimiter {
  readonly stack: ResourceHandle[] = []
  queue = 0
  private destroyed = false

  constructor(
    public readonly max: number,
    public readonly window: number,
  ) {}

  /** Wait for an available slot, then occupy it. `borrow=false` waits but
   *  doesn't occupy -- used by `waitMulti` to check all limiters atomically
   *  before actually claiming slots. */
  wait(borrow = true): Promise<void> {
    return this._wait(borrow)
  }

  private async _wait(borrow: boolean): Promise<void> {
    if (this.destroyed) throw new Error('RateLimiter is no longer active')

    if (this.isFullyUtilized) {
      this.queue++
      await this.stack[0].promise
      this.queue--
      return this._wait(borrow)
    }
    if (borrow) this.push()
  }

  private push(): void {
    const handle = new ResourceHandle(this.window * 1000, () => {
      const idx = this.stack.indexOf(handle)
      if (idx !== -1) this.stack.splice(idx, 1)
    })
    this.stack.push(handle)
  }

  /** Wait until every limiter in the set has capacity, then claim a slot in
   *  each. Retries if a limiter is destroyed mid-wait (can happen when the
   *  server stops advertising a bucket we were tracking). */
  static async waitMulti(limiters: Iterable<RateLimiter>): Promise<void> {
    const arr = Array.from(limiters)
    try {
      await Promise.all(arr.map((rl) => rl.wait(false)))
    } catch (e) {
      if (e instanceof Error && e.message === 'RateLimiter is no longer active') {
        return RateLimiter.waitMulti(limiters)
      }
      throw e
    }
    if (arr.every((rl) => !rl.isFullyUtilized)) {
      for (const rl of arr) rl.wait()
    } else {
      return RateLimiter.waitMulti(limiters)
    }
  }

  isEqualLimit(other: { max: number; window: number }): boolean {
    return this.max === other.max && this.window === other.window
  }

  get isFullyUtilized(): boolean {
    return this.available === 0
  }

  get available(): number {
    return Math.max(this.max - this.stack.length, 0)
  }

  destroy(): void {
    this.destroyed = true
    if (this.queue > 0) {
      this.stack[0]?.cancel(new Error('RateLimiter is no longer active'))
    }
  }

  toString(): string {
    return `RateLimiter<max=${this.max}:window=${this.window}>(stack=${this.stack.length})`
  }
}

class ResourceHandle {
  readonly borrowedAt: number
  readonly releasedAt: number
  readonly promise: Promise<void>

  private tmid!: ReturnType<typeof setTimeout>
  private cb: () => void
  private resolveFn!: () => void
  private rejectFn!: (reason?: unknown) => void

  constructor(millis: number, cb: () => void) {
    this.borrowedAt = Date.now()
    this.releasedAt = this.borrowedAt + millis
    this.cb = cb
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolveFn = resolve
      this.rejectFn = reject
      this.tmid = setTimeout(() => {
        this.cb()
        this.resolveFn()
      }, millis)
    })
  }

  cancel(reason?: unknown): void {
    clearTimeout(this.tmid)
    this.cb()
    this.rejectFn(reason)
  }
}

/**
 * Sync a client-side bucket set against the server's advertised policy. Called
 * after every response whose headers include `x-rate-limit-rules`. Logic:
 *
 *   - Any client bucket that the server no longer advertises gets destroyed
 *     (likely a policy change or endpoint shift).
 *   - Any bucket the server advertises that we don't have yet gets created,
 *     seeded with `state` pre-used slots so our local counter matches theirs.
 *   - Existing buckets whose server `state` is ahead of our local stack get
 *     "burst" waits to catch up -- this happens when the server counts a
 *     request we didn't locally track (e.g. a parallel request from a
 *     different code path).
 */
export function adjustRateLimits(clientLimits: Set<RateLimiter>, responseHeaders: Record<string, string>): void {
  const rulesHeader = responseHeaders['x-rate-limit-rules']
  if (!rulesHeader) return
  const rules = rulesHeader.split(',')
  const limitStr = rules.map((rule) => responseHeaders[`x-rate-limit-${rule.toLowerCase()}`] ?? '').join(',')
  const stateStr = rules.map((rule) => responseHeaders[`x-rate-limit-${rule.toLowerCase()}-state`] ?? '').join(',')

  // limitStr is "max:window:timeout,max:window:timeout,..." -- one triple per
  // tier across all rules. stateStr is "used:window:penalty,..." same shape.
  const states = stateStr
    .split(',')
    .map((r) => r.split(':'))
    .map((r) => Number(r[0]))
  const serverTiers = limitStr
    .split(',')
    .map((r) => r.split(':'))
    .map((r, i) => ({
      max: Number(r[0]),
      window: Number(r[1]),
      state: states[i] ?? 0,
    }))
    .filter((t) => t.max > 0 && t.window > 0)

  // Destroy client buckets the server stopped advertising.
  for (const limit of [...clientLimits]) {
    if (!serverTiers.some((s) => limit.isEqualLimit(s))) {
      clientLimits.delete(limit)
      limit.destroy()
    }
  }

  // Burst-wait on buckets where the server counted more than we did.
  for (const limit of clientLimits) {
    const server = serverTiers.find((s) => limit.isEqualLimit(s))
    if (!server) continue
    const delta = server.state - limit.stack.length
    if (delta > 0) {
      for (let i = 0; i < Math.min(delta, limit.available); i++) {
        limit.wait()
      }
    }
  }

  // Add buckets the server advertises that we don't have yet.
  for (const serverTier of serverTiers) {
    if ([...clientLimits].some((l) => l.isEqualLimit(serverTier))) continue
    const rl = new RateLimiter(serverTier.max, serverTier.window)
    clientLimits.add(rl)
    for (let i = 0; i < serverTier.state; i++) {
      rl.wait()
    }
  }
}
