'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface PinAccessModalProps {
  onPinVerified: (walletAddress: string, accessToken: string) => void
  children: React.ReactNode
}

export function PinAccessModal({ onPinVerified, children }: PinAccessModalProps) {
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validate PIN format
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        throw new Error('PIN must be exactly 4 digits')
      }

      // Call the PIN verification API
      const response = await fetch('/api/wallet/pin-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'PIN verification failed')
      }

      const { accessToken, walletAddress } = await response.json()

      // Call the success callback
      onPinVerified(walletAddress, accessToken)

      // Show success and close modal
      toast({
        title: 'PIN Verified',
        description: 'Emergency access granted for 15 minutes',
      })

      setIsOpen(false)
      setPin('')

    } catch (err: any) {
      setError(err.message)
      toast({
        title: 'PIN Verification Failed',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Emergency PIN Access
          </DialogTitle>
          <DialogDescription>
            Enter your 4-digit PIN to access your wallet funds. This provides temporary access for emergency situations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> PIN access is for emergency fund recovery only.
              Your private key remains encrypted and secure.
            </AlertDescription>
          </Alert>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">4-Digit PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter PIN"
                className="text-center text-lg tracking-widest"
                disabled={isLoading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || pin.length !== 4}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify PIN'
                )}
              </Button>
            </div>
          </form>

          <div className="text-xs text-muted-foreground text-center">
            Access expires after 15 minutes. Contact support if you forgot your PIN.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
