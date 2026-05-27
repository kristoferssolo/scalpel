import type { PanelSample } from './match'

/** Panel sample tables, harvested from ifnjeff/poe-rangefinder (approxSamples).
 *  Indices 0-3 detect the left panel, 4-7 the right. Positions are in a
 *  3840x2160 reference frame (negative x = measured from the right edge), scaled
 *  by frame height at runtime. RGB values are inclusive tolerance bands. PoE2 is
 *  null until calibrated, which keeps the detector idle there (mirrors the
 *  CAMERA_CONSTANTS null-for-unsupported pattern in poe-projection.ts). */
export const PANEL_SAMPLES: Record<1 | 2, PanelSample[] | null> = {
  1: [
    { side: 'left', pos: { x: 669, y: 111 }, rgbMin: { r: 215, g: 183, b: 123 }, rgbMax: { r: 228, g: 191, b: 132 } },
    { side: 'left', pos: { x: 18, y: 27 }, rgbMin: { r: 7, g: 11, b: 11 }, rgbMax: { r: 10, g: 16, b: 16 } },
    { side: 'left', pos: { x: 18, y: 1791 }, rgbMin: { r: 11, g: 11, b: 15 }, rgbMax: { r: 25, g: 26, b: 27 } },
    { side: 'left', pos: { x: 969, y: 1896 }, rgbMin: { r: 19, g: 20, b: 26 }, rgbMax: { r: 28, g: 31, b: 41 } },
    { side: 'right', pos: { x: -648, y: 111 }, rgbMin: { r: 213, g: 175, b: 114 }, rgbMax: { r: 225, g: 192, b: 131 } },
    { side: 'right', pos: { x: -75, y: 39 }, rgbMin: { r: 4, g: 11, b: 11 }, rgbMax: { r: 9, g: 15, b: 15 } },
    { side: 'right', pos: { x: -36, y: 1761 }, rgbMin: { r: 15, g: 17, b: 18 }, rgbMax: { r: 23, g: 25, b: 29 } },
    { side: 'right', pos: { x: -1299, y: 1890 }, rgbMin: { r: 14, g: 18, b: 17 }, rgbMax: { r: 22, g: 23, b: 25 } },
  ],
  2: null,
}
