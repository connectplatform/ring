'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface VendorOrderRow {
  id: string
  status?: string
  total?: number
  createdAt?: string
  vendorSettlement?: {
    subtotal: number
    commission: number
    netAmount: number
    status: string
  }
}

interface VendorOrdersClientProps {
  orders: VendorOrderRow[]
  labels: {
    title: string
    empty: string
    order: string
    status: string
    total: string
    net: string
    date: string
  }
}

export default function VendorOrdersClient({ orders, labels }: VendorOrdersClientProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{labels.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.order}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{labels.order}</th>
                  <th className="py-2 pr-4">{labels.status}</th>
                  <th className="py-2 pr-4">{labels.total}</th>
                  <th className="py-2 pr-4">{labels.net}</th>
                  <th className="py-2">{labels.date}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{order.id}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">{order.status ?? 'unknown'}</Badge>
                    </td>
                    <td className="py-2 pr-4">{order.total?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {order.vendorSettlement?.netAmount?.toFixed(2) ?? '—'}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
