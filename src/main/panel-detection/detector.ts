import type { PanelState } from '../../shared/panel-state'
import {
  type BitmapView,
  type PanelSample,
  matchPatchExact,
  matchPatchFuzzy,
  patchRect,
  readPatch,
  votePanels,
} from './match'

export interface IndicatorState {
  stable: boolean
  cached: Uint8Array | null
}

export function freshIndicatorState(): IndicatorState {
  return { stable: false, cached: null }
}

/** Pure per-indicator step: fuzzy-match until the indicator first matches, then
 *  cache its exact pixels and exact-compare on every later frame. The cache is
 *  the open-panel UI fingerprint; once panels close the exact compare fails, and
 *  it matches again when they reopen. */
export function stepIndicator(
  prev: IndicatorState,
  frame: BitmapView,
  sample: PanelSample,
): { matched: boolean; next: IndicatorState } {
  if (prev.stable && prev.cached) {
    return { matched: matchPatchExact(frame, patchRect(sample, frame), prev.cached), next: prev }
  }
  const matched = matchPatchFuzzy(frame, sample)
  if (matched) return { matched, next: { stable: true, cached: readPatch(frame, patchRect(sample, frame)) } }
  return { matched, next: prev }
}

export interface PanelDetectorDeps {
  /** Capture + crop the game window to a BGRA frame; null when unavailable (e.g. unfocused). */
  capture: () => Promise<BitmapView | null>
  /** Sample table for the active version; null for an unsupported version (idle). */
  samples: () => PanelSample[] | null
  /** Called only when the verdict changes. */
  onChange: (state: PanelState) => void
  intervalMs?: number
}

export class PanelDetector {
  private timer: ReturnType<typeof setInterval> | null = null
  private states: IndicatorState[] = []
  private last: PanelState | null = null
  private busy = false
  private stopped = false
  private readonly intervalMs: number
  private frameW = 0
  private frameH = 0

  constructor(private readonly deps: PanelDetectorDeps) {
    this.intervalMs = deps.intervalMs ?? 500
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.states = []
    this.last = null
    this.busy = false
    this.frameW = 0
    this.frameH = 0
  }

  /** One detection pass. Exposed for tests; start() drives it on a timer. */
  async tick(): Promise<void> {
    const samples = this.deps.samples()
    if (!samples) return
    if (this.busy) return
    this.busy = true
    try {
      const frame = await this.deps.capture()
      if (this.stopped) return
      if (!frame) {
        // Unfocused / no capture: drop stabilization so we re-fingerprint on return.
        this.states = []
        return
      }
      if (frame.width !== this.frameW || frame.height !== this.frameH) {
        // Frame resized (windowed resize / resolution change): cached patches are
        // sized for the old dimensions, so drop stabilization and re-fingerprint.
        this.frameW = frame.width
        this.frameH = frame.height
        this.states = []
      }
      if (this.states.length !== samples.length) this.states = samples.map(() => freshIndicatorState())

      const matched: boolean[] = []
      for (let i = 0; i < samples.length; i++) {
        const { matched: m, next } = stepIndicator(this.states[i], frame, samples[i])
        matched.push(m)
        this.states[i] = next
      }

      const state = votePanels(samples, matched)
      if (
        !this.last ||
        state.leftPanelOpen !== this.last.leftPanelOpen ||
        state.rightPanelOpen !== this.last.rightPanelOpen
      ) {
        this.last = state
        this.deps.onChange(state)
      }
    } finally {
      this.busy = false
    }
  }
}
