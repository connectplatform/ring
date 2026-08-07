'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShoppingCart } from 'lucide-react'
import { followCheckoutRedirect } from '@/lib/payments/checkout-redirect'
import type { SerializedOpportunity } from '@/features/opportunities/types'
import { asCollectiveOrderMetadata } from '@/features/opportunities/types/type-metadata'
import { getClientCreditUnitLabel } from '@/lib/ring-config-client'
import type { Locale } from '@/i18n/shared'

interface CollectiveOrderSlotPanelProps {
  opportunity: SerializedOpportunity & { metadata?: unknown }
  onOpportunityPatch: (patch: Partial<SerializedOpportunity> & { metadata?: unknown }) => void
}

export function CollectiveOrderSlotPanel({
  opportunity,
  onOpportunityPatch,
}: CollectiveOrderSlotPanelProps) {
  const t = useTranslations('modules.opportunities')
  const locale = useLocale() as Locale
  const { data: session } = useSession()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rail, setRail] = useState<'credit_balance' | 'card' | 'paypal'>('credit_balance')

  const meta = asCollectiveOrderMetadata(opportunity.metadata)
  if (!meta) {
    return (
      <div className="mb-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {t('collectiveOrder.missingMetadata')}
      </div>
    )
  }

  const filled = meta.slotsFilled
  const total = meta.slotCount
  const open = meta.escrowStatus === 'open' && filled < total
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0

  const buy = () => {
    if (!session?.user?.id) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/opportunities/${opportunity.id}/collective-order/checkout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rail, locale }),
          },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || t('collectiveOrder.buyFailed'))

        if (typeof json.slotsFilled === 'number') {
          onOpportunityPatch({
            metadata: {
              ...(typeof opportunity.metadata === 'object' && opportunity.metadata
                ? opportunity.metadata
                : {}),
              ...meta,
              slotsFilled: json.slotsFilled,
              escrowStatus: json.opportunityClosed ? 'funded' : meta.escrowStatus,
            },
            ...(json.opportunityClosed
              ? ({ status: 'closed' } as Partial<SerializedOpportunity>)
              : {}),
          })
        }

        if (json.redirect) {
          followCheckoutRedirect(json.redirect)
          return
        }
        if (json.paymentUrl && !json.paid) {
          window.location.href = json.paymentUrl
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('collectiveOrder.buyFailed'))
      }
    })
  }

  return (
    <div className="mb-6 rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {t('collectiveOrder.title')}
        </h3>
        <Badge variant={open ? 'secondary' : 'outline'}>
          {open ? t('collectiveOrder.open') : t('collectiveOrder.closed')}
        </Badge>
      </div>

      <p className="mb-2 text-sm text-muted-foreground">
        {t('collectiveOrder.progress', { filled, total, price: meta.slotPrice, currency: meta.currency })}
      </p>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {open && session?.user ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {meta.rails.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={rail === r ? 'default' : 'outline'}
                onClick={() => setRail(r)}
              >
                {r === 'credit_balance'
                  ? getClientCreditUnitLabel()
                  : t(`collectiveOrder.rail.${r}`)}
              </Button>
            ))}
          </div>
          <Button className="sm:ml-auto" disabled={pending} onClick={buy}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('collectiveOrder.buySlot')}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
