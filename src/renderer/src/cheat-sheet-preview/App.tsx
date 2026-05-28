import { useEffect, useState } from 'react'

/** Renders the hover preview image inside a dedicated transparent click-through
 *  window sized by the main process to match PoE's bounds. Because the window's
 *  bounds align with a single display, Chromium assigns it the correct per-
 *  monitor devicePixelRatio - so w-full/h-full fills the game window cleanly at
 *  any Windows display scale, no DIP/physical arithmetic needed at the call
 *  site. (The shared full-desktop canvas couldn't do this: spanning mixed-DPI
 *  monitors forces one dpr, which leaves CSS px and physical px out of sync on
 *  any monitor that doesn't match the chosen scale.) */
export function App(): JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => window.api.onCheatSheetPreview((state) => setSrc(state.src)), [])
  if (!src) return <div />
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
      <img src={src} alt="" className="w-full h-full object-contain" />
    </div>
  )
}
