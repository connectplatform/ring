'use client'

/**
 * Chat widget for native-token payment requests.
 * TODO(public-invoice): QR / shareable invoice link without a contact — deferred.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Receipt, Loader2, Eye } from 'lucide-react'
import type { Message, PaymentRequestMetadata } from '@/features/chat/types'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { cancelNativeTokenPaymentRequest } from '@/app/_actions/wallet'
import WalletPayRequestFsModal from '@/features/wallet/components/wallet-pay-request-fs-modal'
import WalletTransactionDetailsFsModal from '@/features/wallet/components/wallet-transaction-details-fs-modal'

function parsePaymentRequest(message: Message): PaymentRequestMetadata | null {
  const meta = message.metadata
  if (meta && meta.kind === 'payment_request' && typeof meta.amount === 'string') {
    return meta as unknown as PaymentRequestMetadata
  }
  if (message.type !== 'payment_request') return null
  const match = message.content.match(/Payment request:\s*([\d.]+)\s+(\S+)/i)
  if (!match) return null
  return {
    kind: 'payment_request',
    amount: match[1],
    tokenSymbol: match[2],
    requesterUserId: message.senderId,
    requesterWalletAddress: '',
    status: 'pending',
    note: message.content.includes('\n')
      ? message.content.split('\n').slice(1).join('\n').trim() || undefined
      : undefined,
  }
}

export interface PaymentRequestMessageWidgetProps {
  message: Message
  isOwn: boolean
  className?: string
}

export default function PaymentRequestMessageWidget({
  message,
  isOwn,
  className,
}: PaymentRequestMessageWidgetProps) {
  const t = useTranslations('modules.wallet.paymentRequest')
  const tCommon = useTranslations('common')
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [localMeta, setLocalMeta] = useState<Partial<PaymentRequestMetadata> | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (isOwn) return
    let cancelled = false
    void fetch('/api/wallet/list', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { wallets: [] }))
      .then((data: { wallets?: WalletInfo[] }) => {
        if (!cancelled) setWallets(data.wallets ?? [])
      })
      .catch(() => {
        if (!cancelled) setWallets([])
      })
    return () => {
      cancelled = true
    }
  }, [isOwn])

  const base = parsePaymentRequest(message)
  const request = useMemo(() => {
    if (!base) return null
    return { ...base, ...localMeta } as PaymentRequestMetadata
  }, [base, localMeta])

  const primaryWallet = wallets.find((w) => w.isPrimary) ?? wallets[0]

  if (!request) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const token = request.tokenSymbol || getClientNativeTokenSymbol()
  const status = request.status
  const canPay = !isOwn && status === 'pending'
  const canCancel = isOwn && status === 'pending'
  const paidTxId = request.paidWalletTxId

  const handleCancel = async () => {
    try {
      setCancelling(true)
      const result = await cancelNativeTokenPaymentRequest({ messageId: message.id })
      if (!result.success) throw new Error(result.error || t('cancelFailed'))
      setLocalMeta({ status: 'cancelled', cancelledAt: new Date().toISOString() })
      toast({ title: tCommon('success'), description: t('cancelSuccess') })
      setCancelOpen(false)
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('cancelFailed'),
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'min-w-[220px] space-y-2 rounded-lg border p-3',
          status === 'paid' &&
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50',
          status === 'cancelled' &&
            'border-border/40 bg-muted/50 text-muted-foreground opacity-80',
          status === 'pending' && 'border-border/60 bg-background/40',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Receipt className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
            <span className="truncate">{t('title', { amount: request.amount, token })}</span>
          </div>
          {status === 'paid' && (
            <span className="shrink-0 rounded-md bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('status.paid')}
            </span>
          )}
          {status === 'cancelled' && (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {t('status.cancelled')}
            </span>
          )}
        </div>

        {request.note ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{request.note}</p>
        ) : null}
        {request.payNote && status === 'paid' ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {t('payNoteDisplay', { note: request.payNote })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canPay && primaryWallet ? (
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => setPayOpen(true)}
            >
              {t('payButton', { amount: request.amount, token })}
            </Button>
          ) : null}
          {canPay && !primaryWallet ? (
            <p className="text-[10px] text-muted-foreground">{t('noWalletToPay')}</p>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setCancelOpen(true)}
            >
              {t('cancelAction')}
            </Button>
          ) : null}
          {status === 'paid' && paidTxId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setDetailsOpen(true)}
              aria-label={t('viewTx')}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              {t('viewTx')}
            </Button>
          ) : null}
        </div>

        {isOwn && status === 'pending' ? (
          <p className="text-[10px] text-muted-foreground">{t('sentHint')}</p>
        ) : null}
      </div>

      {primaryWallet && (
        <WalletPayRequestFsModal
          open={payOpen}
          onOpenChange={setPayOpen}
          messageId={message.id}
          request={request}
          wallet={primaryWallet}
          onSuccess={(result) => {
            setLocalMeta({
              status: 'paid',
              paidAt: new Date().toISOString(),
              paidTxHash: result.txHash,
              paidWalletTxId: result.paidWalletTxId,
            })
          }}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cancelConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{t('cancelConfirmNo')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault()
                void handleCancel()
              }}
            >
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('cancelConfirmYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WalletTransactionDetailsFsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        detailId={paidTxId ?? null}
        detailSource={paidTxId ? 'chain' : null}
      />
    </>
  )
}
