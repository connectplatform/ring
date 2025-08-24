'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  Loader2 
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface RingTopUpModalProps {
  onClose: () => void
  onSuccess?: () => void
  initialAmount?: string
}

interface TopUpMethod {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  min_amount: string
  max_amount: string
  fees: string
  estimated_time: string
  available: boolean
}

export function RingTopUpModal({ onClose, onSuccess, initialAmount = '' }: RingTopUpModalProps) {
  const t = useTranslations('modules.wallet')
  
  const [selectedMethod, setSelectedMethod] = useState<string>('blockchain_transfer')
  const [amount, setAmount] = useState(initialAmount)
  const [description, setDescription] = useState('')
  const [txHash, setTxHash] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  const topUpMethods: TopUpMethod[] = [
    {
      id: 'blockchain_transfer',
      name: t('topup.methods.blockchain.name', { defaultValue: 'Blockchain Transfer' }),
      description: t('topup.methods.blockchain.description', { defaultValue: 'Transfer RING tokens directly from your wallet' }),
      icon: Wallet,
      min_amount: '0.01',
      max_amount: '10000',
      fees: '0%',
      estimated_time: '1-3 minutes',
      available: true,
    },
    {
      id: 'crypto_purchase',
      name: t('topup.methods.crypto.name', { defaultValue: 'Buy RING Tokens' }),
      description: t('topup.methods.crypto.description', { defaultValue: 'Purchase RING tokens with crypto' }),
      icon: Coins,
      min_amount: '10',
      max_amount: '5000',
      fees: '2.5%',
      estimated_time: '5-15 minutes',
      available: false, // TODO: Implement
    },
    {
      id: 'fiat_purchase',
      name: t('topup.methods.fiat.name', { defaultValue: 'Buy with Fiat' }),
      description: t('topup.methods.fiat.description', { defaultValue: 'Purchase RING tokens with credit card' }),
      icon: CreditCard,
      min_amount: '25',
      max_amount: '2000',
      fees: '3.5%',
      estimated_time: '10-30 minutes',
      available: false, // TODO: Implement
    },
  ]

  const selectedMethodData = topUpMethods.find(m => m.id === selectedMethod)

  const handleSubmit = async () => {
    if (!selectedMethodData || !amount) return

    const amountNum = parseFloat(amount)
    const minAmount = parseFloat(selectedMethodData.min_amount)
    const maxAmount = parseFloat(selectedMethodData.max_amount)

    if (amountNum < minAmount || amountNum > maxAmount) {
      setSubmitResult({
        success: false,
        message: t('topup.error.invalid_amount', {
          defaultValue: `Amount must be between ${minAmount} and ${maxAmount} RING`,
          min: minAmount,
          max: maxAmount,
        })
      })
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const requestBody = {
        amount,
        description: description || `Top-up via ${selectedMethodData.name}`,
        tx_hash: txHash || undefined,
        metadata: {
          method: selectedMethod,
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

      setSubmitResult({
        success: true,
        message: result.message || t('topup.success', { 
          defaultValue: 'Successfully added {amount} RING to your balance',
          amount 
        })
      })

      logger.info('RING top-up successful', { 
        amount, 
        method: selectedMethod,
        transactionId: result.transaction_id 
      })

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.()
      }, 2000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSubmitResult({
        success: false,
        message: errorMessage
      })
      
      logger.error('RING top-up failed', { amount, method: selectedMethod, error })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = amount && parseFloat(amount) > 0 && selectedMethodData?.available

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {t('topup.title', { defaultValue: 'Top Up RING Balance' })}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Success/Error Display */}
          {submitResult && (
            <Alert className={submitResult.success ? 'border-green-200 bg-green-50' : 'border-destructive bg-destructive/10'}>
              {submitResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={submitResult.success ? 'text-green-800' : 'text-destructive'}>
                {submitResult.message}
              </AlertDescription>
            </Alert>
          )}

          {!submitResult?.success && (
            <>
              {/* Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  {t('topup.method_label', { defaultValue: 'Top-up Method' })}
                </Label>
                <div className="grid gap-3">
                  {topUpMethods.map((method) => {
                    const Icon = method.icon
                    return (
                      <div
                        key={method.id}
                        onClick={() => method.available && setSelectedMethod(method.id)}
                        className={cn(
                          'p-4 border rounded-lg cursor-pointer transition-colors',
                          selectedMethod === method.id && method.available
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border/80',
                          !method.available && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-sm">{method.name}</h4>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {method.fees} fees
                                </Badge>
                                {!method.available && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('topup.coming_soon', { defaultValue: 'Coming Soon' })}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {method.description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{method.min_amount} - {method.max_amount} RING</span>
                              <span>{method.estimated_time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedMethodData?.available && (
                <>
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">
                      {t('topup.amount_label', { defaultValue: 'Amount (RING)' })}
                    </Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pr-12"
                        min={selectedMethodData.min_amount}
                        max={selectedMethodData.max_amount}
                        step="0.01"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        RING
                      </div>
                    </div>
                    {amount && selectedMethodData && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {t('topup.range', { 
                            defaultValue: 'Range: {min} - {max} RING',
                            min: selectedMethodData.min_amount,
                            max: selectedMethodData.max_amount 
                          })}
                        </span>
                        <span>
                          ≈ ${(parseFloat(amount) * 1.0).toFixed(2)} USD
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transaction Hash (for blockchain transfers) */}
                  {selectedMethod === 'blockchain_transfer' && (
                    <div className="space-y-2">
                      <Label htmlFor="txHash" className="text-sm font-medium">
                        {t('topup.tx_hash_label', { defaultValue: 'Transaction Hash (Optional)' })}
                      </Label>
                      <Input
                        id="txHash"
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
                  )}

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      {t('topup.description_label', { defaultValue: 'Description (Optional)' })}
                    </Label>
                    <Textarea
                      id="description"
                      placeholder={t('topup.description_placeholder', { 
                        defaultValue: 'Add a note for this top-up...' 
                      })}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[60px] resize-none"
                      maxLength={200}
                    />
                  </div>

                  {/* Summary */}
                  {amount && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium text-sm mb-3">
                        {t('topup.summary', { defaultValue: 'Top-up Summary' })}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>{t('topup.amount', { defaultValue: 'Amount' })}</span>
                          <span className="font-medium">{amount} RING</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('topup.method', { defaultValue: 'Method' })}</span>
                          <span>{selectedMethodData.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('topup.fees', { defaultValue: 'Fees' })}</span>
                          <span>{selectedMethodData.fees}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('topup.estimated_time', { defaultValue: 'Time' })}</span>
                          <span>{selectedMethodData.estimated_time}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-medium">
                          <span>{t('topup.total', { defaultValue: 'You will receive' })}</span>
                          <span className="text-primary">{amount} RING</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                {selectedMethodData?.available ? (
                  <Button 
                    onClick={handleSubmit}
                    disabled={!isFormValid || isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('topup.processing', { defaultValue: 'Processing...' })}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {selectedMethod === 'blockchain_transfer'
                          ? t('topup.record_transfer', { defaultValue: 'Record Transfer' })
                          : t('topup.proceed', { defaultValue: 'Proceed to Payment' })
                        }
                      </>
                    )}
                  </Button>
                ) : (
                  <Button disabled className="flex-1">
                    {t('topup.method_unavailable', { defaultValue: 'Method Not Available' })}
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {t('topup.cancel', { defaultValue: 'Cancel' })}
                </Button>
              </div>

              {/* Help Text */}
              {selectedMethod === 'blockchain_transfer' && (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {t('topup.blockchain_help', { 
                      defaultValue: 'If you\'ve already sent RING tokens to your wallet, enter the amount and transaction hash to update your balance. Otherwise, first send tokens to your wallet address.' 
                    })}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Success State */}
          {submitResult?.success && (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">
                {t('topup.success_title', { defaultValue: 'Top-up Successful!' })}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {submitResult.message}
              </p>
              <Button onClick={onClose} className="w-full">
                {t('topup.done', { defaultValue: 'Done' })}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
