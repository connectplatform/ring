'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Crown, 
  Calendar, 
  RefreshCw, 
  XCircle, 
  CheckCircle,
  AlertTriangle,
  Coins,
  Clock,
  Zap
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { RingPaymentModal } from './ring-payment-modal'

interface SubscriptionManagementProps {
  className?: string
  onSubscriptionChange?: () => void
}

interface SubscriptionData {
  user: {
    current_tier: string
    has_active_membership: boolean
    can_upgrade: boolean
  }
  subscription: {
    status: 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED'
    start_time?: number
    next_payment_due?: number
    failed_attempts: number
    auto_renew: boolean
    total_paid: string
    payments_count: number
    days_until_payment?: number
    payment_overdue?: boolean
  } | null
  balance: {
    ring_amount: string
    sufficient_for_renewal: boolean
  }
  actions: {
    can_create: boolean
    can_renew: boolean
    can_cancel: boolean
    can_modify: boolean
  }
  warnings: Array<{ type: string; message: string; action: string }>
  notifications: Array<{ type: string; message: string; action: string }>
}

export function SubscriptionManagement({ className, onSubscriptionChange }: SubscriptionManagementProps) {
  const t = useTranslations('modules.membership')
  
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState<{ 
    show: boolean; 
    type?: 'membership_upgrade' | 'subscription_renewal' | 'membership_fee' 
  }>({ show: false })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchSubscriptionStatus = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      
      setError(null)

      const response = await fetch('/api/membership/subscription/status')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch subscription status: ${response.status}`)
      }

      const subscriptionData: SubscriptionData = await response.json()
      setData(subscriptionData)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!window.confirm(t('subscription.cancel_confirm', { 
      defaultValue: 'Are you sure you want to cancel your subscription?' 
    }))) {
      return
    }

    setActionLoading('cancel')
    
    try {
      const response = await fetch('/api/membership/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User requested cancellation' }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel subscription')
      }

      await fetchSubscriptionStatus(true)
      onSubscriptionChange?.()
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Cancellation failed')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'ACTIVE': { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      'EXPIRED': { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-600' },
      'CANCELLED': { variant: 'secondary' as const, icon: XCircle, color: 'text-gray-600' },
      'SUSPENDED': { variant: 'outline' as const, icon: AlertTriangle, color: 'text-orange-600' },
      'INACTIVE': { variant: 'outline' as const, icon: Clock, color: 'text-gray-600' },
    }
    
    return statusMap[status as keyof typeof statusMap] || statusMap.INACTIVE
  }

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Card className={cn('w-full border-destructive', className)}>
        <CardContent className="pt-6">
          <Alert className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => fetchSubscriptionStatus(true)} 
            variant="outline" 
            className="w-full mt-4"
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            {t('subscription.retry', { defaultValue: 'Retry' })}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const subscription = data?.subscription
  const statusInfo = subscription ? getStatusBadge(subscription.status) : null

  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t('subscription.title', { defaultValue: 'RING Subscription' })}
          </CardTitle>
          
          <Button
            onClick={() => fetchSubscriptionStatus(true)}
            variant="ghost"
            size="sm"
            disabled={isRefreshing}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Warnings */}
          {data?.warnings && data.warnings.length > 0 && (
            <div className="space-y-2">
              {data.warnings.map((warning, index) => (
                <Alert key={index} className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <div className="font-medium">{warning.message}</div>
                    <div className="text-xs mt-1">{warning.action}</div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Notifications */}
          {data?.notifications && data.notifications.length > 0 && (
            <div className="space-y-2">
              {data.notifications.map((notification, index) => (
                <Alert key={index} className="border-blue-200 bg-blue-50">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="font-medium">{notification.message}</div>
                    <div className="text-xs mt-1">{notification.action}</div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Subscription Status */}
          {subscription ? (
            <div className="space-y-4">
              {/* Status Overview */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {statusInfo && <statusInfo.icon className={cn('h-4 w-4', statusInfo.color)} />}
                    <span className="font-medium">
                      {t(`subscription.status.${subscription.status.toLowerCase()}`, {
                        defaultValue: subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase()
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {subscription.payments_count} payments • {subscription.total_paid} RING total
                  </div>
                </div>
                
                {statusInfo && (
                  <Badge variant={statusInfo.variant}>
                    {subscription.status}
                  </Badge>
                )}
              </div>

              {/* Payment Information */}
              {subscription.next_payment_due && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-background border rounded-lg">
                    <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('subscription.next_payment', { defaultValue: 'Next Payment' })}
                    </div>
                    <div className="font-medium text-sm">
                      {subscription.days_until_payment !== undefined
                        ? subscription.days_until_payment > 0
                          ? t('subscription.days_remaining', { 
                              defaultValue: 'In {days} days',
                              days: subscription.days_until_payment
                            })
                          : t('subscription.overdue', { 
                              defaultValue: '{days} days overdue',
                              days: Math.abs(subscription.days_until_payment)
                            })
                        : new Date(subscription.next_payment_due).toLocaleDateString()
                      }
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-background border rounded-lg">
                    <Coins className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('subscription.monthly_cost', { defaultValue: 'Monthly Cost' })}
                    </div>
                    <div className="font-medium text-sm">
                      1.0 RING
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">
                {t('subscription.no_subscription', { defaultValue: 'No Active Subscription' })}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('subscription.upgrade_message', { 
                  defaultValue: 'Upgrade to Member tier with automatic RING token payments' 
                })}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {data?.actions.can_create && (
              <Button 
                onClick={() => setShowPaymentModal({ show: true, type: 'membership_upgrade' })}
                className="w-full"
              >
                <Crown className="h-4 w-4 mr-2" />
                {t('subscription.create', { defaultValue: 'Create RING Subscription' })}
              </Button>
            )}

            {data?.actions.can_renew && (
              <Button 
                onClick={() => setShowPaymentModal({ show: true, type: 'subscription_renewal' })}
                className="w-full"
                variant="default"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('subscription.renew', { defaultValue: 'Renew Subscription' })}
              </Button>
            )}

            {data?.actions.can_cancel && (
              <Button 
                onClick={handleCancelSubscription}
                variant="outline"
                className="w-full"
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {t('subscription.cancelling', { defaultValue: 'Cancelling...' })}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('subscription.cancel', { defaultValue: 'Cancel Subscription' })}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Subscription Benefits Reminder */}
          {data?.user.has_active_membership && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {t('subscription.benefits_title', { defaultValue: 'Your Member Benefits' })}
              </h4>
              <div className="space-y-1">
                {[
                  t('benefits.confidential_access', { defaultValue: 'Confidential opportunities access' }),
                  t('benefits.priority_support', { defaultValue: 'Priority customer support' }),
                  t('benefits.advanced_features', { defaultValue: 'Advanced platform features' }),
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage Statistics */}
          {subscription && subscription.payments_count > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">
                  {t('subscription.payments_made', { defaultValue: 'Payments' })}
                </div>
                <div className="font-medium">{subscription.payments_count}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">
                  {t('subscription.total_paid', { defaultValue: 'Total Paid' })}
                </div>
                <div className="font-medium">{subscription.total_paid} RING</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">
                  {t('subscription.member_since', { defaultValue: 'Member Since' })}
                </div>
                <div className="font-medium text-xs">
                  {subscription.start_time 
                    ? new Date(subscription.start_time).toLocaleDateString()
                    : '--'
                  }
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal.show && showPaymentModal.type && (
        <RingPaymentModal
          paymentType={showPaymentModal.type}
          onClose={() => setShowPaymentModal({ show: false })}
          onSuccess={async () => {
            setShowPaymentModal({ show: false })
            await fetchSubscriptionStatus(true)
            onSubscriptionChange?.()
          }}
        />
      )}
    </>
  )
}
