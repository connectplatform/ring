'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Star,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { VendorProfile, VendorDashboardStats } from '@/features/store/types/vendor'
import { SerializedEntity } from '@/features/entities/types'
import { formatCurrency } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { RecentOrders, type VendorRecentOrderRow } from '@/components/vendor/recent-orders'

interface VendorDashboardProps {
  vendor: VendorProfile
  entity: SerializedEntity
  stats: VendorDashboardStats
  locale: string
  recentOrders?: VendorRecentOrderRow[]
}

export function VendorDashboard({ vendor, entity, stats, locale, recentOrders = [] }: VendorDashboardProps) {
  const t = useTranslations('vendor.dashboard')
  const [activeTab, setActiveTab] = useState('overview')
  const loc = locale as Locale
  
  // Calculate growth percentage
  const growthPercentage = stats.salesLastMonth > 0 
    ? ((stats.salesThisMonth - stats.salesLastMonth) / stats.salesLastMonth) * 100
    : stats.growthRate || 0
  
  // Trust level badge color
  const trustLevelColor = {
    new: 'bg-gray-500',
    basic: 'bg-blue-500',
    verified: 'bg-green-500',
    trusted: 'bg-purple-500',
    premium: 'bg-amber-500'
  }[vendor.trustLevel] || 'bg-gray-500'

  const storeStatus = entity.storeStatus || 'open'
  const reviewsCount = vendor.performanceMetrics?.totalOrders ?? stats.totalOrders
  
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
              <Badge variant={storeStatus === 'open' ? 'default' : 'secondary'}>
                {t(`status.${storeStatus}`)}
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
              {vendor.complianceStatus?.taxDocumentsSubmitted ? (
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
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales, 'UAH')}</div>
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
              {t('averageValue')}: {formatCurrency(stats.averageOrderValue, 'UAH')}
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
              <span className="ml-1">({reviewsCount})</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('metrics.pendingPayout')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingPayouts, 'UAH')}</div>
            <p className="text-xs text-muted-foreground">
              {t('available')}: {formatCurrency(stats.availableBalance, 'UAH')}
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
                    {vendor.performanceMetrics?.returnProcessingTime ?? 24}h
                  </span>
                </div>
                <Progress 
                  value={Math.max(0, 100 - ((vendor.performanceMetrics?.returnProcessingTime ?? 24) * 2))} 
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
                {t('products.active', { count: stats.activeProducts })} /{' '}
                {t('products.total', { count: stats.totalProducts })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>{t('products.outOfStock')}</span>
                  <Badge variant="destructive">{stats.outOfStockProducts}</Badge>
                </div>
                <Button className="w-full" asChild>
                  <Link href={ROUTES.VENDOR_PRODUCTS(loc)}>{t('products.manage')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orders" className="space-y-4">
          <RecentOrders orders={recentOrders} locale={locale} />
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
                  {formatCurrency(stats.totalCommissionPaid, 'UAH')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('payouts.pending')}</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(stats.pendingPayouts, 'UAH')}
                </span>
              </div>
              <Button className="w-full" asChild>
                <Link href={ROUTES.VENDOR_EARNINGS(loc)}>{t('payouts.history')}</Link>
              </Button>
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
            <Button variant="outline" asChild>
              <Link href={ROUTES.VENDOR_PRODUCTS_ADD(loc)}>{t('quickActions.addProduct')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={ROUTES.VENDOR_STOCK(loc)}>{t('quickActions.updateInventory')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={ROUTES.VENDOR_ORDERS(loc)}>{t('quickActions.viewOrders')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={ROUTES.VENDOR_SETTINGS(loc)}>{t('quickActions.settings')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
