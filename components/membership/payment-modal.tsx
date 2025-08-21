'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Construction } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface PaymentModalProps {
  onClose: () => void
  returnTo?: string
}

export function PaymentModal({ onClose, returnTo }: PaymentModalProps) {
  const t = useTranslations('modules.membership')
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payment.title', { defaultValue: 'Complete Payment' })}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Alert>
            <Construction className="h-4 w-4" />
            <AlertDescription>
              {t('payment.placeholder', { defaultValue: 'WayForPay integration will be implemented in Phase 3. For now, this is a placeholder.' })}
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted p-4 rounded-lg text-center">
            <div className="flex justify-center items-center space-x-2 mb-2">
              <span className="text-2xl font-bold">₴299</span>
              <span className="text-sm text-muted-foreground">UAH</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('payment.membership_fee', { defaultValue: 'One-time membership upgrade fee' })}
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => {
                // TODO: Implement WayForPay integration in Phase 3
                alert('Payment integration will be implemented in Phase 3')
              }}
              className="w-full"
              disabled
            >
              {t('payment.proceed', { defaultValue: 'Proceed to Payment (Coming Soon)' })}
            </Button>
            
            <Button 
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              {t('payment.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
