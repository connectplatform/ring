'use client'

/**
 * Confirm FS modal before paying a payment_request via WalletConductor.
 * TODO(public-invoice): QR / shareable pay link without a contact — deferred.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { PaymentRequestMetadata } from '@/features/chat/types'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import { payNativeTokenPaymentRequest } from '@/app/_actions/wallet'
import { formatNativeBalance } from '@/features/wallet/utils/balance-cache'
import { toast } from '@/hooks/use-toast'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'

export interface WalletPayRequestFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageId: string
  request: PaymentRequestMetadata
  wallet: WalletInfo
  onSuccess?: (result: { txHash?: string; paidWalletTxId?: string }) => void
}

export default function WalletPayRequestFsModal({
  open,
  onOpenChange,
  messageId,
  request,
  wallet,
  onSuccess,
}: WalletPayRequestFsModalProps) {
  const t = useTranslations('modules.wallet.paymentRequest')
  const tCommon = useTranslations('common')
  const token = request.tokenSymbol || wallet.tokenSymbol || getClientNativeTokenSymbol()
  const [note, setNote] = useState('')
  const [paying, setPaying] = useState(false)

  const available = parseFloat(wallet.nativeBalance || '0') || 0
  const amount = parseFloat(request.amount) || 0
  const insufficient = amount > available

  const handlePay = async () => {
    if (insufficient || paying) return
    try {
      setPaying(true)
      const result = await payNativeTokenPaymentRequest({
        messageId,
        note: note.trim() || undefined,
      })
      if (!result.success) {
        throw new Error(result.error || t('payFailed'))
      }
      toast({
        title: tCommon('success'),
        description: result.alreadyPaid
          ? t('alreadyPaid')
          : t('paySuccess', { amount: request.amount, token }),
      })
      onSuccess?.({
        txHash: result.txHash,
        paidWalletTxId: result.paidWalletTxId,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('payFailed'),
        variant: 'destructive',
      })
    } finally {
      setPaying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-sm:min-h-[100dvh] max-sm:rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payConfirmTitle', { amount: request.amount, token })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-2">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('payFromWallet')}</span>
              <span className="font-mono text-xs">
                {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('payBalance')}</span>
              <span className="tabular-nums">
                {formatNativeBalance(wallet.nativeBalance)} {token}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('payAmount')}</span>
              <span className="font-semibold tabular-nums">
                {request.amount} {token}
              </span>
            </div>
          </div>

          {insufficient && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('insufficientBalance')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pay-note">{t('payNoteLabel')}</Label>
            <Textarea
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('payNotePlaceholder')}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={paying}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={paying || insufficient}
              onClick={() => void handlePay()}
            >
              {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('payButton', { amount: request.amount, token })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
