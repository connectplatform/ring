'use client'

import { useEffect, useActionState, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, CreditCard, Loader2, Coins } from 'lucide-react'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import {
  initiateCreditTopupPayment,
  initiateNativeTokenOnrampPayment,
  type CreditTopupFormState,
} from '@/app/_actions/wallet'
import { getClientCreditFiatCurrency, getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import { canUseNativeTokenOnrampClient } from '@/lib/payments/confidential-token-onramp-client'
import { useAuth } from '@/hooks/use-auth'
import type { Locale } from '@/i18n/shared'

export interface CreditAddFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ledger metadata.source — e.g. credit_add_fs_modal | wallet_topup_page */
  source?: string
  onSuccess?: () => void
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="mt-6 w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {label}
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}

/**
 * SSOT card top-up modal:
 * - Always: credit points via wallet_topup (any signed-in user)
 * - When CONFIDENTIAL_TOKEN_ONRAMP + confidential+: native RING via card / PayPal tabs
 */
export default function CreditAddFsModal({
  open,
  onOpenChange,
  source = 'credit_add_fs_modal',
  onSuccess,
}: CreditAddFsModalProps) {
  const t = useTranslations('modules.wallet')
  const locale = useLocale() as Locale
  const { role } = useAuth()
  const fiatCurrency = getClientCreditFiatCurrency()
  const nativeSymbol = getClientNativeTokenSymbol()
  const showOnramp = canUseNativeTokenOnrampClient(role)

  const [tab, setTab] = useState('credit')
  const [creditState, creditAction] = useActionState<CreditTopupFormState | null, FormData>(
    initiateCreditTopupPayment,
    null,
  )
  const [onrampState, onrampAction] = useActionState<CreditTopupFormState | null, FormData>(
    initiateNativeTokenOnrampPayment,
    null,
  )

  useEffect(() => {
    const url = creditState?.paymentUrl || onrampState?.paymentUrl
    if (url) {
      onSuccess?.()
      window.location.href = url
    }
  }, [creditState?.paymentUrl, onrampState?.paymentUrl, onSuccess])

  useEffect(() => {
    if (!showOnramp && tab !== 'credit') setTab('credit')
  }, [showOnramp, tab])

  const formError =
    tab === 'credit' ? creditState?.error : onrampState?.error

  return (
    <WalletFsModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('creditBalanceItem.addCredit')}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {t('topup.subtitle', {
          defaultValue: 'Add funds using your payment card or mobile wallet',
        })}
      </p>

      <div className="mb-4 flex justify-center rounded-lg bg-muted/40 p-3">
        <Image
          src="/icons/mc-visa-google-apple-pay.svg"
          alt="Card payment"
          height={24}
          width={120}
          className="h-5 w-auto opacity-90"
          priority
        />
      </div>

      {formError && (
        <Alert className="mb-4 border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{formError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`mb-4 grid w-full ${showOnramp ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="credit">Credit points</TabsTrigger>
          {showOnramp && (
            <>
              <TabsTrigger value="native_card">
                <Coins className="mr-1 h-3.5 w-3.5" />
                {nativeSymbol} card
              </TabsTrigger>
              <TabsTrigger value="native_paypal">{nativeSymbol} PayPal</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="credit">
          <p className="mb-3 text-xs text-muted-foreground">
            Card → credit points (1:1). Convert to {nativeSymbol} later via Token Desk.
          </p>
          <form action={creditAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="source" value={source} />
            <div className="space-y-2">
              <Label htmlFor="credit-add-amount">
                {t('topup.fiat_amount_label', {
                  currency: fiatCurrency,
                  defaultValue: `Amount (${fiatCurrency})`,
                })}
              </Label>
              <Input
                id="credit-add-amount"
                name="amount"
                type="number"
                min="25"
                max="2000"
                step="1"
                placeholder="100"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('topup.amount_range', { defaultValue: 'Amount must be between $25 and $2000' })}
              </p>
            </div>
            <SubmitButton
              label={t('topup.proceed_card', { defaultValue: 'Proceed to Card Payment' })}
            />
          </form>
        </TabsContent>

        {showOnramp && (
          <>
            <TabsContent value="native_card">
              <p className="mb-3 text-xs text-muted-foreground">
                Confidential onramp: card → native {nativeSymbol} (treasury transfer). Requires
                CONFIDENTIAL_TOKEN_ONRAMP.
              </p>
              <form action={onrampAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="source" value={`${source}:native_card`} />
                <div className="space-y-2">
                  <Label htmlFor="onramp-card-amount">Amount ({fiatCurrency})</Label>
                  <Input
                    id="onramp-card-amount"
                    name="amount"
                    type="number"
                    min="25"
                    max="2000"
                    step="1"
                    placeholder="100"
                    required
                  />
                </div>
                <SubmitButton label={`Buy ${nativeSymbol} with card`} />
              </form>
            </TabsContent>

            <TabsContent value="native_paypal">
              <p className="mb-3 text-xs text-muted-foreground">
                PayPal onramp is Phase S8 stub (wired through PaymentConductor; capture not live).
              </p>
              <form action={onrampAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="source" value={`${source}:native_paypal`} />
                <input type="hidden" name="processor" value="paypal" />
                <div className="space-y-2">
                  <Label htmlFor="onramp-paypal-amount">Amount ({fiatCurrency})</Label>
                  <Input
                    id="onramp-paypal-amount"
                    name="amount"
                    type="number"
                    min="25"
                    max="2000"
                    step="1"
                    placeholder="100"
                    required
                  />
                </div>
                <SubmitButton label={`Buy ${nativeSymbol} with PayPal`} />
              </form>
            </TabsContent>
          </>
        )}
      </Tabs>
    </WalletFsModal>
  )
}
