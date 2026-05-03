import { useEffect, useState } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface CheatSheetPreviewState {
  src: string | null
  gameBounds: Rect | null
}

/** Single transparent click-through canvas window shared by every secondary
 *  overlay for visual extras that need to render outside the overlay's own
 *  bounds: snap-target ghosts during drag (a system feature), and consumer-
 *  specific layers like the cheat-sheet hover preview.
 *
 *  Each layer is its own IPC channel so consumers can opt in independently
 *  without coordinating through the canvas. */
export function App(): JSX.Element {
  const [snapGhost, setSnapGhost] = useState<Rect | null>(null)
  const [cheatSheetPreview, setCheatSheetPreview] = useState<CheatSheetPreviewState | null>(null)

  useEffect(() => window.api.onSecondaryOverlaySnapGhost((rect) => setSnapGhost(rect)), [])
  useEffect(() => window.api.onCheatSheetPreview((s) => setCheatSheetPreview(s)), [])

  return (
    <>
      {snapGhost && <SnapGhost rect={snapGhost} />}
      {cheatSheetPreview?.src && cheatSheetPreview.gameBounds && (
        <CheatSheetPreviewLayer src={cheatSheetPreview.src} gameBounds={cheatSheetPreview.gameBounds} />
      )}
    </>
  )
}

function SnapGhost({ rect }: { rect: Rect }): JSX.Element {
  return (
    <div
      className="fixed pointer-events-none border-2 border-dashed border-white/35 bg-white/20 transition-opacity duration-150 ease-linear"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: 6,
      }}
    />
  )
}

function CheatSheetPreviewLayer({ src, gameBounds }: { src: string; gameBounds: Rect }): JSX.Element {
  const PAD = 16
  return (
    <div
      className="fixed pointer-events-none flex items-center justify-center"
      style={{
        left: gameBounds.x,
        top: gameBounds.y,
        width: gameBounds.width,
        height: gameBounds.height,
        padding: PAD,
      }}
    >
      <img src={src} alt="" className="max-w-full max-h-full object-contain" />
    </div>
  )
}
