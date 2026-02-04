/**
 * Recent Orders Component
 * 
 * Displays recent vendor orders with status
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

export async function RecentOrders() {
  // TODO: Fetch real orders from database
  const orders = [
    {
      id: 'ORD-001',
      customer: 'John Doe',
      total: 125.50,
      status: 'completed',
      date: '2025-11-04'
    },
    {
      id: 'ORD-002',
      customer: 'Jane Smith',
      total: 89.00,
      status: 'processing',
      date: '2025-11-04'
    },
    {
      id: 'ORD-003',
      customer: 'Bob Johnson',
      total: 234.75,
      status: 'pending',
      date: '2025-11-03'
    }
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest customer orders from your store</CardDescription>
        </div>
        <Link href="/vendor/orders">
          <Button variant="ghost" size="sm">
            View All
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orders yet. Start promoting your products!
            </p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{order.id}</p>
                  <p className="text-sm text-muted-foreground">{order.customer}</p>
                  <p className="text-xs text-muted-foreground">{order.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₴{order.total.toFixed(2)}</p>
                  <Badge variant={
                    order.status === 'completed' ? 'default' :
                    order.status === 'processing' ? 'secondary' : 'outline'
                  }>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

