/**
 * Slide-down banner, absolutely positioned at the top of its first positioned
 * ancestor. Parent must be `position: relative`. `tone` defaults to 'error' (red);
 * 'warn' renders orange for advisory messages.
 */
export function ErrorBanner({
  message,
  tone = 'error',
}: {
  message: string | null
  tone?: 'error' | 'warn'
}): JSX.Element {
  const bg = tone === 'warn' ? 'bg-[#e67e22]' : 'bg-[#b71c1c]'
  return (
    <div
      className="overflow-hidden transition-all duration-200 absolute left-0 right-0 top-0 z-10"
      style={{
        maxHeight: message ? 32 : 0,
        opacity: message ? 1 : 0,
      }}
    >
      <div className={`${bg} text-white text-[11px] font-semibold px-3 py-[7px] text-center`}>{message}</div>
    </div>
  )
}
