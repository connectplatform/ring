'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Coins, 
  Wallet, 
  CreditCard, 
  ArrowRight, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Apple,
  Smartphone,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/shared'
import {
  topUpCredits,
  initiateCreditTopupPayment,
  initiateNativeTokenOnrampPayment,
  type CreditTopupFormState,
} from '@/app/_actions/wallet'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useWalletListContext } from '@/components/providers/wallet-list-provider'
import {
  getClientCreditFiatCurrency,
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import { followCheckoutResult } from '@/lib/payments/checkout-redirect'
import { canUseNativeTokenOnrampClient } from '@/lib/payments/confidential-token-onramp-client'
import { useAuth } from '@/hooks/use-auth'
import NativeWalletListItem from '@/features/wallet/components/native-wallet-list-item'
import DeskWidget from '@/features/wallet/components/desk-widget'
import { toast } from '@/hooks/use-toast'

interface WalletTopUpClientProps {
  locale: Locale
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function WalletTopUpClient({ locale, searchParams }: WalletTopUpClientProps) {
  const t = useTranslations('modules.wallet')
  const router = useRouter()
  const { role } = useAuth()
  const showOnramp = canUseNativeTokenOnrampClient(role)
  const nativeSymbol = getClientNativeTokenSymbol()
  const creditUnit = getClientCreditUnitLabel()
  const { balance: creditBalance, refresh: refreshCreditBalance } = useCreditBalanceContext()
  const {
    wallets,
    isLoading: walletsLoading,
    refresh: refreshWallets,
  } = useWalletListContext()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // React 19 useTransition for non-blocking tab and payment method changes
  const [isPending, startTransition] = useTransition()

  // React 19 useActionState for RING token top-up (server action)
  const [ringState, ringFormAction, ringIsPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await topUpCredits(formData)
      
      if (result.success) {
        // Refresh credit balance after successful top-up
        await refreshCreditBalance()
        
        logger.info('RING top-up successful via server action', { 
          amount: formData.get('amount'), 
          method: 'blockchain_transfer',
          txHash: result.txHash 
        })
      } else {
        logger.error('RING top-up failed via server action', { 
          amount: formData.get('amount'), 
          error: result.error 
        })
      }
      
      return result
    },
    null
  )

  const [activeTab, setActiveTab] = useState<string>('credit_desk')
  
  // RING Token state
  const [ringAmount, setRingAmount] = useState('')
  const [ringDescription, setRingDescription] = useState('')
  const [txHash, setTxHash] = useState('')

  // Card → credit points via PaymentConductor (wallet_topup). Not native RING.
  const fiatCurrency = getClientCreditFiatCurrency()
  const [fiatAmount, setFiatAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'applepay' | 'googlepay'>('card')
  const [fiatState, fiatFormAction, fiatIsPending] = useActionState<
    CreditTopupFormState | null,
    FormData
  >(initiateCreditTopupPayment, null)
  const [onrampState, onrampFormAction, onrampIsPending] = useActionState<
    CreditTopupFormState | null,
    FormData
  >(initiateNativeTokenOnrampPayment, null)

  const tabCols = showOnramp ? 'grid-cols-5' : 'grid-cols-3'

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

  useEffect(() => {
    const state =
      fiatState?.redirect || fiatState?.paymentUrl || fiatState?.paymentFields
        ? fiatState
        : onrampState
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
    onrampState?.redirect,
    onrampState?.paymentUrl,
    onrampState?.paymentFields,
  ])

  const handleRingTopUp = async (formData: FormData) => {
    // Validate before submitting
    const amount = formData.get('amount') as string
    if (!amount || parseFloat(amount) <= 0) {
      return
    }

    // Submit via server action
    ringFormAction(formData)

    // Reset form after submission
    setTimeout(() => {
      setRingAmount('')
      setRingDescription('')
      setTxHash('')
    }, 3000)
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {t('topup.title', { defaultValue: 'Top Up Wallet' })}
        </h1>
        <p className="text-muted-foreground">
          {t('topup.subtitle', { defaultValue: 'Add funds to your wallet using RING tokens or payment card' })}
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
            />
          ))
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))} className="w-full">
        <TabsList className={`mb-8 grid w-full ${tabCols}`}>
          <TabsTrigger value="credit_desk" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            {t('topupTabs.creditDesk', { creditUnit })}
          </TabsTrigger>
          <TabsTrigger value="ring" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Chain proof
          </TabsTrigger>
          <TabsTrigger value="wayforpay" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Credit card
          </TabsTrigger>
          {showOnramp && (
            <>
              <TabsTrigger value="native_card" className="flex items-center gap-2">
                {nativeSymbol} card
              </TabsTrigger>
              <TabsTrigger value="native_paypal" className="flex items-center gap-2">
                {nativeSymbol} PayPal
              </TabsTrigger>
            </>
          )}
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
            <CardContent>
              <DeskWidget
                creditBalancePoints={creditBalance?.amount ?? '0'}
                variant="embedded"
                onSuccess={() => {
                  void refreshCreditBalance()
                  void refreshWallets()
                }}
                onPurchaseCredit={() => startTransition(() => setActiveTab('wayforpay'))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* RING Token Transfer Tab */}
        <TabsContent value="ring" className="space-y-6">
          <form action={handleRingTopUp}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t('topup.methods.blockchain.name', { defaultValue: 'Blockchain Transfer' })}
                </CardTitle>
                <CardDescription>
                  {t('topup.methods.blockchain.description', { defaultValue: 'Transfer RING tokens directly from your wallet' })}
                </CardDescription>
              </CardHeader>
            <CardContent className="space-y-6">
              {/* Success/Error Display */}
              {ringState && (
                <Alert className={ringState.success ? 'border-green-200 bg-green-50' : 'border-destructive bg-destructive/10'}>
                  {ringState.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertDescription className={ringState.success ? 'text-green-800' : 'text-destructive'}>
                    {ringState.message || ringState.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="ring-amount" className="text-sm font-medium">
                  {t('topup.amount_label', { defaultValue: 'Amount (RING)' })}
                </Label>
                <div className="relative">
                  <Input
                    id="ring-amount"
                    name="amount"
                    type="number"
                    placeholder="0.00"
                    value={ringAmount}
                    onChange={(e) => setRingAmount(e.target.value)}
                    className="pr-12"
                    min="0.01"
                    max="10000"
                    step="0.01"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    RING
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: 0.01 RING</span>
                  <span>Max: 10,000 RING</span>
                </div>
              </div>

              {/* Transaction Hash */}
              <div className="space-y-2">
                <Label htmlFor="tx-hash" className="text-sm font-medium">
                  {t('topup.tx_hash_label', { defaultValue: 'Transaction Hash (Optional)' })}
                </Label>
                <Input
                  id="tx-hash"
                  name="txHash"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {t('topup.tx_hash_help', { 
                    defaultValue: 'Enter the transaction hash if you\'ve already sent RING tokens to your wallet' 
                  })}
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="ring-description" className="text-sm font-medium">
                  {t('topup.description_label', { defaultValue: 'Description (Optional)' })}
                </Label>
                <Textarea
                  id="ring-description"
                  name="description"
                  placeholder={t('topup.description_placeholder', { 
                    defaultValue: 'Add a note for this top-up...' 
                  })}
                  value={ringDescription}
                  onChange={(e) => setRingDescription(e.target.value)}
                  className="min-h-[60px] resize-none"
                  maxLength={200}
                />
              </div>

              {/* Summary */}
              {ringAmount && parseFloat(ringAmount) > 0 && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-3">Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="font-medium">{ringAmount} RING</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fees</span>
                      <span className="text-green-600">0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Time</span>
                      <span>1-3 minutes</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>You will receive</span>
                      <span className="text-primary">{ringAmount} RING</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button 
                type="submit"
                disabled={!ringAmount || parseFloat(ringAmount) <= 0 || ringIsPending}
                className="w-full"
                size="lg"
              >
                {ringIsPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('topup.processing', { defaultValue: 'Processing...' })}
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {t('topup.record_transfer', { defaultValue: 'Record Transfer' })}
                  </>
                )}
              </Button>

              {/* Help Alert */}
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('topup.blockchain_help', { 
                    defaultValue: 'If you\'ve already sent RING tokens to your wallet, enter the amount and transaction hash to update your balance. Otherwise, first send tokens to your wallet address.' 
                  })}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          </form>
        </TabsContent>

        {/* Card → credit points (PaymentConductor wallet_topup) */}
        <TabsContent value="wayforpay" className="space-y-6">
          <form action={fiatFormAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="source" value="wallet_topup_page" />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t('topup.methods.fiat.name', {
                    creditUnit,
                    token: nativeSymbol,
                    defaultValue: 'Card payment',
                  })}
                </CardTitle>
                <CardDescription>
                  {t('topup.methods.fiat.description', {
                    creditUnit,
                    token: nativeSymbol,
                    defaultValue:
                      'Purchase account credit ({creditUnit}). Convert to {token} later via Token Desk.',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {fiatState?.error && (
                  <Alert className="border-destructive bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                      {fiatState.error}
                    </AlertDescription>
                  </Alert>
                )}
                {fiatState?.success && fiatState.message && !fiatState.paymentUrl && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      {fiatState.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div
                      onClick={() => startTransition(() => setPaymentMethod('card'))}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        paymentMethod === 'card'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80'
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <CreditCard className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">Credit Card</span>
                      </div>
                    </div>

                    <div
                      onClick={() => startTransition(() => setPaymentMethod('applepay'))}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        paymentMethod === 'applepay'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80'
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Apple className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">Apple Pay</span>
                      </div>
                    </div>

                    <div
                      onClick={() => startTransition(() => setPaymentMethod('googlepay'))}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        paymentMethod === 'googlepay'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80'
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Smartphone className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">Google Pay</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Method preference is honored by the hosted checkout (WayForPay / Stripe per{' '}
                    <code>PAYMENT_WALLET_TOPUP_PROCESSOR</code>).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fiat-amount" className="text-sm font-medium">
                    Amount ({fiatCurrency})
                  </Label>
                  <div className="relative">
                    <Input
                      id="fiat-amount"
                      name="amount"
                      type="number"
                      placeholder="100"
                      value={fiatAmount}
                      onChange={(e) => setFiatAmount(e.target.value)}
                      className="pr-16"
                      min="25"
                      max="2000"
                      step="1"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {fiatCurrency}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Min: 25</span>
                    <span>Max: 2,000</span>
                  </div>
                </div>

                {fiatAmount && parseFloat(fiatAmount) >= 25 && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-3">Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>You pay</span>
                        <span className="font-medium">
                          {fiatAmount} {fiatCurrency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Credit points credited</span>
                        <span className="text-primary">
                          ≈ {Math.floor(parseFloat(fiatAmount))} points (1:1)
                        </span>
                      </div>
                      <div className="border-t pt-2 text-xs text-muted-foreground">
                        Gateway fees may apply at checkout. Native RING is purchased separately via
                        Token Desk (credit → native).
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!fiatAmount || parseFloat(fiatAmount) < 25 || fiatIsPending}
                  className="w-full"
                  size="lg"
                >
                  {fiatIsPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Proceed to Card Payment
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    Card top-up adds <strong>credit points</strong>, not on-chain RING. Use Token Desk
                    on the wallet page to convert credit → native token when needed.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {showOnramp && (
          <>
            <TabsContent value="native_card" className="space-y-6">
              <form action={onrampFormAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="source" value="wallet_topup_page:native_card" />
                <Card>
                  <CardHeader>
                    <CardTitle>Buy {nativeSymbol} with card</CardTitle>
                    <CardDescription>
                      Confidential onramp — card charge settles native {nativeSymbol} from treasury
                      (CONFIDENTIAL_TOKEN_ONRAMP).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {onrampState?.error && (
                      <Alert className="border-destructive bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertDescription className="text-destructive">
                          {onrampState.error}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="onramp-amount">Amount ({fiatCurrency})</Label>
                      <Input
                        id="onramp-amount"
                        name="amount"
                        type="number"
                        min="25"
                        max="2000"
                        step="1"
                        placeholder="100"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={onrampIsPending}>
                      {onrampIsPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Buy {nativeSymbol}
                    </Button>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>

            <TabsContent value="native_paypal" className="space-y-6">
              <form action={onrampFormAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="source" value="wallet_topup_page:native_paypal" />
                <input type="hidden" name="processor" value="paypal" />
                <Card>
                  <CardHeader>
                    <CardTitle>Buy {nativeSymbol} with PayPal</CardTitle>
                    <CardDescription>
                      Phase S8 stub — routed through PaymentConductor (PAYPAL_NOT_IMPLEMENTED until live).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    <Button type="submit" className="w-full" size="lg" disabled={onrampIsPending}>
                      {onrampIsPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Buy {nativeSymbol} via PayPal
                    </Button>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

