'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { processDueSettlementsAction } from '@/app/_actions/admin-store-erp'
import type { Settlement } from '@/features/store/services/settlement'
import type { ProductReferralRateRow } from '@/app/_actions/admin-store-erp'

interface AdminCommissionsClientProps {
  settlements: Settlement[]
  productReferralRates: ProductReferralRateRow[]
  labels: {
    title: string
    processPayouts: string
    processing: string
    pending: string
    vendor: string
    amount: string
    commission: string
    status: string
    scheduled: string
    noSettlements: string
    settlementsTable: string
    confirmProcessPayouts: string
    noSettlementsDueMessage: string
    batchComplete: string
    processSettlementsError: string
    inclReferral: string
    referralRatesTitle: string
    referralRatesProduct: string
    referralRatesVendor: string
    referralRatesPercent: string
    referralRatesSource: string
    referralRatesEmpty: string
    referralSourceProduct: string
    referralSourceMerchant: string
    referralSourceDefault: string
    referralSourceEnv: string
    effectiveReferralRate: string
    simulatedBadge: string
  }
}

function sourceLabel(
  source: ProductReferralRateRow['source'],
  labels: AdminCommissionsClientProps['labels'],
): string {
  switch (source) {
    case 'product':
      return labels.referralSourceProduct
    case 'merchant':
      return labels.referralSourceMerchant
    case 'env':
      return labels.referralSourceEnv
    default:
      return labels.referralSourceDefault
  }
}

export default function AdminCommissionsClient({
  settlements,
  productReferralRates,
  labels,
}: AdminCommissionsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingCount = settlements.filter((s) => s.status === 'pending').length

  const handleProcessPayouts = () => {
    if (!confirm(labels.confirmProcessPayouts)) return
    startTransition(async () => {
      setError(null)
      setMessage(null)
      try {
        const result = await processDueSettlementsAction()
        const batch = result.batch
        if (!batch) {
          setMessage(labels.noSettlementsDueMessage)
        } else {
          setMessage(
            labels.batchComplete
              .replace('{batchId}', batch.id)
              .replace('{completed}', String(batch.completedCount))
              .replace('{failed}', String(batch.failedCount)),
          )
        }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : labels.processSettlementsError)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{labels.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {labels.pending}: {pendingCount}
          </p>
        </div>
        <Button onClick={handleProcessPayouts} disabled={isPending || pendingCount === 0}>
          {isPending ? labels.processing : labels.processPayouts}
        </Button>
      </div>

      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.settlementsTable}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noSettlements}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{labels.vendor}</th>
                  <th className="py-2 pr-4">{labels.amount}</th>
                  <th className="py-2 pr-4">{labels.commission}</th>
                  <th className="py-2 pr-4">{labels.status}</th>
                  <th className="py-2">{labels.scheduled}</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{s.vendorId}</td>
                    <td className="py-2 pr-4">
                      {s.netPayout.toFixed(2)} {s.currency}
                    </td>
                    <td className="py-2 pr-4">
                      {s.commission.toFixed(2)}
                      {(s.metadata?.referralCommission ??
                        s.metadata?.commissionBreakdown?.referralCommission) != null && (
                        <span className="block text-xs text-muted-foreground">
                          {labels.inclReferral.replace(
                            '{amount}',
                            String(
                              s.metadata?.referralCommission ??
                                s.metadata?.commissionBreakdown?.referralCommission,
                            ),
                          )}
                          {s.metadata?.referralEffectivePercent != null ||
                          s.metadata?.commissionBreakdown?.referralEffectivePercent != null ? (
                            <span className="block">
                              {labels.effectiveReferralRate.replace(
                                '{percent}',
                                (
                                  s.metadata?.referralEffectivePercent ??
                                  s.metadata?.commissionBreakdown?.referralEffectivePercent
                                )?.toFixed(1) ?? '—',
                              )}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>
                        {s.status}
                      </Badge>
                      {(s.metadata?.simulated === true ||
                        (typeof s.transactionId === 'string' &&
                          (s.transactionId.startsWith('sim_') ||
                            s.transactionId.startsWith('ring_tx_')))) && (
                        <Badge variant="outline" className="ml-1 text-amber-600 border-amber-500/40">
                          {labels.simulatedBadge}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(s.scheduledFor).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.referralRatesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {productReferralRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.referralRatesEmpty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{labels.referralRatesProduct}</th>
                  <th className="py-2 pr-4">{labels.referralRatesVendor}</th>
                  <th className="py-2 pr-4">{labels.referralRatesPercent}</th>
                  <th className="py-2">{labels.referralRatesSource}</th>
                </tr>
              </thead>
              <tbody>
                {productReferralRates.map((row) => (
                  <tr key={row.productId} className="border-b border-border/50">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.vendorEntityId}</td>
                    <td className="py-2 pr-4">{row.effectivePercent}%</td>
                    <td className="py-2 text-muted-foreground">{sourceLabel(row.source, labels)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
