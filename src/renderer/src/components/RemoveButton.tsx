import { CloseSmall } from '@icon-park/react'

export function RemoveButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-5 h-5 shrink-0 rounded bg-white/[0.06] border-none cursor-pointer text-text-dim p-0 hover:bg-[rgba(239,83,80,0.2)] hover:text-white"
    >
      <CloseSmall size={14} theme="outline" fill="currentColor" className="flex" />
    </button>
  )
}
