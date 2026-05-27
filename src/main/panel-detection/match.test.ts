import { describe, expect, it } from 'vitest'
import {
  type BitmapView,
  type PanelSample,
  matchPatchExact,
  matchPatchFuzzy,
  patchRect,
  readPatch,
  votePanels,
} from './match'

function makeFrame(width: number, height: number, fill: [number, number, number] = [0, 0, 0]): BitmapView {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[2] // B
    data[i * 4 + 1] = fill[1] // G
    data[i * 4 + 2] = fill[0] // R
    data[i * 4 + 3] = 255 // A
  }
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

const LEFT: PanelSample = {
  side: 'left',
  pos: { x: 100, y: 100 },
  rgbMin: { r: 200, g: 100, b: 50 },
  rgbMax: { r: 210, g: 110, b: 60 },
}

describe('patchRect', () => {
  it('scales position and size by frame height (2160 reference)', () => {
    const r = patchRect(LEFT, makeFrame(3840, 2160))
    expect(r).toEqual({ x: 100, y: 100, size: 6 })
  })

  it('anchors negative x to the right edge', () => {
    const right: PanelSample = { ...LEFT, side: 'right', pos: { x: -648, y: 111 } }
    const r = patchRect(right, makeFrame(3840, 2160))
    expect(r.x).toBe(3840 - 648)
  })

  it('halves coordinates at half height', () => {
    const r = patchRect(LEFT, makeFrame(1920, 1080))
    expect(r).toEqual({ x: 50, y: 50, size: 3 })
  })
})

describe('matchPatchFuzzy', () => {
  it('is true when every patch pixel is within the band', () => {
    const f = makeFrame(3840, 2160)
    fillPatch(f, LEFT, 205, 105, 55)
    expect(matchPatchFuzzy(f, LEFT)).toBe(true)
  })

  it('is false when any patch pixel is out of band', () => {
    const f = makeFrame(3840, 2160)
    fillPatch(f, LEFT, 205, 105, 55)
    const rect = patchRect(LEFT, f)
    const off = (rect.y * f.width + rect.x) * 4
    f.data[off + 2] = 0 // make R out of band
    expect(matchPatchFuzzy(f, LEFT)).toBe(false)
  })

  it('is false when the patch overruns the frame edge', () => {
    // x = 3838 -> patch spans 3838..3844, past the 3840 right edge.
    const over: PanelSample = { ...LEFT, pos: { x: 3838, y: 100 } }
    const f = makeFrame(3840, 2160)
    expect(matchPatchFuzzy(f, over)).toBe(false)
  })
})

describe('readPatch / matchPatchExact', () => {
  it('matches identical cached pixels and rejects altered ones', () => {
    const f = makeFrame(3840, 2160)
    fillPatch(f, LEFT, 205, 105, 55)
    const rect = patchRect(LEFT, f)
    const cached = readPatch(f, rect)
    expect(matchPatchExact(f, rect, cached)).toBe(true)
    const off = (rect.y * f.width + rect.x) * 4
    f.data[off + 1] = 0 // change one pixel
    expect(matchPatchExact(f, rect, cached)).toBe(false)
  })
})

describe('votePanels', () => {
  const samples: PanelSample[] = [
    { ...LEFT, pos: { x: 0, y: 0 } },
    { ...LEFT, pos: { x: 0, y: 0 } },
    { ...LEFT, pos: { x: 0, y: 0 } },
    { ...LEFT, pos: { x: 0, y: 0 } },
    { ...LEFT, side: 'right', pos: { x: 0, y: 0 } },
    { ...LEFT, side: 'right', pos: { x: 0, y: 0 } },
    { ...LEFT, side: 'right', pos: { x: 0, y: 0 } },
    { ...LEFT, side: 'right', pos: { x: 0, y: 0 } },
  ]

  it('opens a side at >= 2 matches and not at 1', () => {
    expect(votePanels(samples, [true, false, false, false, false, false, false, false])).toEqual({
      leftPanelOpen: false,
      rightPanelOpen: false,
    })
    expect(votePanels(samples, [true, true, false, false, false, false, false, false])).toEqual({
      leftPanelOpen: true,
      rightPanelOpen: false,
    })
    expect(votePanels(samples, [false, false, false, false, true, true, true, false])).toEqual({
      leftPanelOpen: false,
      rightPanelOpen: true,
    })
  })
})
