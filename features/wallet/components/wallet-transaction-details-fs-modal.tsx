'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2 } from 'lucide-react'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import { Button } from '@/components/ui/button'
import { getWalletTransactionDetails } from '@/app/_actions/wallet'
import { getClientNativeTokenSymbol, getClientCreditUnitLabel } from '@/lib/ring-config-client'
import { cn } from '@/lib/utils'

export type WalletTransactionDetailSource = 'chain' | 'credit'

export interface WalletTransactionDetailsFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailId: string | null
  detailSource: WalletTransactionDetailSource | null
}

type DetailPayload = NonNullable<
  Awaited<ReturnType<typeof getWalletTransactionDetails>>['detail']
>

function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2 border-b border-border/50', className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-sm text-right break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  )
}

export default function WalletTransactionDetailsFsModal({
  open,
  onOpenChange,
  detailId,
  detailSource,
}: WalletTransactionDetailsFsModalProps) {
  const t = useTranslations('modules.wallet.transactionDetails')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailPayload | null>(null)

  useEffect(() => {
    if (!open || !detailId || !detailSource) {
      setDetail(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void getWalletTransactionDetails({ detailId, detailSource })
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.detail) {
          setError(res.error || t('loadFailed'))
          setDetail(null)
          return
        }
        setDetail(res.detail)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : t('loadFailed'))
        setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, detailId, detailSource, t])

  const currency =
    detail?.currency ||
    detail?.tokenSymbol ||
    (detail?.source === 'credit' ? getClientCreditUnitLabel() : getClientNativeTokenSymbol())

  return (
    <WalletFsModal open={open} onOpenChange={onOpenChange} title={t('title')}>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-6 text-center">{error}</p>
      ) : detail ? (
        <div className="space-y-1 pb-4">
          <DetailRow label={t('kind')} value={detail.kind} />
          <DetailRow
            label={t('amount')}
            value={`${detail.amount} ${currency}`}
          />
          {detail.amountRaw ? (
            <DetailRow label={t('amountRaw')} value={detail.amountRaw} mono />
          ) : null}
          <DetailRow
            label={t('createdAt')}
            value={new Date(detail.createdAt).toLocaleString()}
          />
          {detail.description ? (
            <DetailRow label={t('description')} value={detail.description} />
          ) : null}
          {detail.status ? <DetailRow label={t('status')} value={detail.status} /> : null}
          {detail.chain ? <DetailRow label={t('chain')} value={detail.chain} /> : null}
          {detail.fromAddress ? (
            <DetailRow label={t('from')} value={detail.fromAddress} mono />
          ) : null}
          {detail.toAddress ? (
            <DetailRow label={t('to')} value={detail.toAddress} mono />
          ) : null}
          {detail.contactDisplayName || detail.contactUsername ? (
            <DetailRow
              label={t('contact')}
              value={
                detail.contactUsername
                  ? `${detail.contactDisplayName || detail.contactUsername} (@${detail.contactUsername})`
                  : detail.contactDisplayName
              }
            />
          ) : null}
          {detail.txHash ? <DetailRow label={t('txHash')} value={detail.txHash} mono /> : null}
          {detail.slot != null ? <DetailRow label={t('slot')} value={String(detail.slot)} /> : null}
          {detail.blockTime != null ? (
            <DetailRow
              label={t('blockTime')}
              value={new Date(detail.blockTime * 1000).toLocaleString()}
            />
          ) : null}
          {detail.feeLamports != null ? (
            <DetailRow label={t('fee')} value={`${detail.feeLamports} lamports`} />
          ) : null}
          {detail.deskOrderId ? (
            <DetailRow label={t('deskOrder')} value={detail.deskOrderId} mono />
          ) : null}
          {detail.err ? (
            <DetailRow label={t('error')} value={detail.err} className="text-destructive" />
          ) : null}

          {detail.explorerUrl ? (
            <div className="pt-4">
              <Button asChild variant="outline" className="w-full">
                <a href={detail.explorerUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('viewOnExplorer')}
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </WalletFsModal>
  )
}
