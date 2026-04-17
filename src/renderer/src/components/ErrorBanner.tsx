/**
 * Red slide-down error banner, absolutely positioned at the top of its
 * first positioned ancestor. Parent must be `position: relative`.
 */
export function ErrorBanner({ message }: { message: string | null }): JSX.Element {
  return (
    <div
      className="overflow-hidden transition-all duration-200 absolute left-0 right-0 top-0 z-10"
      style={{
        maxHeight: message ? 32 : 0,
        opacity: message ? 1 : 0,
      }}
    >
      <div className="bg-[#b71c1c] text-white text-[11px] font-semibold px-3 py-[7px] text-center">{message}</div>
    </div>
  )
}
