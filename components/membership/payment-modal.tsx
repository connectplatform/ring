'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { getNativeTokenConfig } from '@/lib/payments/payment.config'
import {
  CreditCard,
  ArrowRight,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useTranslations, useLocale } from 'next-intl'
import { MembershipPaymentModal } from './ring-payment-modal'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { initiateMembershipPayment } from '@/app/_actions/membership-payment'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  formatMembershipMainCurrencyAmount,
  getMemberMainCurrencyTier,
  getMembershipRingUpgradeAmount,
} from '@/lib/membership/pricing'
import { ROUTES } from '@/constants/routes'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'

type PaymentRail = 'on_chain_ring'

interface PaymentModalProps {
  onClose: () => void
  returnTo?: string
}

export function PaymentModal({ onClose, returnTo }: PaymentModalProps) {
  const t = useTranslations('modules.membership')
  const locale = useLocale() as Locale
  const router = useRouter()
  const nativeSymbol = getClientNativeTokenSymbol()
  const [showRingPayment, setShowRingPayment] = useState(false)
  const [paymentRail, setPaymentRail] = useState<PaymentRail>('on_chain_ring')
  const [selectedTab, setSelectedTab] = useState('wallet_native_token')
  const [onChainRingBalance, setOnChainRingBalance] = useState('0')
  const [onChainLoading, setOnChainLoading] = useState(true)
  const paypalEnabled = process.env.NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL === 'true'
  const [formState, formAction] = useActionState(
    (state: Awaited<ReturnType<typeof initiateMembershipPayment>> | null, formData: FormData) =>
      initiateMembershipPayment(state, formData, locale),
    null,
  )

  const fiatTier = getMemberMainCurrencyTier()
  const membershipRingCost = getMembershipRingUpgradeAmount()
  const walletRingAmount = parseFloat(onChainRingBalance || '0')
  const hasSufficientOnChainRing = walletRingAmount >= membershipRingCost

  useEffect(() => {
    if (formState?.redirect || formState?.paymentUrl || formState?.paymentFields) {
      followCheckoutResult({
        redirect: formState.redirect,
        paymentUrl: formState.paymentUrl,
        paymentFields: formState.paymentFields,
      })
    }
  }, [formState])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setOnChainLoading(true)
        const res = await fetch('/api/wallet/token/balance', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { balance?: string }
        if (!cancelled) {
          setOnChainRingBalance(data.balance ?? '0')
        }
      } catch {
        if (!cancelled) setOnChainRingBalance('0')
      } finally {
        if (!cancelled) setOnChainLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (showRingPayment) {
    return (
      <MembershipPaymentModal
        paymentType="membership_upgrade"
        paymentRail={paymentRail}
        onClose={onClose}
        onSuccess={onClose}
        returnTo={returnTo}
      />
    )
  }

  const openNativePayment = (sufficient: boolean) => {
    if (!sufficient) return
    setPaymentRail('on_chain_ring')
    setShowRingPayment(true)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('payment.title', { defaultValue: 'Complete Payment' })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="wallet_native_token" className="flex items-center gap-1 text-xs">
                <Wallet className="h-3.5 w-3.5" />
                {getNativeTokenConfig().symbol}
                {hasSufficientOnChainRing && (
                  <Badge variant="default" className="px-1 text-[10px]">
                    OK
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="card" className="flex items-center justify-center gap-0 px-1">
                <Image
                  src="/icons/mc-visa-google-apple-pay.svg"
                  alt="Card payment"
                  height={20}
                  width={100}
                  className="h-4 w-auto opacity-90"
                  priority
                />
              </TabsTrigger>
              <TabsTrigger value="paypal" className="text-xs">
                PayPal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wallet_native_token" className="space-y-4">
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="flex items-center gap-2 font-medium">
                  <Wallet className="h-4 w-4 text-primary" />
                  {t('payment.wallet_native_token.title', {
                    defaultValue: 'Pay with wallet {native_token} token',
                    native_token: nativeSymbol,
                  })}
                </h3>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.cost', { defaultValue: 'Cost' })}</span>
                  <span className="font-medium">
                    {membershipRingCost.toFixed(2)} {getNativeTokenConfig().symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.on_chain_balance', { defaultValue: 'On-chain balance' })}</span>
                  <span
                    className={cn(
                      'font-medium',
                      hasSufficientOnChainRing ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {onChainLoading
                      ? '…'
                      : `${walletRingAmount.toFixed(4)} ${getNativeTokenConfig().symbol}`}
                  </span>
                </div>
                {!hasSufficientOnChainRing && !onChainLoading && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-xs text-orange-800">
                      {t('payment.wallet_native_token.insufficient', {
                        defaultValue:
                          'Insufficient on-chain balance. Convert credits at Token Desk or use card payment.',
                      })}
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  variant={hasSufficientOnChainRing ? 'default' : 'outline'}
                  disabled={!hasSufficientOnChainRing || onChainLoading}
                  onClick={() => openNativePayment(hasSufficientOnChainRing)}
                  data-testid="button-membership-pay-wallet-ring"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {t('payment.wallet_native_token.pay_now', {
                    defaultValue: 'Pay with wallet {native_token} token',
                    native_token: nativeSymbol,
                  })}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="card" className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="mb-2 flex items-center justify-center space-x-2">
                  <span className="text-2xl font-bold">{formatMembershipMainCurrencyAmount(fiatTier)}</span>
                  <span className="text-sm text-muted-foreground">{fiatTier.currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('payment.membership_fee', { defaultValue: 'One-time membership upgrade fee' })}
                </p>
              </div>

              <form action={formAction} className="space-y-3">
                {formState?.error && selectedTab === 'card' && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{formState.error}</AlertDescription>
                  </Alert>
                )}

                <input type="hidden" name="targetRole" value={UserRolesArray.member} />
                <input type="hidden" name="paymentMethod" value="wayforpay" />
                {returnTo && <input type="hidden" name="returnUrl" value={returnTo} />}

                <SubmitRailButton
                  label={t('payment.fiat_details.proceed', { defaultValue: 'Proceed to Card Payment' })}
                />
              </form>
            </TabsContent>

            <TabsContent value="paypal" className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="mb-2 flex items-center justify-center space-x-2">
                  <span className="text-2xl font-bold">{formatMembershipMainCurrencyAmount(fiatTier)}</span>
                  <span className="text-sm text-muted-foreground">{fiatTier.currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('payment.paypal.blurb', {
                    defaultValue: 'Pay membership fee with PayPal (Orders v2 via PaymentConductor)',
                  })}
                </p>
              </div>
              <form action={formAction} className="space-y-3">
                {formState?.error && selectedTab === 'paypal' && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{formState.error}</AlertDescription>
                  </Alert>
                )}
                <input type="hidden" name="targetRole" value={UserRolesArray.member} />
                <input type="hidden" name="paymentMethod" value="paypal" />
                {returnTo && <input type="hidden" name="returnUrl" value={returnTo} />}
                <SubmitRailButton
                  label={
                    paypalEnabled
                      ? t('payment.paypal.pay_now', { defaultValue: 'Pay with PayPal' })
                      : t('payment.paypal.disabled', {
                          defaultValue:
                            'PayPal disabled (set NEXT_PUBLIC_PAYMENT_STORE_ALLOW_PAYPAL=true)',
                        })
                  }
                  disabled={!paypalEnabled}
                  dataTestId="button-membership-pay-paypal"
                />
              </form>
            </TabsContent>
          </Tabs>

          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('payment.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              data-testid="button-membership-learn-more"
              onClick={() => {
                onClose()
                router.push(ROUTES.DOCS_PAYMENTS(locale))
              }}
            >
              {t('modal.learn_more')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SubmitRailButton({
  label,
  disabled,
  dataTestId,
}: {
  label: string
  disabled?: boolean
  dataTestId?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled} data-testid={dataTestId}>
      {pending ? (
        <>
          <ArrowRight className="mr-2 h-4 w-4 animate-pulse" />
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
