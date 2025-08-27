'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Users,
  Star,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { VendorProfile, VendorDashboardStats } from '@/features/store/types/vendor'
import { SerializedEntity } from '@/features/entities/types'
import { formatCurrency } from '@/lib/utils'

interface VendorDashboardProps {
  vendor: VendorProfile
  entity: SerializedEntity
  stats: VendorDashboardStats
  locale: string
}

export function VendorDashboard({ vendor, entity, stats, locale }: VendorDashboardProps) {
  const t = useTranslations('vendor.dashboard')
  const [activeTab, setActiveTab] = useState('overview')
  
  // Calculate growth percentage
  const growthPercentage = stats.salesLastMonth > 0 
    ? ((stats.salesThisMonth - stats.salesLastMonth) / stats.salesLastMonth) * 100
    : 0
  
  // Trust level badge color
  const trustLevelColor = {
    new: 'bg-gray-500',
    basic: 'bg-blue-500',
    verified: 'bg-green-500',
    trusted: 'bg-purple-500',
    premium: 'bg-gold-500'
  }[vendor.trustLevel]
  
  return (
    <div className="space-y-6">
      {/* Store Status Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{entity.storeName || entity.name}</CardTitle>
              <CardDescription>{entity.storeSlug}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={trustLevelColor}>
                {t(`trustLevel.${vendor.trustLevel}`)}
              </Badge>
              <Badge variant={entity.storeStatus === 'open' ? 'default' : 'secondary'}>
                {t(`status.${entity.storeStatus}`)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('trustScore')}</p>
              <div className="flex items-center gap-2">
                <Progress value={vendor.trustScore} className="w-32" />
                <span className="font-semibold">{vendor.trustScore}/100</span>
              </div>
            </div>
            <div className="flex gap-2">
              {vendor.complianceStatus.taxDocumentsSubmitted ? (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('taxVerified')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {t('taxPending')}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('metrics.totalSales')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales, 'RING')}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {growthPercentage > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  <span className="text-green-600">+{growthPercentage.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  <span className="text-red-600">{growthPercentage.toFixed(1)}%</span>
                </>
              )}
              <span className="ml-1">{t('fromLastMonth')}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('metrics.totalOrders')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {t('averageValue')}: {formatCurrency(stats.averageOrderValue, 'RING')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('metrics.satisfaction')}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerSatisfaction.toFixed(1)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.floor(stats.customerSatisfaction) 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="ml-1">({vendor.performanceMetrics.totalOrders} reviews)</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('metrics.pendingPayout')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts, 'RING')}</div>
            <p className="text-xs text-muted-foreground">
              {t('available')}: {formatCurrency(stats.availableBalance, 'RING')}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="products">{t('tabs.products')}</TabsTrigger>
          <TabsTrigger value="orders">{t('tabs.orders')}</TabsTrigger>
          <TabsTrigger value="payouts">{t('tabs.payouts')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('performance.title')}</CardTitle>
              <CardDescription>{t('performance.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">{t('performance.fulfillmentRate')}</span>
                  <span className="font-semibold">{stats.fulfillmentRate}%</span>
                </div>
                <Progress value={stats.fulfillmentRate} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">{t('performance.conversionRate')}</span>
                  <span className="font-semibold">{stats.conversionRate.toFixed(1)}%</span>
                </div>
                <Progress value={stats.conversionRate} />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">{t('performance.responseTime')}</span>
                  <span className="font-semibold">
                    {vendor.performanceMetrics.returnProcessingTime}h
                  </span>
                </div>
                <Progress 
                  value={Math.max(0, 100 - (vendor.performanceMetrics.returnProcessingTime * 2))} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('products.title')}</CardTitle>
              <CardDescription>
                {t('products.active', { count: stats.activeProducts })} / 
                {t('products.total', { count: stats.totalProducts })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>{t('products.outOfStock')}</span>
                  <Badge variant="destructive">{stats.outOfStockProducts}</Badge>
                </div>
                <Button className="w-full">{t('products.manage')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('orders.recent')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('orders.noRecent')}</p>
              <Button className="w-full mt-4">{t('orders.viewAll')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('payouts.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>{t('payouts.totalPaid')}</span>
                <span className="font-semibold">
                  {formatCurrency(stats.totalCommissionPaid, 'RING')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('payouts.pending')}</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(stats.pendingPayouts, 'RING')}
                </span>
              </div>
              <Button className="w-full">{t('payouts.history')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline">{t('quickActions.addProduct')}</Button>
            <Button variant="outline">{t('quickActions.updateInventory')}</Button>
            <Button variant="outline">{t('quickActions.viewAnalytics')}</Button>
            <Button variant="outline">{t('quickActions.settings')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
