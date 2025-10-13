'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Wallet, 
  Plus, 
  ArrowUpDown, 
  History, 
  Copy, 
  Check, 
  AlertTriangle,
  Loader2,
  TrendingUp,
  DollarSign
} from 'lucide-react'
import { useCreditBalance } from '@/hooks/use-credit-balance'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n-config'

interface WalletPageClientProps {
  locale: Locale
  searchParams: Record<string, string | string[] | undefined>
}

export default function WalletPageClient({ locale, searchParams }: WalletPageClientProps) {
  const t = useTranslations('modules.wallet')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)

  // Get wallet balance data
  const { 
    balance: ringBalance, 
    subscription,
    limits,
    isLoading: balanceLoading, 
    error: balanceError,
    refresh: refetchBalance
  } = useCreditBalance()


  // Wallet address copy functionality
  const handleCopyAddress = async () => {
    if (session?.user?.wallets?.[0]?.address) {
      try {
        await navigator.clipboard.writeText(session.user.wallets[0].address)
        setCopied(true)
        toast({
          title: "Address copied",
          description: "Wallet address copied to clipboard"
        })
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Failed to copy address",
          variant: "destructive"
        })
      }
    }
  }

  // Format wallet address for display
  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  // Format RING balance for display
  const formatBalance = (balance: string | null) => {
    if (!balance || balance === '0') return '0.00'
    const num = parseFloat(balance)
    return num.toFixed(2)
  }

  // Check if balance is low
  const hasLowBalance = parseFloat(ringBalance?.amount || '0') < 1
  const displayBalance = formatBalance(ringBalance?.amount)
  const walletAddress = session?.user?.wallets?.[0]?.address

  if (balanceLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading wallet...</p>
          </div>
        </div>
      </div>
    )
  }

  if (balanceError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Wallet Error</h2>
          <p className="text-muted-foreground mb-4">{balanceError}</p>
          <Button onClick={refetchBalance}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              {t('title') || 'Wallet'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('description') || 'Manage your RING tokens and view transaction history'}
            </p>
          </div>
          <Button onClick={refetchBalance} variant="outline" size="sm">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Balance Overview Card */}
        <Card className="mb-8 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200/50 dark:border-green-800/30">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">R</span>
                  </div>
                  <span className="text-sm text-muted-foreground">RING Balance</span>
                  {hasLowBalance && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Low Balance
                    </Badge>
                  )}
                </div>
                <div className="text-4xl font-bold mb-1">
                  {displayBalance} <span className="text-2xl text-muted-foreground">RING</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  ≈ ${ringBalance?.usd_equivalent || '0.00'} USD
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => window.location.href = `/${locale}/wallet/topup`}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Top Up RING
                </Button>

                {walletAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAddress}
                    className="font-mono text-xs"
                  >
                    <Wallet className="h-3 w-3 mr-2" />
                    {formatAddress(walletAddress)}
                    {copied ? (
                      <Check className="h-3 w-3 ml-2 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 ml-2" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Overview */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subscription Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={subscription?.active ? "default" : "secondary"}>
                      {subscription?.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {subscription?.next_payment && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Next Payment</span>
                      <span className="text-sm">
                        {new Date(subscription.next_payment).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Spending Limits */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Monthly Limits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Limit</span>
                    <span className="text-sm font-medium">
                      {limits?.monthly_spend_limit || '0'} RING
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className="text-sm font-medium">
                      {limits?.remaining_monthly_limit || '0'} RING
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.location.href = `/${locale}/wallet/topup`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add RING Tokens
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.location.href = `/${locale}/wallet/history`}
                >
                  <History className="h-4 w-4 mr-2" />
                  View History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
