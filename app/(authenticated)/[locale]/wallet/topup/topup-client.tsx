'use client'

import { useState, useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Coins, 
  Wallet, 
  CreditCard, 
  ArrowRight, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Apple,
  Smartphone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n-config'

interface WalletTopUpClientProps {
  locale: Locale
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function WalletTopUpClient({ locale, searchParams }: WalletTopUpClientProps) {
  const t = useTranslations('modules.wallet')

  // React 19 useTransition for non-blocking tab and payment method changes
  const [isPending, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<string>('ring')
  
  // RING Token state
  const [ringAmount, setRingAmount] = useState('')
  const [ringDescription, setRingDescription] = useState('')
  const [txHash, setTxHash] = useState('')
  const [isSubmittingRing, setIsSubmittingRing] = useState(false)
  const [ringResult, setRingResult] = useState<{ success: boolean; message: string } | null>(null)

  // WayForPay state
  const [fiatAmount, setFiatAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'applepay' | 'googlepay'>('card')
  const [isSubmittingFiat, setIsSubmittingFiat] = useState(false)
  const [fiatResult, setFiatResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleRingTopUp = async () => {
    if (!ringAmount) return

    const amountNum = parseFloat(ringAmount)
    if (amountNum <= 0 || amountNum > 10000) {
      setRingResult({
        success: false,
        message: t('topup.error.invalid_amount', {
          defaultValue: 'Amount must be between 0.01 and 10000 RING',
        })
      })
      return
    }

    setIsSubmittingRing(true)
    setRingResult(null)

    try {
      const requestBody = {
        amount: ringAmount,
        description: ringDescription || `Top-up via Blockchain Transfer`,
        tx_hash: txHash || undefined,
        metadata: {
          method: 'blockchain_transfer',
          user_initiated: true,
        },
      }

      const response = await fetch('/api/wallet/credit/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Top-up failed')
      }

      setRingResult({
        success: true,
        message: result.message || t('topup.success', { 
          defaultValue: 'Successfully added {amount} RING to your balance',
          amount: ringAmount
        })
      })

      logger.info('RING top-up successful', { 
        amount: ringAmount, 
        method: 'blockchain_transfer',
        transactionId: result.transaction_id 
      })

      // Reset form after success
      setTimeout(() => {
        setRingAmount('')
        setRingDescription('')
        setTxHash('')
        setRingResult(null)
      }, 3000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setRingResult({
        success: false,
        message: errorMessage
      })
      
      logger.error('RING top-up failed', { amount: ringAmount, error })
    } finally {
      setIsSubmittingRing(false)
    }
  }

  const handleWayForPayTopUp = async () => {
    if (!fiatAmount) return

    const amountNum = parseFloat(fiatAmount)
    if (amountNum < 25 || amountNum > 2000) {
      setFiatResult({
        success: false,
        message: 'Amount must be between $25 and $2000',
      })
      return
    }

    setIsSubmittingFiat(true)
    setFiatResult(null)

    try {
      // TODO: Implement WayForPay integration
      // For now, show a placeholder message
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setFiatResult({
        success: false,
        message: 'WayForPay integration coming soon. Please use RING token transfer for now.',
      })

      logger.info('WayForPay top-up attempted', { 
        amount: fiatAmount, 
        method: paymentMethod 
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setFiatResult({
        success: false,
        message: errorMessage
      })
      
      logger.error('WayForPay top-up failed', { amount: fiatAmount, error })
    } finally {
      setIsSubmittingFiat(false)
    }
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

      <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="ring" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            RING Tokens
          </TabsTrigger>
          <TabsTrigger value="wayforpay" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Card Payment
          </TabsTrigger>
        </TabsList>

        {/* RING Token Transfer Tab */}
        <TabsContent value="ring" className="space-y-6">
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
              {ringResult && (
                <Alert className={ringResult.success ? 'border-green-200 bg-green-50' : 'border-destructive bg-destructive/10'}>
                  {ringResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertDescription className={ringResult.success ? 'text-green-800' : 'text-destructive'}>
                    {ringResult.message}
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
                onClick={handleRingTopUp}
                disabled={!ringAmount || parseFloat(ringAmount) <= 0 || isSubmittingRing}
                className="w-full"
                size="lg"
              >
                {isSubmittingRing ? (
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
        </TabsContent>

        {/* WayForPay Tab */}
        <TabsContent value="wayforpay" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Card Payment via WayForPay
              </CardTitle>
              <CardDescription>
                Purchase RING tokens with credit card, Apple Pay, or Google Pay
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Success/Error Display */}
              {fiatResult && (
                <Alert className={fiatResult.success ? 'border-green-200 bg-green-50' : 'border-destructive bg-destructive/10'}>
                  {fiatResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertDescription className={fiatResult.success ? 'text-green-800' : 'text-destructive'}>
                    {fiatResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Method Selection */}
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
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="fiat-amount" className="text-sm font-medium">
                  Amount (USD)
                </Label>
                <div className="relative">
                  <Input
                    id="fiat-amount"
                    type="number"
                    placeholder="0.00"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    className="pr-12"
                    min="25"
                    max="2000"
                    step="1"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    USD
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: $25</span>
                  <span>Max: $2,000</span>
                </div>
              </div>

              {/* Conversion Display */}
              {fiatAmount && parseFloat(fiatAmount) >= 25 && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-3">Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="font-medium">${fiatAmount} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Exchange Rate</span>
                      <span>1 RING = $1.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Fee</span>
                      <span className="text-orange-600">3.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fee Amount</span>
                      <span>${(parseFloat(fiatAmount) * 0.035).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>You will receive</span>
                      <span className="text-primary">≈ {(parseFloat(fiatAmount) * 0.965).toFixed(2)} RING</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button 
                onClick={handleWayForPayTopUp}
                disabled={!fiatAmount || parseFloat(fiatAmount) < 25 || isSubmittingFiat}
                className="w-full"
                size="lg"
              >
                {isSubmittingFiat ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>

              {/* Coming Soon Badge */}
              <Alert>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Coming Soon</Badge>
                    <span>
                      WayForPay integration is currently in development. Please use RING token transfer for now.
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

