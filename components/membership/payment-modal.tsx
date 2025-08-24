'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Construction, 
  Coins, 
  CreditCard, 
  CheckCircle,
  ArrowRight,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { RingPaymentModal } from './ring-payment-modal'
import { useCreditBalance } from '@/hooks/use-credit-balance'

interface PaymentModalProps {
  onClose: () => void
  returnTo?: string
}

export function PaymentModal({ onClose, returnTo }: PaymentModalProps) {
  const t = useTranslations('modules.membership')
  const { balance } = useCreditBalance()
  const [showRingPayment, setShowRingPayment] = useState(false)
  const [selectedTab, setSelectedTab] = useState('ring')
  
  const ringBalance = parseFloat(balance?.amount || '0')
  const membershipCost = 1.0
  const hasSufficientRing = ringBalance >= membershipCost

  if (showRingPayment) {
    return (
      <RingPaymentModal
        paymentType="membership_upgrade"
        onClose={onClose}
        onSuccess={onClose}
        returnTo={returnTo}
      />
    )
  }
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('payment.title', { defaultValue: 'Complete Payment' })}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ring" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                {t('payment.ring_tokens', { defaultValue: 'RING Tokens' })}
                {hasSufficientRing && <Badge variant="default" className="text-xs">Available</Badge>}
              </TabsTrigger>
              <TabsTrigger value="fiat" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('payment.fiat', { defaultValue: 'Fiat Currency' })}
                <Badge variant="secondary" className="text-xs">Soon</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ring" className="space-y-4">
              {/* RING Payment Option */}
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    {t('payment.ring.title', { defaultValue: 'Pay with RING Tokens' })}
                  </h3>
                  {hasSufficientRing && (
                    <Badge variant="default" className="text-xs">
                      {t('payment.recommended', { defaultValue: 'Recommended' })}
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('payment.cost', { defaultValue: 'Cost' })}</span>
                    <span className="font-medium">1.0 RING (≈ $1.00 USD)</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('payment.your_balance', { defaultValue: 'Your Balance' })}</span>
                    <span className={cn(
                      'font-medium',
                      hasSufficientRing ? 'text-green-600' : 'text-red-600'
                    )}>
                      {ringBalance.toFixed(2)} RING
                    </span>
                  </div>

                  {hasSufficientRing && (
                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium">{t('payment.ring.sufficient', { defaultValue: 'Sufficient Balance' })}</p>
                        <p className="text-xs">
                          {t('payment.ring.instant', { defaultValue: 'Instant upgrade with no transaction fees' })}
                        </p>
                      </div>
                    </div>
                  )}

                  {!hasSufficientRing && (
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <p className="font-medium">
                          {t('payment.ring.insufficient', { defaultValue: 'Insufficient RING Balance' })}
                        </p>
                        <p className="text-xs mt-1">
                          {t('payment.ring.need_more', { 
                            defaultValue: 'You need {amount} more RING tokens',
                            amount: (membershipCost - ringBalance).toFixed(2)
                          })}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    onClick={() => hasSufficientRing ? setShowRingPayment(true) : window.location.href = '/profile/wallet'}
                    className="w-full"
                    variant={hasSufficientRing ? "default" : "outline"}
                  >
                    {hasSufficientRing ? (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {t('payment.ring.pay_now', { defaultValue: 'Pay with RING' })}
                      </>
                    ) : (
                      <>
                        <Coins className="h-4 w-4 mr-2" />
                        {t('payment.ring.top_up', { defaultValue: 'Top Up RING Balance' })}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fiat" className="space-y-4">
              {/* Fiat Payment Option */}
              <Alert>
                <Construction className="h-4 w-4" />
                <AlertDescription>
                  {t('payment.fiat.placeholder', { 
                    defaultValue: 'Fiat payment integration (WayForPay) will be implemented in Phase 3. For now, please use RING tokens.' 
                  })}
                </AlertDescription>
              </Alert>
              
              <div className="bg-muted p-4 rounded-lg text-center opacity-50">
                <div className="flex justify-center items-center space-x-2 mb-2">
                  <span className="text-2xl font-bold">₴299</span>
                  <span className="text-sm text-muted-foreground">UAH</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('payment.membership_fee', { defaultValue: 'One-time membership upgrade fee' })}
                </p>
              </div>
              
              <Button 
                onClick={() => {
                  alert('Fiat payment integration will be implemented in Phase 3')
                }}
                className="w-full"
                disabled
              >
                {t('payment.fiat.proceed', { defaultValue: 'Proceed to Payment (Coming Soon)' })}
              </Button>
            </TabsContent>
          </Tabs>
          
          <div className="flex space-x-3">
            <Button 
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('payment.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
