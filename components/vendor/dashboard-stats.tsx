/**
 * Dashboard Stats Component
 * 
 * Displays key vendor metrics: orders, revenue, products
 */

import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, TrendingUp, Package } from 'lucide-react'

export async function DashboardStats() {
  // TODO: Fetch real stats from database
  const stats = {
    totalOrders: 127,
    totalRevenue: 4563.50,
    activeProducts: 23,
    ordersTrend: '+12%',
    revenueTrend: '+18%',
    productsTrend: '+3'
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
              <p className="text-xs text-green-600">{stats.ordersTrend} from last month</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">₴{stats.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-green-600">{stats.revenueTrend} from last month</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Products</p>
              <p className="text-2xl font-bold">{stats.activeProducts}</p>
              <p className="text-xs text-green-600">{stats.productsTrend} new this month</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

