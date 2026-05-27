import { describe, expect, it } from 'vitest'
import type { RadiusRingElement, RulerElement } from '../../../../../shared/whiteboard-types'
import { groundToScreen, screenToGround } from '../poe-projection'
import { elementAabbPx } from './select'

const size = { w: 1920, h: 1080 }

const ruler: RulerElement = {
  id: 'u',
  z: 0,
  rotation: 0,
  type: 'ruler',
  a: { x: 0, y: 0 },
  b: { x: 30, y: 20 },
  stroke: '#fff',
  strokeWidth: 0.0035,
}
const ring: RadiusRingElement = {
  id: 'r',
  z: 0,
  rotation: 0,
  type: 'radiusRing',
  center: { x: 0, y: 0 },
  radius: 40,
  stroke: '#fff',
  strokeWidth: 0.0035,
  fill: null,
}

describe('elementAabbPx for distance kinds', () => {
  it('bounds a ruler from its projected endpoints', () => {
    const box = elementAabbPx(ruler, size, 1)
    const a = groundToScreen(1, ruler.a, size)!
    const b = groundToScreen(1, ruler.b, size)!
    expect(box.x).toBeCloseTo(Math.min(a.x, b.x) * size.w, 2)
    expect(box.w).toBeGreaterThan(0)
    expect(box.h).toBeGreaterThan(0)
  })

  it('bounds a radiusRing from its projected ellipse', () => {
    const box = elementAabbPx(ring, size, 1)
    expect(box.w).toBeGreaterThan(0)
    expect(box.h).toBeGreaterThan(0)
  })

  it('returns a zero box when version is omitted', () => {
    expect(elementAabbPx(ruler, size)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(elementAabbPx(ring, size)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })

  it('elementAabbPx shifts a ruler box by clipNdcX', () => {
    const clip = 0.1
    const a = screenToGround(1, { x: 0.4, y: 0.5 }, size, clip)!
    const b = screenToGround(1, { x: 0.6, y: 0.5 }, size, clip)!
    const rulerC = { id: 'k', z: 0, rotation: 0, type: 'ruler' as const, a, b, stroke: '#fff', strokeWidth: 0.01 }
    const box0 = elementAabbPx(rulerC, size, 1, 0)
    const boxC = elementAabbPx(rulerC, size, 1, clip)
    expect(boxC.x - box0.x).toBeCloseTo(clip * (size.w / 2), 2) // width==size.w at 16:9
  })
})
