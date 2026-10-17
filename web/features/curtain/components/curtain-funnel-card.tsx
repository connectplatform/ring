import type { CurtainFunnelCounts } from '@/features/curtain/types'

export function CurtainFunnelCard({
  title,
  funnel,
  labels,
  policyLabel,
  credits,
}: {
  title: string
  funnel: CurtainFunnelCounts
  policyLabel?: string
  credits?: string
  labels: {
    shown: string
    resurfaced: string
    cta: string
    notToday: string
    notForMe: string
    scroll: string
    paid: string
    credits: string
  }
}) {
  const rows = [
    [labels.shown, funnel.shown],
    [labels.resurfaced, funnel.resurfaced],
    [labels.cta, funnel.cta],
    [labels.notToday, funnel.notToday],
    [labels.notForMe, funnel.notForMe],
    [labels.scroll, funnel.scrollAway],
    [labels.paid, funnel.paid],
  ] as const

  return (
    <section className="mb-6 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{title}</h2>
      {policyLabel ? <p className="mt-1 text-xs text-muted-foreground">{policyLabel}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
        {credits != null ? (
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{labels.credits}</dt>
            <dd className="text-lg font-semibold tabular-nums">{credits}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
