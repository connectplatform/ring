/**
 * Dashboard Stats Component
 *
 * @deprecated Prefer VendorDashboard metrics fed by getVendorDashboardStats.
 * Kept as a presentational strip if a page needs compact KPI cards.
 */

import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, TrendingUp, Package } from 'lucide-react'
import type { VendorDashboardStats } from '@/features/store/types/vendor'

export function DashboardStats({ stats }: { stats: VendorDashboardStats }) {
  const growthLabel =
    stats.growthRate > 0
      ? `+${stats.growthRate.toFixed(1)}%`
      : `${stats.growthRate.toFixed(1)}%`

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
              <p className="text-xs text-muted-foreground">{growthLabel} from last month</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">₴{stats.totalSales.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{growthLabel} from last month</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
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
              <p className="text-xs text-muted-foreground">
                {stats.totalProducts} total · {stats.outOfStockProducts} out of stock
              </p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
