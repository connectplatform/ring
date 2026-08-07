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
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react'
import WalletFsModal from '@/features/wallet/components/wallet-fs-modal'
import { PayPalIcon } from '@/components/payments/paypal-icon'
import {
  initiateCreditTopupPayment,
  type CreditTopupFormState,
} from '@/app/_actions/wallet'
import {
  getClientMainCurrency,
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import type { Locale } from '@/i18n/shared'

export interface CreditAddFsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ledger metadata.source — e.g. credit_add_fs_modal | wallet_topup_page */
  source?: string
  onSuccess?: () => void
}

function SubmitButton({
  label,
  variant = 'card',
}: {
  label: string
  variant?: 'card' | 'paypal'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="mt-6 w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {label}
        </>
      ) : variant === 'paypal' ? (
        <>
          <PayPalIcon className="mr-2 h-4 w-4" />
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
 * SSOT credit top-up modal — Card (Visa/MC/Apple/Google) or PayPal → credit points.
 */
export default function CreditAddFsModal({
  open,
  onOpenChange,
  source = 'credit_add_fs_modal',
  onSuccess,
}: CreditAddFsModalProps) {
  const t = useTranslations('modules.wallet')
  const locale = useLocale() as Locale
  const mainCurrency = getClientMainCurrency()
  /** Locale keys use `{creditUnit}` — ring-config `credit.creditBalanceUnitLabel` via client SSOT. */
  const creditUnit = getClientCreditUnitLabel()
  const nativeSymbol = getClientNativeTokenSymbol()

  const [tab, setTab] = useState<'card' | 'paypal'>('card')
  const [creditState, creditAction] = useActionState<CreditTopupFormState | null, FormData>(
    initiateCreditTopupPayment,
    null,
  )

  useEffect(() => {
    if (creditState?.redirect || creditState?.paymentUrl || creditState?.paymentFields) {
      onSuccess?.()
      followCheckoutResult({
        redirect: creditState.redirect,
        paymentUrl: creditState.paymentUrl,
        paymentFields: creditState.paymentFields,
      })
    }
  }, [creditState?.redirect, creditState?.paymentUrl, creditState?.paymentFields, onSuccess])

  const formError = creditState?.error

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

      {formError && (
        <Alert className="mb-4 border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{formError}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'card' | 'paypal')}
        className="w-full"
      >
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger
            value="card"
            className="flex h-auto min-h-10 flex-col items-center gap-1 py-2 sm:flex-row sm:gap-2"
          >
            <Image
              src="/icons/mc-visa-google-apple-pay.svg"
              alt=""
              height={16}
              width={80}
              className="h-3.5 w-auto max-w-[4.5rem] opacity-90"
              aria-hidden
            />
            <span>{t('topup.methods.card.name', { defaultValue: 'Card' })}</span>
          </TabsTrigger>
          <TabsTrigger
            value="paypal"
            className="flex h-auto min-h-10 items-center justify-center gap-2 py-2"
          >
            <PayPalIcon className="h-4 w-4 shrink-0" />
            <span>{t('topup.methods.paypal.name', { defaultValue: 'PayPal' })}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="card">
          <p className="mb-3 text-xs text-muted-foreground">
            {t('topup.methods.card.description', {
              creditUnit,
              token: nativeSymbol,
              defaultValue: `Card → credit (${creditUnit}). Convert to ${nativeSymbol} later via Token Desk.`,
            })}
          </p>
          <form action={creditAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="source" value={`${source}:card`} />
            <div className="space-y-2">
              <Label htmlFor="credit-add-card-amount">
                {t('topup.fiat_amount_label', {
                  currency: mainCurrency,
                  defaultValue: `Amount (${mainCurrency})`,
                })}
              </Label>
              <Input
                id="credit-add-card-amount"
                name="amount"
                type="number"
                min="25"
                max="2000"
                step="1"
                placeholder="100"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('topup.amount_range', {
                  defaultValue: 'Amount must be between $25 and $2000',
                })}
              </p>
            </div>
            <SubmitButton
              variant="card"
              label={t('topup.proceed_card', { defaultValue: 'Proceed to Card Payment' })}
            />
          </form>
        </TabsContent>

        <TabsContent value="paypal">
          <p className="mb-3 text-xs text-muted-foreground">
            {t('topup.methods.paypal.description', {
              creditUnit,
              token: nativeSymbol,
              defaultValue: `PayPal → credit (${creditUnit}). Convert to ${nativeSymbol} later via Token Desk.`,
            })}
          </p>
          <form action={creditAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="source" value={`${source}:paypal`} />
            <input type="hidden" name="processor" value="paypal" />
            <div className="space-y-2">
              <Label htmlFor="credit-add-paypal-amount">
                {t('topup.fiat_amount_label', {
                  currency: mainCurrency,
                  defaultValue: `Amount (${mainCurrency})`,
                })}
              </Label>
              <Input
                id="credit-add-paypal-amount"
                name="amount"
                type="number"
                min="25"
                max="2000"
                step="1"
                placeholder="100"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('topup.amount_range', {
                  defaultValue: 'Amount must be between $25 and $2000',
                })}
              </p>
            </div>
            <SubmitButton
              variant="paypal"
              label={t('topup.proceed_paypal', { defaultValue: 'Proceed to PayPal' })}
            />
          </form>
        </TabsContent>
      </Tabs>
    </WalletFsModal>
  )
}
