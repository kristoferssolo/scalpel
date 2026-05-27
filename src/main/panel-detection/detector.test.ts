import { describe, expect, it, vi } from 'vitest'
import { type BitmapView, type PanelSample, patchRect } from './match'
import { PanelDetector } from './detector'

function makeFrame(width: number, height: number): BitmapView {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) data[i * 4 + 3] = 255
  return { data, width, height }
}

function fillPatch(frame: BitmapView, sample: PanelSample, r: number, g: number, b: number): void {
  const rect = patchRect(sample, frame)
  for (let dy = 0; dy < rect.size; dy++) {
    for (let dx = 0; dx < rect.size; dx++) {
      const off = ((rect.y + dy) * frame.width + (rect.x + dx)) * 4
      frame.data[off] = b
      frame.data[off + 1] = g
      frame.data[off + 2] = r
      frame.data[off + 3] = 255
    }
  }
}

// Two left indicators is enough to vote the left side open (>= 2 of its samples).
const SAMPLES: PanelSample[] = [
  { side: 'left', pos: { x: 100, y: 100 }, rgbMin: { r: 200, g: 0, b: 0 }, rgbMax: { r: 255, g: 50, b: 50 } },
  { side: 'left', pos: { x: 200, y: 100 }, rgbMin: { r: 200, g: 0, b: 0 }, rgbMax: { r: 255, g: 50, b: 50 } },
  { side: 'right', pos: { x: 300, y: 100 }, rgbMin: { r: 200, g: 0, b: 0 }, rgbMax: { r: 255, g: 50, b: 50 } },
  { side: 'right', pos: { x: 400, y: 100 }, rgbMin: { r: 200, g: 0, b: 0 }, rgbMax: { r: 255, g: 50, b: 50 } },
]

function leftOpenFrame(r = 220): BitmapView {
  const f = makeFrame(3840, 2160)
  fillPatch(f, SAMPLES[0], r, 10, 10)
  fillPatch(f, SAMPLES[1], r, 10, 10)
  return f
}

function openFrame(width: number, height: number, r = 220): BitmapView {
  const f = makeFrame(width, height)
  fillPatch(f, SAMPLES[0], r, 10, 10)
  fillPatch(f, SAMPLES[1], r, 10, 10)
  return f
}

describe('PanelDetector', () => {
  it('emits once on a verdict change and suppresses repeats', async () => {
    const onChange = vi.fn()
    const frame = leftOpenFrame()
    const d = new PanelDetector({ capture: () => Promise.resolve(frame), samples: () => SAMPLES, onChange })
    await d.tick()
    await d.tick()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ leftPanelOpen: true, rightPanelOpen: false })
  })

  it('does nothing when the version is unsupported (samples null)', async () => {
    const onChange = vi.fn()
    const capture = vi.fn(() => Promise.resolve(leftOpenFrame()))
    const d = new PanelDetector({ capture, samples: () => null, onChange })
    await d.tick()
    expect(capture).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('resets stabilization on a null frame (no spurious close)', async () => {
    const onChange = vi.fn()
    // Distinct in-band pixel values: A=220, B=230. Both within the band.
    const frames: (BitmapView | null)[] = [leftOpenFrame(220), null, leftOpenFrame(230)]
    let i = 0
    const d = new PanelDetector({ capture: () => Promise.resolve(frames[i++]), samples: () => SAMPLES, onChange })
    await d.tick() // A: open (fuzzy match, caches 220)
    await d.tick() // null: reset stabilization, no emit
    await d.tick() // B: re-fuzzed (230 in band) -> still open; without reset, exact compare to 220 would fail -> spurious close
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ leftPanelOpen: true, rightPanelOpen: false })
  })

  it('re-fingerprints when the frame size changes (no resize wedge)', async () => {
    const onChange = vi.fn()
    // Panel stays open, but the captured frame is resized between ticks.
    const frames: BitmapView[] = [openFrame(3840, 2160), openFrame(1920, 1080)]
    let i = 0
    const d = new PanelDetector({ capture: () => Promise.resolve(frames[i++]), samples: () => SAMPLES, onChange })
    await d.tick() // open at 3840x2160 -> caches 6px patches, verdict open
    await d.tick() // open at 1920x1080 -> must re-fingerprint at the new size and stay open (not spuriously close)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ leftPanelOpen: true, rightPanelOpen: false })
  })

  it('emits a close when a stabilized indicator stops matching, then a reopen', async () => {
    const onChange = vi.fn()
    const open = leftOpenFrame(220) // caches the open-panel pixels
    const closed = makeFrame(3840, 2160) // patches are black -> differ from cache -> exact-compare fails
    const frames: BitmapView[] = [open, closed, open]
    let i = 0
    const d = new PanelDetector({ capture: () => Promise.resolve(frames[i++]), samples: () => SAMPLES, onChange })
    await d.tick() // open -> verdict open
    await d.tick() // closed -> exact-compare fails -> verdict close
    await d.tick() // open again -> exact-compare matches cache -> reopen
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenNthCalledWith(1, { leftPanelOpen: true, rightPanelOpen: false })
    expect(onChange).toHaveBeenNthCalledWith(2, { leftPanelOpen: false, rightPanelOpen: false })
    expect(onChange).toHaveBeenNthCalledWith(3, { leftPanelOpen: true, rightPanelOpen: false })
  })
})
