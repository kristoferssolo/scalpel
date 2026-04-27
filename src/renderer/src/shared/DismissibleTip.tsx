import { useState } from 'react'
import { CloseSmall } from '@icon-park/react'

const TIP_KEY_PREFIX = 'tip.'

interface DismissibleTipProps {
  /** Unique id for this tip; persists dismissal at `tip.<id>.dismissed` in localStorage. */
  id: string
  children: React.ReactNode
}

export function DismissibleTip({ id, children }: DismissibleTipProps): JSX.Element | null {
  const key = `${TIP_KEY_PREFIX}${id}.dismissed`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1')
  if (dismissed) return null
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px]"
      style={{
        background: 'rgba(200, 169, 110, 0.10)',
        border: '1px solid rgba(200, 169, 110, 0.45)',
        color: 'var(--accent)',
      }}
    >
      <span
        className="flex items-center justify-center rounded-full text-[9px] font-bold shrink-0"
        style={{ width: 14, height: 14, background: 'var(--accent)', color: '#0a0a0a' }}
      >
        i
      </span>
      <span className="flex-1">{children}</span>
      <CloseSmall
        size={12}
        theme="outline"
        fill="currentColor"
        className="cursor-pointer opacity-60 hover:opacity-100 shrink-0"
        onClick={() => {
          localStorage.setItem(key, '1')
          setDismissed(true)
        }}
      />
    </div>
  )
}
