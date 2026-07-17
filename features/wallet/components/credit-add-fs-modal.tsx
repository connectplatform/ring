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
import {
  initiateCreditTopupPayment,
  type CreditTopupFormState,
} from '@/app/_actions/wallet'
import {
  getClientCreditFiatCurrency,
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

/** Best-effort PayPal mark (two overlapping P shapes). */
function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="#003087"
        d="M7.2 21.2H4.6c-.4 0-.6-.4-.5-.7L7.3 3.6c.1-.4.4-.7.8-.7h5.6c2.9 0 4.9 1.5 4.6 4.2-.4 3.4-2.9 5.3-6.1 5.3H9.5l-.9 5.1c-.1.4-.4.7-.8.7H7.2z"
      />
      <path
        fill="#009CDE"
        d="M9.7 12.4h1.8c2.7 0 4.7-1.5 5.1-4.2.3-2.1-.9-3.4-3.3-3.4H9.2c-.4 0-.7.3-.8.7L6.6 18.8c-.1.4.2.8.6.8h1.9l.6-7.2z"
      />
      <path
        fill="#012169"
        d="M9.1 8.9l-.9 5.4c-.1.4.2.7.6.7h1.5c2.4 0 4.3-1.2 4.7-3.9.3-1.8-.7-2.8-2.8-2.8H9.7c-.3 0-.5.2-.6.6z"
      />
    </svg>
  )
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
  const fiatCurrency = getClientCreditFiatCurrency()
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
                  currency: fiatCurrency,
                  defaultValue: `Amount (${fiatCurrency})`,
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
                  currency: fiatCurrency,
                  defaultValue: `Amount (${fiatCurrency})`,
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
