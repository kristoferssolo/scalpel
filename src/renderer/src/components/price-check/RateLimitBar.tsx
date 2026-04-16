export function RateLimitBar({
  rateLimitTiers,
}: {
  rateLimitTiers: Array<{ used: number; max: number; window: number; penalty: number }>
}): JSX.Element | null {
  const first = rateLimitTiers[0]
  const pct = first ? first.used / first.max : 0
  const hasPenalty = rateLimitTiers.some((t) => t.penalty > 0)
  const barColor = hasPenalty
    ? '#c44'
    : pct > 0.8
      ? '#c44'
      : pct > 0.5
        ? '#b8943a'
        : pct > 0
          ? '#3a7a3a'
          : 'rgba(255,255,255,0.06)'
  return (
    <div
      className="rate-limit-bar px-[14px] py-1 flex items-center gap-2 border-t border-border relative"
      onMouseMove={(e) => {
        const tip = e.currentTarget.querySelector('.rate-limit-tooltip') as HTMLElement
        if (tip) {
          const rect = e.currentTarget.getBoundingClientRect()
          const tipWidth = tip.offsetWidth
          const x = e.clientX - rect.left
          const minX = tipWidth / 2
          const maxX = rect.width - tipWidth / 2
          tip.style.left = `${Math.max(minX, Math.min(x, maxX))}px`
        }
      }}
    >
      <div className="flex-1 h-[3px] rounded-sm bg-white/[0.08] overflow-hidden">
        <div
          className="h-full rounded-sm transition-[width] duration-[400ms] ease-[ease]"
          style={{
            width: `${Math.min(100, pct * 100)}%`,
            background: barColor,
            ...(hasPenalty ? { animation: 'pulse-red 1s ease-in-out infinite' } : {}),
          }}
        />
      </div>
      {hasPenalty && (
        <span className="text-[9px] text-[#ef5350] font-semibold">
          {rateLimitTiers.find((t) => t.penalty > 0)!.penalty}s
        </span>
      )}
      <div className="rate-limit-tooltip absolute bottom-full mb-[6px] -translate-x-1/2 px-[10px] py-[6px] bg-bg-card border border-border rounded text-[10px] text-text-dim whitespace-nowrap pointer-events-none opacity-0 transition-opacity duration-150 flex flex-col gap-[2px]">
        <div className="font-semibold text-text mb-[2px]">Trade API Rate Limit</div>
        {rateLimitTiers.map((t, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span>
              {t.used}/{t.max}
            </span>
            <span className="text-text-dim">per {t.window}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}
