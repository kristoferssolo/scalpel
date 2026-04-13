import { useState, useRef, useEffect } from 'react'
import { SortFour } from '@icon-park/react'

interface ScrubInputProps {
  value: number | null
  onChange: (val: number | null) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export function ScrubInput({
  value,
  onChange,
  placeholder = '0',
  min = 0,
  max = 999,
  step = 1,
}: ScrubInputProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrubRef = useRef<{ startX: number; startVal: number } | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitEdit = () => {
    setEditing(false)
    const parsed = parseInt(editText)
    if (isNaN(parsed) || parsed <= 0) onChange(null)
    else onChange(Math.min(max, Math.max(min, parsed)))
  }

  const startScrub = (e: React.MouseEvent) => {
    if (editing) return
    e.preventDefault()
    scrubRef.current = { startX: e.clientX, startVal: value ?? 0 }
    document.body.style.cursor = 'ew-resize'
    document.body.classList.add('scrubbing')

    const onMove = (me: MouseEvent) => {
      if (!scrubRef.current) return
      const dx = me.clientX - scrubRef.current.startX
      const delta = Math.round(dx / 3) * step
      const newVal = Math.min(max, Math.max(min, scrubRef.current.startVal + delta))
      onChange(newVal > 0 ? newVal : null)
    }

    const onUp = () => {
      scrubRef.current = null
      document.body.style.cursor = ''
      document.body.classList.remove('scrubbing')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only enter edit mode if we didn't drag
    if (!scrubRef.current) {
      setEditText(value != null ? String(value) : '')
      setEditing(true)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-[60px] h-7 px-2 py-[2px] text-[13px] rounded-[3px] text-center bg-black/30 border border-accent"
        min={min}
        max={max}
      />
    )
  }

  return (
    <div
      onMouseDown={startScrub}
      onClick={handleClick}
      className="w-[70px] h-7 flex items-center justify-between px-2 rounded-[3px] text-[13px] select-none"
      style={{
        background: 'rgba(0,0,0,0.3)',
        cursor: 'ew-resize',
        color: value != null && value > 0 ? 'var(--text)' : 'var(--text-dim)',
      }}
    >
      <span>{value ?? 0}</span>
      <SortFour size={11} theme="outline" fill="currentColor" style={{ transform: 'rotate(90deg)', opacity: 0.35 }} />
    </div>
  )
}
