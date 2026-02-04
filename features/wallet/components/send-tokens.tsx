'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Send,
  ArrowRight,
  AlertTriangle,
  Check,
  Loader2,
  Users,
  Search,
  Plus
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { getCurrentWalletService } from '@/features/wallet/services'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import ContactList from './contact-list'
import type { WalletAccount, WalletContact, WalletTransaction } from '@/features/wallet/types'

interface SendTokensProps {
  embedded?: boolean
  onTransactionComplete?: (transaction: WalletTransaction) => void
}

/**
 * SendTokens component - Allows users to send tokens to other recipients
 * Includes contact selection, balance checking, and transaction processing
 */
export default function SendTokens({ embedded = false, onTransactionComplete }: SendTokensProps) {
  const t = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data: session } = useSession()

  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showContactSelector, setShowContactSelector] = useState(false)
  const [selectedContact, setSelectedContact] = useState<WalletContact | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    recipient: '',
    amount: '',
    tokenSymbol: 'RING',
    notes: ''
  })

  const [userWallets, setUserWallets] = useState<WalletAccount[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletAccount | null>(null)
  const [balance, setBalance] = useState<string>('0')

  const walletService = getCurrentWalletService()

  // Load user wallets and balance on mount
  useEffect(() => {
    loadUserWallets()
  }, [session?.user?.id])

  // Update balance when wallet changes
  useEffect(() => {
    if (selectedWallet) {
      loadWalletBalance(selectedWallet.address)
    }
  }, [selectedWallet])

  const loadUserWallets = async () => {
    if (!session?.user?.id) return

    try {
      const wallets = await walletService.getProjectWallets(session.user.id)
      setUserWallets(wallets)
      if (wallets.length > 0) {
        setSelectedWallet(wallets[0])
      }
    } catch (error) {
      console.error('Failed to load wallets:', error)
      toast({
        title: tCommon('error'),
        description: 'Failed to load wallets',
        variant: 'destructive'
      })
    }
  }

  const loadWalletBalance = async (address: string) => {
    try {
      // Use the existing credit balance hook for RING tokens
      const balanceData = await useCreditBalance()
      setBalance(balanceData?.balance?.amount || '0')
    } catch (error) {
      console.error('Failed to load balance:', error)
      setBalance('0')
    }
  }

  const handleContactSelect = (contact: WalletContact) => {
    setSelectedContact(contact)
    setFormData(prev => ({ ...prev, recipient: contact.address }))
    setShowContactSelector(false)
  }

  const validateForm = (): string | null => {
    if (!formData.recipient.trim()) {
      return 'Recipient address is required'
    }

    if (!formData.amount.trim() || parseFloat(formData.amount) <= 0) {
      return 'Valid amount is required'
    }

    if (parseFloat(formData.amount) > parseFloat(balance)) {
      return 'Insufficient balance'
    }

    if (!selectedWallet) {
      return 'No wallet selected'
    }

    // Basic Ethereum address validation
    if (!formData.recipient.startsWith('0x') || formData.recipient.length !== 42) {
      return 'Invalid recipient address format'
    }

    return null
  }

  const handleSendTokens = async () => {
    if (!session?.user?.id || !selectedWallet) return

    const validationError = validateForm()
    if (validationError) {
      toast({
        title: tCommon('error'),
        description: validationError,
        variant: 'destructive'
      })
      return
    }

    try {
      setIsLoading(true)

      const transaction = await walletService.sendTokens({
        globalUserId: session.user.id,
        fromAddress: selectedWallet.address,
        toAddress: formData.recipient,
        amount: formData.amount,
        tokenSymbol: formData.tokenSymbol,
        notes: formData.notes.trim() || undefined
      })

      toast({
        title: tCommon('success'),
        description: `Successfully sent ${formData.amount} ${formData.tokenSymbol} to ${selectedContact?.name || 'recipient'}`
      })

      // Reset form
      setFormData({
        recipient: '',
        amount: '',
        tokenSymbol: 'RING',
        notes: ''
      })
      setSelectedContact(null)
      setShowConfirmDialog(false)

      // Reload balance
      await loadWalletBalance(selectedWallet.address)

      // Notify parent component
      if (onTransactionComplete) {
        onTransactionComplete(transaction)
      }

    } catch (error) {
      console.error('Failed to send tokens:', error)
      toast({
        title: tCommon('error'),
        description: 'Failed to send tokens. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const availableBalance = parseFloat(balance)
  const sendAmount = parseFloat(formData.amount) || 0
  const hasInsufficientBalance = sendAmount > availableBalance

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto px-4 py-8"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Send className="h-8 w-8" />
            Send Tokens
          </h2>
          <p className="text-muted-foreground mt-2">
            Transfer tokens to another wallet address
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wallet Selection */}
          <div className="space-y-2">
            <Label>From Wallet</Label>
            <Select
              value={selectedWallet?.address || ''}
              onValueChange={(address) => {
                const wallet = userWallets.find(w => w.address === address)
                setSelectedWallet(wallet || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent>
                {userWallets.map((wallet) => (
                  <SelectItem key={wallet.address} value={wallet.address}>
                    {wallet.label} - {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWallet && (
              <p className="text-sm text-muted-foreground">
                Balance: {balance} {formData.tokenSymbol}
              </p>
            )}
          </div>

          {/* Recipient Selection */}
          <div className="space-y-2">
            <Label>To Address</Label>
            <div className="flex gap-2">
              <Input
                placeholder="0x..."
                value={formData.recipient}
                onChange={(e) => setFormData(prev => ({ ...prev, recipient: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setShowContactSelector(true)}
                title="Select from contacts"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
            {selectedContact && (
              <p className="text-sm text-muted-foreground">
                Sending to: {selectedContact.name}
              </p>
            )}
          </div>

          {/* Amount and Token */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Select
                value={formData.tokenSymbol}
                onValueChange={(value) => setFormData(prev => ({ ...prev, tokenSymbol: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RING">RING</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="POL">POL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Balance Warning */}
          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient balance. You need {sendAmount - availableBalance} more {formData.tokenSymbol}.
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add a note to this transaction..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Send Button */}
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogTrigger asChild>
              <Button
                className="w-full"
                size="lg"
                disabled={!formData.recipient || !formData.amount || hasInsufficientBalance}
              >
                <Send className="h-4 w-4 mr-2" />
                Send {formData.amount || '0'} {formData.tokenSymbol}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-mono text-sm">
                      {selectedWallet?.address.slice(0, 6)}...{selectedWallet?.address.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-mono text-sm">
                      {selectedContact?.name || `${formData.recipient.slice(0, 6)}...${formData.recipient.slice(-4)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium">
                      {formData.amount} {formData.tokenSymbol}
                    </span>
                  </div>
                  {formData.notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes:</span>
                      <span className="text-sm">{formData.notes}</span>
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please verify the recipient address. Transactions cannot be reversed.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendTokens}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirm Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Contact Selector Dialog */}
      <Dialog open={showContactSelector} onOpenChange={setShowContactSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Recipient from Contacts</DialogTitle>
          </DialogHeader>
          <ContactList
            embedded={true}
            onContactSelect={handleContactSelect}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
