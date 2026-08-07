'use client'

import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  holdSettlementAction,
  previewDueSettlementsAction,
  processDueSettlementsAction,
  releaseHeldSettlementAction,
} from '@/app/_actions/admin-store-erp'
import type { Settlement } from '@/features/store/services/settlement'
import type { ProductReferralRateRow } from '@/app/_actions/admin-store-erp'

interface AdminCommissionsClientProps {
  settlements: Settlement[]
  productReferralRates: ProductReferralRateRow[]
}

type StatusFilter = 'all' | 'pending' | 'held' | 'completed'

export default function AdminCommissionsClient({
  settlements,
  productReferralRates,
}: AdminCommissionsClientProps) {
  const router = useRouter()
  const t = useTranslations('modules.admin.storeHub')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dryRun, setDryRun] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return settlements
    return settlements.filter((s) => s.status === statusFilter)
  }, [settlements, statusFilter])

  const pendingCount = settlements.filter((s) => s.status === 'pending').length

  const sourceLabel = (source: ProductReferralRateRow['source']): string => {
    switch (source) {
      case 'product':
        return t('referralSource.product')
      case 'merchant':
        return t('referralSource.merchant')
      case 'env':
        return t('referralSource.env')
      default:
        return t('referralSource.default')
    }
  }

  const handleDryRun = () => {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      try {
        const preview = await previewDueSettlementsAction()
        setDryRun(
          t('dryRunResult', {
            due: preview.dueCount,
            pending: preview.pendingCount,
            total: preview.totalNet.toFixed(2),
          }),
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : t('processSettlementsError'))
      }
    })
  }

  const handleProcessPayouts = () => {
    if (!confirm(t('confirmProcessPayouts'))) return
    startTransition(async () => {
      setError(null)
      setMessage(null)
      try {
        const result = await processDueSettlementsAction()
        const batch = result.batch
        if (!batch) {
          setMessage(t('noSettlementsDueMessage'))
        } else {
          setMessage(
            t('batchComplete', {
              batchId: batch.id,
              completed: batch.completedCount,
              failed: batch.failedCount,
            }),
          )
        }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('processSettlementsError'))
      }
    })
  }

  const handleHold = (id: string) => {
    const reason = window.prompt(t('holdReasonPrompt'), 'Admin hold')
    if (reason == null) return
    startTransition(async () => {
      setError(null)
      try {
        await holdSettlementAction(id, reason)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('holdError'))
      }
    })
  }

  const handleRelease = (id: string) => {
    startTransition(async () => {
      setError(null)
      try {
        await releaseHeldSettlementAction(id)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('releaseError'))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('commissionsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('pendingSettlements')}: {pendingCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDryRun} disabled={isPending}>
            {t('dryRunPayouts')}
          </Button>
          <Button onClick={handleProcessPayouts} disabled={isPending || pendingCount === 0}>
            {isPending ? t('processingPayouts') : t('processPayouts')}
          </Button>
        </div>
      </div>

      {dryRun && <p className="text-sm text-muted-foreground">{dryRun}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-1 flex-wrap">
        {(['all', 'pending', 'held', 'completed'] as StatusFilter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={statusFilter === f ? 'default' : 'outline'}
            onClick={() => setStatusFilter(f)}
          >
            {t(`settlementFilter.${f}`)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settlementsTable')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSettlements')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{t('vendor')}</th>
                  <th className="py-2 pr-4">{t('netPayout')}</th>
                  <th className="py-2 pr-4">{t('commission')}</th>
                  <th className="py-2 pr-4">{t('status')}</th>
                  <th className="py-2 pr-4">{t('scheduledFor')}</th>
                  <th className="py-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
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
                          {t('inclReferral', {
                            amount: String(
                              s.metadata?.referralCommission ??
                                s.metadata?.commissionBreakdown?.referralCommission,
                            ),
                          })}
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
                          {t('simulatedBadge')}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(s.scheduledFor).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {s.status === 'pending' && (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleHold(s.id)}>
                          {t('hold')}
                        </Button>
                      )}
                      {s.status === 'held' && (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleRelease(s.id)}>
                          {t('release')}
                        </Button>
                      )}
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
          <CardTitle className="text-base">{t('referralRatesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {productReferralRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('referralRatesEmpty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{t('referralRatesProduct')}</th>
                  <th className="py-2 pr-4">{t('referralRatesVendor')}</th>
                  <th className="py-2 pr-4">{t('referralRatesPercent')}</th>
                  <th className="py-2">{t('referralRatesSource')}</th>
                </tr>
              </thead>
              <tbody>
                {productReferralRates.map((row) => (
                  <tr key={row.productId} className="border-b border-border/50">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.vendorEntityId}</td>
                    <td className="py-2 pr-4">{row.effectivePercent}%</td>
                    <td className="py-2 text-muted-foreground">{sourceLabel(row.source)}</td>
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
