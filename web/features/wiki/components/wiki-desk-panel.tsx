'use client'

import { WikiWorkspace } from '@/features/wiki/components/wiki-workspace'

/** Buyer / integrator desk panel for a project_order wiki vault. */
export function WikiDeskPanel({
  orderId,
  locale,
  appendOnlyTenantHint = false,
}: {
  orderId: string
  locale: string
  /** When true, show note that tenant vault is append-only for integrators (project vault stays full R/W) */
  appendOnlyTenantHint?: boolean
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold">Project Wiki</h2>
        <p className="text-sm text-muted-foreground">
          Markdown knowledge for this ring clone project. Use [[@Page]] to link tenant concepts.
          Never store secrets here — use Order Lab secrets instead.
        </p>
        {appendOnlyTenantHint ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Integrators: tenant vault writes are append-only; this project vault is full read/write.
          </p>
        ) : null}
      </div>
      <WikiWorkspace locale={locale} lockedOrderId={orderId} />
    </section>
  )
}
