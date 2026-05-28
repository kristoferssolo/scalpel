import type { PanelSample } from './match'

/** Panel sample tables. Positions are in a 3840x2160 reference frame (negative
 *  x = measured from the right edge), scaled by frame height at runtime; RGB
 *  values are inclusive tolerance bands. A side reads "open" when >=2 of its
 *  samples match. PoE1 was harvested from ifnjeff/poe-rangefinder (approxSamples,
 *  4 left + 4 right). PoE2 was harvested from in-game captures: gold title-header
 *  filigree (zone-independent) plus the inventory's dark-red equipment-slot
 *  backing - 3 left + 4 right (only 3 reliably-gold spots exist on the stash
 *  header; the rest of the panel is dark grid that would false-match dark zones). */
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
  2: [
    { side: 'left', pos: { x: 528, y: 140 }, rgbMin: { r: 237, g: 216, b: 143 }, rgbMax: { r: 255, g: 251, b: 178 } },
    { side: 'left', pos: { x: 669, y: 128 }, rgbMin: { r: 235, g: 216, b: 144 }, rgbMax: { r: 255, g: 245, b: 173 } },
    { side: 'left', pos: { x: 777, y: 128 }, rgbMin: { r: 201, g: 172, b: 97 }, rgbMax: { r: 244, g: 219, b: 145 } },
    { side: 'right', pos: { x: -809, y: 144 }, rgbMin: { r: 239, g: 219, b: 145 }, rgbMax: { r: 255, g: 249, b: 175 } },
    { side: 'right', pos: { x: -553, y: 144 }, rgbMin: { r: 215, g: 187, b: 115 }, rgbMax: { r: 244, g: 217, b: 142 } },
    { side: 'right', pos: { x: -738, y: 224 }, rgbMin: { r: 34, g: 0, b: 0 }, rgbMax: { r: 51, g: 13, b: 13 } },
    { side: 'right', pos: { x: -177, y: 253 }, rgbMin: { r: 35, g: 0, b: 0 }, rgbMax: { r: 51, g: 13, b: 13 } },
  ],
}
