'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CreditCard,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowLeftRight,
  ShieldCheck,
  Info,
  Wallet,
} from 'lucide-react'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/shared'
import {
  initiateCreditTopupPayment,
  getNativeTokenPerMainCurrencyRate,
  type CreditTopupFormState,
} from '@/app/_actions/wallet'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useWalletListContext } from '@/components/providers/wallet-list-provider'
import {
  getClientMainCurrency,
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
  getClientWalletTopupProcessorLabel,
  isClientFiatCardTopupEnabled,
  isClientFiatPaypalTopupEnabled,
} from '@/lib/ring-config-client'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import NativeWalletListItem from '@/features/wallet/components/native-wallet-list-item'
import DeskWidget from '@/features/wallet/components/desk-widget'
import ExternalWalletTopupPanel from '@/features/wallet/components/external-wallet-topup-panel'
import { toast } from '@/hooks/use-toast'

interface WalletTopUpClientProps {
  locale: Locale
  searchParams: { [key: string]: string | string[] | undefined }
}

function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#003087"
        d="M7.2 21.2H4.6c-.4 0-.6-.4-.5-.7L7.3 3.6c.1-.4.4-.7.8-.7h5.6c2.9 0 4.9 1.5 4.6 4.2-.4 3.4-2.9 5.3-6.1 5.3H9.5l-.9 5.1c-.1.4-.4.7-.8.7H7.2z"
      />
      <path
        fill="#009CDE"
        d="M9.7 12.4h1.8c2.7 0 4.7-1.5 5.1-4.2.3-2.1-.9-3.4-3.3-3.4H9.2c-.4 0-.7.3-.8.7L6.6 18.8c-.1.4.2.8.6.8h1.9l.6-7.2z"
      />
    </svg>
  )
}

export default function WalletTopUpClient({ locale, searchParams }: WalletTopUpClientProps) {
  void searchParams
  const t = useTranslations('modules.wallet')
  const router = useRouter()
  const showCard = isClientFiatCardTopupEnabled()
  const showPaypal = isClientFiatPaypalTopupEnabled()
  const nativeSymbol = getClientNativeTokenSymbol()
  const creditUnit = getClientCreditUnitLabel()
  const processorLabel = getClientWalletTopupProcessorLabel()
  const mainCurrency = getClientMainCurrency()
  const { balance: creditBalance, refresh: refreshCreditBalance } = useCreditBalanceContext()
  const {
    wallets,
    isLoading: walletsLoading,
    refresh: refreshWallets,
  } = useWalletListContext()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<string>('credit_desk')
  const [mainCurrencyAmount, setFiatAmount] = useState('')
  const [paypalAmount, setPaypalAmount] = useState('')
  const [oracleRate, setOracleRate] = useState<string | null>(null)

  const [fiatState, fiatFormAction, fiatIsPending] = useActionState<
    CreditTopupFormState | null,
    FormData
  >(initiateCreditTopupPayment, null)
  const [paypalState, paypalFormAction, paypalIsPending] = useActionState<
    CreditTopupFormState | null,
    FormData
  >(initiateCreditTopupPayment, null)

  const tabCount = 2 + (showCard ? 1 : 0) + (showPaypal ? 1 : 0)
  const tabCols =
    tabCount >= 4 ? 'grid-cols-2 sm:grid-cols-4' : tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2'

  useEffect(() => {
    void getNativeTokenPerMainCurrencyRate().then((r) => {
      if (r.success && r.nativePerMainCurrency) {
        setOracleRate(r.nativePerMainCurrency)
      }
    })
  }, [])

  useEffect(() => {
    const state =
      fiatState?.redirect || fiatState?.paymentUrl || fiatState?.paymentFields
        ? fiatState
        : paypalState
    if (state?.redirect || state?.paymentUrl || state?.paymentFields) {
      followCheckoutResult({
        redirect: state.redirect,
        paymentUrl: state.paymentUrl,
        paymentFields: state.paymentFields,
      })
    }
  }, [
    fiatState?.redirect,
    fiatState?.paymentUrl,
    fiatState?.paymentFields,
    paypalState?.redirect,
    paypalState?.paymentUrl,
    paypalState?.paymentFields,
  ])

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      toast({
        title: t('addressCopied'),
        description: t('addressCopiedDescription'),
      })
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch {
      toast({ title: t('copyFailed'), variant: 'destructive' })
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">
          {t('topup.title', { defaultValue: 'Top Up Wallet' })}
        </h1>
        <p className="text-muted-foreground">
          {t('topup.subtitle', {
            defaultValue: 'Add funds to your wallet using RING tokens or payment card',
          })}
        </p>
      </div>

      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t('yourWallets')}</p>
        {walletsLoading ? (
          <p className="text-sm text-muted-foreground">{t('loadingWallets')}</p>
        ) : wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noWallets')}</p>
        ) : (
          wallets.map((wallet) => (
            <NativeWalletListItem
              key={wallet.address}
              wallet={wallet}
              copied={copiedAddress === wallet.address}
              primaryLabel={t('primary')}
              onCopy={() => void handleCopyAddress(wallet.address)}
              onSelect={() => router.push(`/${locale}/wallet`)}
              onRefresh={() => void refreshWallets()}
            />
          ))
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => startTransition(() => setActiveTab(value))}
        className="w-full"
      >
        <TabsList className={`mb-8 grid h-auto w-full gap-1 p-1 ${tabCols}`}>
          <TabsTrigger value="credit_desk" className="flex h-auto min-h-10 items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
            <span className="truncate">{creditUnit}</span>
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{nativeSymbol}</span>
          </TabsTrigger>
          <TabsTrigger value="external" className="flex h-auto min-h-10 items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            {t('topupTabs.otherWallet', { defaultValue: 'Other wallet' })}
          </TabsTrigger>
          {showCard ? (
            <TabsTrigger value="card" className="flex h-auto min-h-10 items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              {t('topupTabs.creditCard', { defaultValue: 'Credit Card' })}
            </TabsTrigger>
          ) : null}
          {showPaypal ? (
            <TabsTrigger value="paypal" className="flex h-auto min-h-10 items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <PayPalIcon className="h-3.5 w-3.5 shrink-0" />
              {t('topupTabs.paypal', { defaultValue: 'Paypal' })}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="credit_desk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                {t('deskTitle')}
              </CardTitle>
              <CardDescription>
                {t('deskBuyHint', { token: nativeSymbol })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('topup.oracleRateBubble', {
                    symbol: nativeSymbol,
                    rate: oracleRate ?? '…',
                    creditUnit,
                    defaultValue: `Tokens are calculated in accordance with exchange rate: 1 ${nativeSymbol} is ${oracleRate ?? '…'} ${creditUnit}.`,
                  })}
                </AlertDescription>
              </Alert>
              <DeskWidget
                creditBalancePoints={creditBalance?.amount ?? '0'}
                variant="embedded"
                onSuccess={() => {
                  void refreshCreditBalance()
                  void refreshWallets()
                }}
                onPurchaseCredit={() => {
                  if (showCard) startTransition(() => setActiveTab('card'))
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                {t('topupTabs.otherWallet', { defaultValue: 'Other wallet' })}
              </CardTitle>
              <CardDescription>
                {t('topup.externalDescription', {
                  symbol: nativeSymbol,
                  defaultValue: `Swap allowlisted tokens from your connected sign-in wallet into custodial ${nativeSymbol}.`,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalWalletTopupPanel
                onOpenSwap={() => router.push(`/${locale}/wallet`)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {showCard ? (
          <TabsContent value="card" className="space-y-6">
            <form
              action={fiatFormAction}
              onSubmit={() => {
                logger.info('Card top-up submit', { amount: mainCurrencyAmount })
              }}
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="source" value="wallet_topup_page" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t('topupTabs.creditCard', { defaultValue: 'Credit Card' })}
                  </CardTitle>
                  <CardDescription>
                    {t('topup.methods.fiat.description', {
                      creditUnit,
                      token: nativeSymbol,
                      defaultValue: `Purchase account credit (${creditUnit}).`,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {fiatState?.error ? (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-destructive">{fiatState.error}</AlertDescription>
                    </Alert>
                  ) : null}
                  {fiatState?.success && fiatState.message && !fiatState.paymentUrl ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">{fiatState.message}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t('topup.oracleRateBubble', {
                        symbol: nativeSymbol,
                        rate: oracleRate ?? '…',
                        creditUnit,
                        defaultValue: `Tokens are calculated in accordance with exchange rate: 1 ${nativeSymbol} is ${oracleRate ?? '…'} ${creditUnit}.`,
                      })}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="fiat-amount" className="text-sm font-medium">
                      {t('topup.fiat_amount_label', {
                        currency: mainCurrency,
                        defaultValue: `Amount (${mainCurrency})`,
                      })}
                    </Label>
                    <div className="relative">
                      <Input
                        id="fiat-amount"
                        name="amount"
                        type="number"
                        placeholder="100"
                        value={mainCurrencyAmount}
                        onChange={(e) => setFiatAmount(e.target.value)}
                        className="pr-16"
                        min="25"
                        max="2000"
                        step="1"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {mainCurrency}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Min: 25</span>
                      <span>Max: 2,000</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!mainCurrencyAmount || parseFloat(mainCurrencyAmount) < 25 || fiatIsPending}
                    className="w-full"
                    size="lg"
                  >
                    {fiatIsPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('topup.processing', { defaultValue: 'Processing...' })}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t('topup.proceed_card', { defaultValue: 'Proceed to Card Payment' })}
                      </>
                    )}
                  </Button>

                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t('topup.securePaymentBubble', {
                        processor: processorLabel,
                        defaultValue: `Payments are processed securely via ${processorLabel}. This is a non-refundable transaction.`,
                      })}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </form>
          </TabsContent>
        ) : null}

        {showPaypal ? (
          <TabsContent value="paypal" className="space-y-6">
            <form action={paypalFormAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="source" value="wallet_topup_page:paypal" />
              <input type="hidden" name="processor" value="paypal" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PayPalIcon className="h-5 w-5" />
                    {t('topupTabs.paypal', { defaultValue: 'Paypal' })}
                  </CardTitle>
                  <CardDescription>
                    {t('topup.methods.paypal.description', {
                      creditUnit,
                      token: nativeSymbol,
                      defaultValue: `Purchase account credit (${creditUnit}) with PayPal.`,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {paypalState?.error ? (
                    <Alert className="border-destructive bg-destructive/10">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-destructive">{paypalState.error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t('topup.oracleRateBubble', {
                        symbol: nativeSymbol,
                        rate: oracleRate ?? '…',
                        creditUnit,
                        defaultValue: `Tokens are calculated in accordance with exchange rate: 1 ${nativeSymbol} is ${oracleRate ?? '…'} ${creditUnit}.`,
                      })}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="paypal-amount">
                      {t('topup.fiat_amount_label', {
                        currency: mainCurrency,
                        defaultValue: `Amount (${mainCurrency})`,
                      })}
                    </Label>
                    <div className="relative">
                      <Input
                        id="paypal-amount"
                        name="amount"
                        type="number"
                        min="25"
                        max="2000"
                        step="1"
                        placeholder="100"
                        value={paypalAmount}
                        onChange={(e) => setPaypalAmount(e.target.value)}
                        className="pr-16"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {mainCurrency}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={!paypalAmount || parseFloat(paypalAmount) < 25 || paypalIsPending}
                  >
                    {paypalIsPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PayPalIcon className="mr-2 h-4 w-4" />
                    )}
                    {t('topup.proceed_paypal', { defaultValue: 'Proceed to PayPal' })}
                  </Button>

                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t('topup.securePaymentBubble', {
                        processor: 'PayPal',
                        defaultValue:
                          'Payments are processed securely via PayPal. This is a non-refundable transaction.',
                      })}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </form>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
