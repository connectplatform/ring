'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Coins, 
  Plus,
  TrendingUp, 
  Clock, 
  AlertTriangle,
  RefreshCw 
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { RingTopUpModal } from './ring-topup-modal'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'

interface CreditBalanceProps {
  className?: string
  showControls?: boolean
  compact?: boolean
  onBalanceChange?: (balance: string) => void
}

export function CreditBalance({ 
  className, 
  showControls = true, 
  compact = false,
  onBalanceChange 
}: CreditBalanceProps) {
  const t = useTranslations('modules.wallet')
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  
  const { 
    balance, 
    subscription, 
    isLoading, 
    isRefreshing,
    error, 
    refresh 
  } = useCreditBalanceContext()

  // Notify parent of balance changes
  useEffect(() => {
    if (balance && onBalanceChange) {
      onBalanceChange(balance.amount)
    }
  }, [balance, onBalanceChange])    

  // Determine balance status for styling
  const getBalanceStatus = () => {
    if (!balance?.amount) return 'unknown'
    const amount = parseFloat(balance?.amount)
    
    if (amount >= 12) return 'healthy' // 1+ year of membership
    if (amount >= 3) return 'moderate' // 3+ months
    if (amount >= 1) return 'low' // 1+ month
    return 'critical' // Less than 1 month
  }

  const balanceStatus = getBalanceStatus()
  
  // Status-based styling
  const balanceColors = {
    healthy: 'text-green-600 dark:text-green-400',
    moderate: 'text-yellow-600 dark:text-yellow-400', 
    low: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-600 dark:text-red-400',
    unknown: 'text-muted-foreground'
  }

  const badgeVariants = {
    healthy: 'default',
    moderate: 'secondary',
    low: 'outline', 
    critical: 'destructive',
    unknown: 'secondary'
  } as const

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        </CardHeader>
        <CardContent className={compact ? 'pt-2' : ''}>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('w-full border-destructive', className)}>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive mb-4">
              {t('credit_balance.error', { defaultValue: 'Failed to load balance' })}
            </p>
            <Button 
              onClick={refresh} 
              variant="outline" 
              size="sm"
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              {t('credit_balance.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardHeader className={cn('flex flex-row items-center justify-between space-y-0', compact ? 'pb-2' : 'pb-3')}>
          <CardTitle className={cn('flex items-center gap-2', compact ? 'text-sm' : 'text-base')}>
            <Coins className={cn('text-primary', compact ? 'h-4 w-4' : 'h-5 w-5')} />
            {t('credit_balance.title', { defaultValue: 'RING Balance' })}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariants[balanceStatus]} className="text-xs">
              {t(`credit_balance.status.${balanceStatus}`, { defaultValue: balanceStatus })}
            </Badge>
            
            {!compact && (
              <Button
                onClick={refresh}
                variant="ghost"
                size="sm"
                disabled={isRefreshing}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className={compact ? 'pt-2' : ''}>
          <div className="space-y-3">
            {/* Main Balance Display */}
            <div className="flex items-baseline justify-between">
              <div className="space-y-1">
                <div className={cn('font-bold', compact ? 'text-lg' : 'text-2xl', balanceColors[balanceStatus])}>
                  {balance?.amount ? balance.amount : '0'} RING
                </div>
                <div className="text-xs text-muted-foreground">
                  ≈ ${balance?.usd_equivalent || '0.00'} USD
                </div>
              </div>
              
              {subscription?.active && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t('credit_balance.next_payment', { defaultValue: 'Next Payment' })}
                  </div>
                  <div className="text-sm font-medium">
                    {subscription.next_payment 
                      ? new Date(subscription.next_payment).toLocaleDateString()
                      : t('credit_balance.unknown', { defaultValue: 'Unknown' })
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Status */}
            {subscription && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3 w-3" />
                <span className="text-muted-foreground">
                  {subscription.active 
                    ? t('credit_balance.subscription_active', { defaultValue: 'Auto-renewing monthly' })
                    : t('credit_balance.subscription_inactive', { defaultValue: 'No active subscription' })
                  }
                </span>
              </div>
            )}

            {/* Low Balance Warning */}
            {balanceStatus === 'critical' && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">
                    {t('credit_balance.low_balance_title', { defaultValue: 'Low Balance' })}
                  </p>
                  <p className="text-destructive/80 text-xs mt-1">
                    {t('credit_balance.low_balance_message', { 
                      defaultValue: 'Your balance is below 1 RING. Top up to ensure uninterrupted service.' 
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {showControls && !compact && (
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => setShowTopUpModal(true)}
                  size="sm"
                  variant="default"
                  className="flex-1"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('credit_balance.top_up', { defaultValue: 'Top Up' })}
                </Button>
                
                <Button
                  onClick={() => {
                    // TODO: Navigate to transaction history
                    window.location.href = '/profile/wallet/history'
                  }}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t('credit_balance.history', { defaultValue: 'History' })}
                </Button>
              </div>
            )}

            {/* Compact Controls */}
            {showControls && compact && (
              <div className="flex gap-1">
                <Button 
                  onClick={() => setShowTopUpModal(true)}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  onClick={() => window.location.href = '/profile/wallet/history'}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                >
                  <TrendingUp className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Quick Stats */}
            {!compact && balance && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">
                    {t('credit_balance.months_remaining', { defaultValue: 'Months Left' })}
                  </div>
                  <div className="font-medium">
                    {Math.floor(parseFloat(balance?.amount || '0'))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">
                    {t('credit_balance.last_updated', { defaultValue: 'Updated' })}
                  </div>
                  <div className="font-medium text-xs">
                    {new Date(balance?.last_updated || 0).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Up Modal */}
      {showTopUpModal && (
        <RingTopUpModal 
          onClose={() => setShowTopUpModal(false)}
          onSuccess={() => {
            setShowTopUpModal(false)
            refresh() // Refresh balance after successful top-up
          }}
        />
      )}
    </>
  )
}
