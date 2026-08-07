'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Settlement } from '@/features/store/services/settlement'

interface VendorEarningsClientProps {
  pendingTotal: number
  pendingSettlements: Settlement[]
  history: Settlement[]
  labels: {
    title: string
    pending: string
    history: string
    amount: string
    commission: string
    status: string
    scheduled: string
    empty: string
    simulatedBadge: string
  }
}

function isSimulated(s: Settlement): boolean {
  return (
    (s.metadata as { simulated?: boolean } | undefined)?.simulated === true ||
    (typeof s.transactionId === 'string' &&
      (s.transactionId.startsWith('sim_') || s.transactionId.startsWith('ring_tx_')))
  )
}

export default function VendorEarningsClient({
  pendingTotal,
  pendingSettlements,
  history,
  labels,
}: VendorEarningsClientProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{labels.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.pending}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold mb-4">{pendingTotal.toFixed(2)}</p>
          {pendingSettlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {pendingSettlements.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span className="font-mono text-xs">{s.orderId}</span>
                  <span>{s.netPayout.toFixed(2)} {s.currency}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.history}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{labels.amount}</th>
                  <th className="py-2 pr-4">{labels.commission}</th>
                  <th className="py-2 pr-4">{labels.status}</th>
                  <th className="py-2">{labels.scheduled}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{s.netPayout.toFixed(2)} {s.currency}</td>
                    <td className="py-2 pr-4">{s.commission.toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">{s.status}</Badge>
                      {isSimulated(s) && (
                        <Badge variant="outline" className="ml-1 text-amber-600 border-amber-500/40">
                          {labels.simulatedBadge}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {s.processedAt
                        ? new Date(s.processedAt).toLocaleString()
                        : new Date(s.scheduledFor).toLocaleString()}
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
