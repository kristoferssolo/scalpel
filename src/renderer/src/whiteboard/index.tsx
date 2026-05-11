import { useEffect, useState } from 'react'
import { Stage } from './canvas/Stage'
import { Toolbar } from './toolbar/Toolbar'
import { useWhiteboardStore } from './state/store'
import { createDebouncedSaver } from './state/persistence'
import type { BoardState } from '../../../shared/whiteboard-types'

declare global {
  interface Window {
    api: import('../../../preload/index').Api
  }
}

export function Whiteboard(): JSX.Element {
  const [version, setVersion] = useState<1 | 2 | null>(null)
  const replaceAll = useWhiteboardStore((s) => s.replaceAll)
  const markClean = useWhiteboardStore((s) => s.markClean)
  const mode = useWhiteboardStore((s) => s.mode)

  useEffect(() => {
    window.api.whiteboard.setMode(mode)
  }, [mode])

  // Tell main when an editable element inside the whiteboard window has focus
  // (the in-canvas text editor), so the hotkey gate can swallow keystrokes
  // that would otherwise stomp the user's typing. Mirrors the main overlay's
  // listener at src/renderer/src/overlay/App.tsx.
  useEffect(() => {
    const isEditable = (el: Element | null): boolean => {
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      return (el as HTMLElement).isContentEditable
    }
    let last = false
    const update = (): void => {
      const next = isEditable(document.activeElement)
      if (next !== last) {
        last = next
        window.api.setOverlayInputFocused(next)
      }
    }
    update()
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])

  // Discover PoE version once.
  useEffect(() => {
    window.api
      .getOverlayState()
      .then((s) => setVersion(s.poeVersion))
      .catch(() => setVersion(1))
  }, [])

  // Load active canvas once we know the version.
  useEffect(() => {
    if (version === null) return
    window.api.whiteboard
      .load(version, { w: window.innerWidth, h: window.innerHeight })
      .then((lib) => {
        replaceAll(lib.active.elements)
        markClean()
      })
      .catch(() => {
        // If load fails, start with an empty canvas.
        markClean()
      })
  }, [version, replaceAll, markClean])

  // Subscribe to dirty -> debounced save + listen for explicit flush IPC.
  useEffect(() => {
    if (version === null) return
    const saver = createDebouncedSaver<BoardState>((state) => {
      window.api.whiteboard.saveActive(version, state)
      useWhiteboardStore.getState().markClean()
    }, 500)

    const unsub = useWhiteboardStore.subscribe((s, prev) => {
      if (s.dirty && s.elements !== prev.elements) {
        saver.schedule({
          schemaVersion: 1,
          elements: s.elements,
          authoredAtGameSize: { w: window.innerWidth, h: window.innerHeight },
        })
      }
    })

    function flushOnUnload(): void {
      if (useWhiteboardStore.getState().dirty) {
        saver.flushNow()
      }
    }
    window.addEventListener('beforeunload', flushOnUnload)

    const unsubPleaseFlush = window.api.whiteboard.onPleaseFlush(() => {
      if (useWhiteboardStore.getState().dirty) saver.flushNow()
    })

    return () => {
      unsub()
      window.removeEventListener('beforeunload', flushOnUnload)
      unsubPleaseFlush()
      saver.cancel()
    }
  }, [version])

  if (version === null) return <></>

  return (
    <div className="w-full h-full relative bg-transparent">
      <Stage />
      <Toolbar version={version} />
    </div>
  )
}
