export function PointsHistogram({ rows }: { rows: { name: string; score: number }[] }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.score)))
  const hasNeg = rows.some((r) => r.score < 0)
  return (
    <div className={`flex items-stretch gap-3 ${hasNeg ? 'h-64' : 'h-52'}`}>
      {rows.map((row, i) => {
        const pct = Math.max(6, (Math.abs(row.score) / maxAbs) * 100)
        const positive = row.score >= 0
        return (
          <div key={`${row.name}-${i}`} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="text-xs font-semibold text-[color:var(--color-gold)]">
              {row.score > 0 ? '+' : ''}
              {row.score}
            </div>
            <div className={`mt-2 flex w-full flex-1 ${hasNeg ? 'flex-col' : 'flex-col justify-end'}`}>
              {hasNeg ? (
                <>
                  <div className="flex h-1/2 items-end justify-center">
                    {positive && (
                      <div
                        className="w-[70%] max-w-[3.5rem] rounded-t-md bg-[color:var(--color-gold)]"
                        style={{ height: `${pct}%` }}
                      />
                    )}
                  </div>
                  <div className="h-px w-full bg-white/20" />
                  <div className="flex h-1/2 items-start justify-center">
                    {!positive && row.score !== 0 && (
                      <div
                        className="w-[70%] max-w-[3.5rem] rounded-b-md bg-[color:var(--color-danger)]"
                        style={{ height: `${pct}%` }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-end justify-center">
                  <div
                    className="w-[70%] max-w-[3.5rem] rounded-t-md bg-[color:var(--color-gold)]"
                    style={{ height: `${pct}%` }}
                  />
                </div>
              )}
            </div>
            <div className="mt-2 w-full truncate text-center text-xs text-[color:var(--color-muted)]" title={row.name}>
              {row.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
