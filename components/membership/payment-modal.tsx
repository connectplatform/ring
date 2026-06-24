'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Coins,
  CreditCard,
  CheckCircle,
  ArrowRight,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useTranslations, useLocale } from 'next-intl'
import { RingPaymentModal } from './ring-payment-modal'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { initiateMembershipPayment } from '@/app/_actions/membership-payment'
import { UserRole } from '@/features/auth/user-role'
import {
  formatMembershipFiatAmount,
  getMemberFiatTier,
  getMembershipRingUpgradeAmount,
} from '@/lib/membership/pricing'
import { ROUTES } from '@/constants/routes'
import { getClientCreditCurrencyCode } from '@/lib/payments/credit-currency-client'

type PaymentRail = 'account_credit' | 'on_chain_ring'

interface PaymentModalProps {
  onClose: () => void
  returnTo?: string
}

export function PaymentModal({ onClose, returnTo }: PaymentModalProps) {
  const t = useTranslations('modules.membership')
  const locale = useLocale() as Locale
  const router = useRouter()
  const { balance } = useCreditBalanceContext()
  const creditCurrency = getClientCreditCurrencyCode()
  const [showRingPayment, setShowRingPayment] = useState(false)
  const [paymentRail, setPaymentRail] = useState<PaymentRail>('account_credit')
  const [selectedTab, setSelectedTab] = useState('account_credit')
  const [onChainRingBalance, setOnChainRingBalance] = useState('0')
  const [onChainLoading, setOnChainLoading] = useState(true)
  const [formState, formAction] = useActionState(
    (state: Awaited<ReturnType<typeof initiateMembershipPayment>> | null, formData: FormData) =>
      initiateMembershipPayment(state, formData, locale),
    null,
  )

  const fiatTier = getMemberFiatTier()
  const membershipRingCost = getMembershipRingUpgradeAmount()
  const creditBalanceAmount = parseFloat(balance?.amount || '0')
  const walletRingAmount = parseFloat(onChainRingBalance || '0')
  const hasSufficientCredit = creditBalanceAmount >= membershipRingCost
  const hasSufficientOnChainRing = walletRingAmount >= membershipRingCost

  useEffect(() => {
    if (formState?.paymentUrl) {
      window.location.href = formState.paymentUrl
    }
  }, [formState])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setOnChainLoading(true)
        const res = await fetch('/api/wallet/ring/balance', { cache: 'no-store' })
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
      <RingPaymentModal
        paymentType="membership_upgrade"
        paymentRail={paymentRail}
        onClose={onClose}
        onSuccess={onClose}
        returnTo={returnTo}
      />
    )
  }

  const openPayment = (rail: PaymentRail, sufficient: boolean) => {
    if (!sufficient) {
      router.push(ROUTES.WALLET_TOPUP(locale))
      return
    }
    setPaymentRail(rail)
    setShowRingPayment(true)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('payment.title', { defaultValue: 'Complete Payment' })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account_credit" className="flex items-center gap-1 text-xs">
                <CreditCard className="h-3.5 w-3.5" />
                {creditCurrency}
                {hasSufficientCredit && <Badge variant="default" className="text-[10px] px-1">OK</Badge>}
              </TabsTrigger>
              <TabsTrigger value="wallet_ring" className="flex items-center gap-1 text-xs">
                <Wallet className="h-3.5 w-3.5" />
                RING
                {hasSufficientOnChainRing && <Badge variant="default" className="text-[10px] px-1">OK</Badge>}
              </TabsTrigger>
              <TabsTrigger value="card" className="flex items-center justify-center gap-0 px-1">
                <Image
                  src="/icons/mc-visa-google-apple-pay.svg"
                  alt="Card payment"
                  height={20}
                  width={100}
                  className="opacity-90 h-4 w-auto"
                  priority
                />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account_credit" className="space-y-4">
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  {t('payment.credit.title', { defaultValue: 'Pay with account credit', currency: creditCurrency })}
                </h3>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.cost', { defaultValue: 'Cost' })}</span>
                  <span className="font-medium">{membershipRingCost.toFixed(2)} {creditCurrency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.your_balance', { defaultValue: 'Your balance' })}</span>
                  <span className={cn('font-medium', hasSufficientCredit ? 'text-green-600' : 'text-red-600')}>
                    {creditBalanceAmount.toFixed(2)} {creditCurrency}
                  </span>
                </div>
                {hasSufficientCredit && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>{t('payment.credit.instant', { defaultValue: 'Instant upgrade from fiat credit balance' })}</p>
                  </div>
                )}
                <Button
                  className="w-full"
                  variant={hasSufficientCredit ? 'default' : 'outline'}
                  onClick={() => openPayment('account_credit', hasSufficientCredit)}
                  data-testid="button-membership-pay-credit"
                >
                  {hasSufficientCredit ? (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {t('payment.credit.pay_now', { defaultValue: 'Pay with credit' })}
                    </>
                  ) : (
                    t('payment.credit.top_up', { defaultValue: 'Top up credit balance' })
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="wallet_ring" className="space-y-4">
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {t('payment.wallet_ring.title', { defaultValue: 'Pay with wallet RING' })}
                </h3>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.cost', { defaultValue: 'Cost' })}</span>
                  <span className="font-medium">{membershipRingCost.toFixed(2)} RING</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('payment.on_chain_balance', { defaultValue: 'On-chain balance' })}</span>
                  <span className={cn('font-medium', hasSufficientOnChainRing ? 'text-green-600' : 'text-red-600')}>
                    {onChainLoading ? '…' : `${walletRingAmount.toFixed(4)} RING`}
                  </span>
                </div>
                {!hasSufficientOnChainRing && !onChainLoading && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 text-xs">
                      {t('payment.wallet_ring.insufficient', {
                        defaultValue: 'Insufficient on-chain RING. Buy via RingSales desk (coming soon) or use account credit.',
                      })}
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  variant={hasSufficientOnChainRing ? 'default' : 'outline'}
                  disabled={!hasSufficientOnChainRing || onChainLoading}
                  onClick={() => openPayment('on_chain_ring', hasSufficientOnChainRing)}
                  data-testid="button-membership-pay-wallet-ring"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {t('payment.wallet_ring.pay_now', { defaultValue: 'Pay with wallet RING' })}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="card" className="space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <div className="flex justify-center items-center space-x-2 mb-2">
                  <span className="text-2xl font-bold">{formatMembershipFiatAmount(fiatTier)}</span>
                  <span className="text-sm text-muted-foreground">{fiatTier.currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('payment.membership_fee', { defaultValue: 'One-time membership upgrade fee' })}
                </p>
              </div>

              <form action={formAction} className="space-y-3">
                {formState?.error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{formState.error}</AlertDescription>
                  </Alert>
                )}

                <input type="hidden" name="targetRole" value={UserRole.member} />
                {returnTo && <input type="hidden" name="returnUrl" value={returnTo} />}

                <SubmitCardButton label={t('payment.fiat_details.proceed', { defaultValue: 'Proceed to Card Payment' })} />
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

function SubmitCardButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <ArrowRight className="h-4 w-4 mr-2 animate-pulse" />
          {label}
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  )
}
