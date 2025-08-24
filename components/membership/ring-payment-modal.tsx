'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Crown, 
  Coins, 
  ArrowRight, 
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useCreditBalance } from '@/hooks/use-credit-balance'

interface RingPaymentModalProps {
  onClose: () => void
  onSuccess?: () => void
  paymentType: 'membership_upgrade' | 'subscription_renewal' | 'membership_fee'
  returnTo?: string
}

interface PaymentOption {
  type: 'membership_upgrade' | 'subscription_renewal' | 'membership_fee'
  title: string
  description: string
  cost: {
    ring_amount: string
    usd_equivalent: string
  }
  benefits: string[]
  recommended?: boolean
}

export function RingPaymentModal({ 
  onClose, 
  onSuccess, 
  paymentType,
  returnTo 
}: RingPaymentModalProps) {
  const t = useTranslations('modules.membership')
  const { balance, refresh } = useCreditBalance()
  
  const [autoSubscribe, setAutoSubscribe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; benefits?: string[] } | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(true)

  // Load payment information
  useEffect(() => {
    const loadPaymentInfo = async () => {
      try {
        const response = await fetch(`/api/membership/payment/ring?type=${paymentType}`)
        if (response.ok) {
          const info = await response.json()
          setPaymentInfo(info)
        }
      } catch (error) {
        console.error('Failed to load payment info:', error)
      } finally {
        setIsLoadingInfo(false)
      }
    }

    loadPaymentInfo()
  }, [paymentType])

  const memberBenefits = [
    t('benefits.confidential_access', { defaultValue: 'Access to confidential opportunities' }),
    t('benefits.priority_support', { defaultValue: 'Priority customer support' }),
    t('benefits.advanced_entities', { defaultValue: 'Advanced entity creation features' }),
    t('benefits.premium_messaging', { defaultValue: 'Premium messaging capabilities' }),
    t('benefits.analytics', { defaultValue: 'Analytics dashboard access' }),
  ]

  const paymentOptions: Record<string, PaymentOption> = {
    membership_upgrade: {
      type: 'membership_upgrade',
      title: t('payment.upgrade.title', { defaultValue: 'Upgrade to Member' }),
      description: t('payment.upgrade.description', { defaultValue: 'Unlock all Member features with RING tokens' }),
      cost: { ring_amount: '1.0', usd_equivalent: '1.00' },
      benefits: memberBenefits,
      recommended: true,
    },
    subscription_renewal: {
      type: 'subscription_renewal',
      title: t('payment.renewal.title', { defaultValue: 'Renew Subscription' }),
      description: t('payment.renewal.description', { defaultValue: 'Extend your membership for another month' }),
      cost: { ring_amount: '1.0', usd_equivalent: '1.00' },
      benefits: [t('payment.renewal.restore_access', { defaultValue: 'Restore full Member access' })],
    },
    membership_fee: {
      type: 'membership_fee',
      title: t('payment.fee.title', { defaultValue: 'Pay Membership Fee' }),
      description: t('payment.fee.description', { defaultValue: 'One-time membership payment' }),
      cost: { ring_amount: '1.0', usd_equivalent: '1.00' },
      benefits: [t('payment.fee.no_subscription', { defaultValue: 'No automatic renewals' })],
    },
  }

  const currentOption = paymentOptions[paymentType]
  const currentBalance = parseFloat(balance?.amount || '0')
  const requiredAmount = parseFloat(currentOption.cost.ring_amount)
  const hasSufficientBalance = currentBalance >= requiredAmount

  const handlePayment = async () => {
    if (!hasSufficientBalance) return

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const requestBody = {
        type: paymentType,
        auto_subscribe: autoSubscribe && paymentType === 'membership_upgrade',
      }

      const response = await fetch('/api/membership/payment/ring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Payment failed')
      }

      setSubmitResult({
        success: true,
        message: result.message || t('payment.success', { defaultValue: 'Payment processed successfully!' }),
        benefits: result.benefits_unlocked,
      })

      // Refresh balance
      await refresh()

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.()
      }, 3000)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setSubmitResult({
        success: false,
        message: errorMessage
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingInfo) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {currentOption.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Success State */}
          {submitResult?.success ? (
            <div className="text-center py-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">
                {t('payment.success_title', { defaultValue: 'Payment Successful!' })}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {submitResult.message}
              </p>
              
              {submitResult.benefits && submitResult.benefits.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-sm text-green-800 mb-2">
                    {t('payment.benefits_unlocked', { defaultValue: 'Benefits Unlocked' })}
                  </h4>
                  <div className="space-y-1">
                    {submitResult.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button onClick={onClose} className="w-full">
                {t('payment.continue', { defaultValue: 'Continue' })}
              </Button>
            </div>
          ) : (
            <>
              {/* Error Display */}
              {submitResult?.success === false && (
                <Alert className="border-destructive bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {submitResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Description */}
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  {currentOption.description}
                </p>
                {currentOption.recommended && (
                  <Badge variant="default" className="mb-4">
                    {t('payment.recommended', { defaultValue: 'Recommended' })}
                  </Badge>
                )}
              </div>

              {/* Current Balance */}
              <Card className={cn('border-l-4', hasSufficientBalance ? 'border-l-green-500' : 'border-l-red-500')}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t('payment.current_balance', { defaultValue: 'Current Balance' })}
                      </p>
                      <p className="font-medium">
                        {balance?.amount || '0'} RING
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {t('payment.required', { defaultValue: 'Required' })}
                      </p>
                      <p className="font-medium">
                        {currentOption.cost.ring_amount} RING
                      </p>
                    </div>
                  </div>
                  
                  {!hasSufficientBalance && (
                    <Alert className="mt-3 border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        {t('payment.insufficient_balance', { 
                          defaultValue: 'Insufficient balance. You need {shortfall} more RING tokens.',
                          shortfall: (requiredAmount - currentBalance).toFixed(2)
                        })}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Benefits */}
              <div className="space-y-3">
                <h3 className="font-medium text-center">
                  {t('payment.what_you_get', { defaultValue: 'What you get' })}
                </h3>
                <div className="space-y-2">
                  {currentOption.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-Subscribe Option */}
              {paymentType === 'membership_upgrade' && hasSufficientBalance && (
                <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="auto-subscribe"
                      checked={autoSubscribe}
                      onCheckedChange={(checked) => setAutoSubscribe(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <label htmlFor="auto-subscribe" className="text-sm font-medium cursor-pointer">
                        {t('payment.auto_subscribe', { defaultValue: 'Enable automatic renewals' })}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t('payment.auto_subscribe_description', { 
                          defaultValue: 'Automatically deduct 1 RING token monthly to maintain your membership. Cancel anytime.' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Summary */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-center items-center space-x-2 mb-2">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="text-xl font-bold">{currentOption.cost.ring_amount} RING</span>
                  <span className="text-sm text-muted-foreground">
                    (≈ ${currentOption.cost.usd_equivalent} USD)
                  </span>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {paymentType === 'membership_upgrade' && autoSubscribe
                    ? t('payment.monthly_recurring', { defaultValue: 'Monthly recurring payment' })
                    : t('payment.one_time', { defaultValue: 'One-time payment' })
                  }
                </p>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                {hasSufficientBalance ? (
                  <Button 
                    onClick={handlePayment}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('payment.processing', { defaultValue: 'Processing...' })}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {t('payment.pay_now', { defaultValue: 'Pay Now' })}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {
                      // TODO: Open top-up modal
                      window.location.href = '/profile/wallet'
                    }}
                    className="flex-1"
                    variant="default"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    {t('payment.top_up_first', { defaultValue: 'Top Up Balance' })}
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {t('payment.cancel', { defaultValue: 'Cancel' })}
                </Button>
              </div>

              {/* Additional Information */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {t('payment.secure_notice', { 
                    defaultValue: 'Payments are processed securely using smart contracts on Polygon network.' 
                  })}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
