'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { restockVendorProduct } from '@/app/_actions/admin-store-erp'
import type { StoreProduct } from '@/features/store/types'
import { STOCK_THRESHOLDS, ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'

interface VendorStockClientProps {
  products: StoreProduct[]
  labels: {
    title: string
    empty: string
    product: string
    stock: string
    restock: string
    restocking: string
    quantity: string
    bulkRestock?: string
    warehouse?: string
    lowStock?: string
  }
}

export default function VendorStockClient({ products, labels }: VendorStockClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [bulkQty, setBulkQty] = useState('10')
  const [error, setError] = useState<string | null>(null)

  const handleRestock = (productId: string) => {
    const qty = parseInt(quantities[productId] || '10', 10)
    if (!qty || qty < 1) return
    startTransition(async () => {
      setError(null)
      try {
        await restockVendorProduct(productId, qty)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Restock failed')
      }
    })
  }

  const handleBulkRestock = () => {
    const qty = parseInt(bulkQty || '10', 10)
    if (!qty || qty < 1) return
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id)
    if (ids.length === 0) return
    startTransition(async () => {
      setError(null)
      try {
        for (const id of ids) {
          await restockVendorProduct(id, qty)
        }
        setSelected({})
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bulk restock failed')
      }
    })
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        {labels.warehouse && (
          <p className="text-sm text-muted-foreground mt-1">
            {labels.warehouse}: {ZERO_WAREHOUSE_ID}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={bulkQty}
            onChange={(e) => setBulkQty(e.target.value)}
            aria-label={labels.quantity}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || selectedCount === 0}
            onClick={handleBulkRestock}
          >
            {labels.bulkRestock ?? 'Bulk restock'} ({selectedCount})
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.product}</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {products.map((p) => {
                const stock = p.stock ?? 0
                const isLow = stock <= STOCK_THRESHOLDS.LOW_STOCK
                return (
                  <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <Checkbox
                      checked={Boolean(selected[p.id])}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [p.id]: checked === true }))
                      }
                      aria-label={`Select ${p.name}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={isLow ? 'destructive' : 'secondary'}>
                          {labels.stock}: {stock}
                        </Badge>
                        {isLow && labels.lowStock && (
                          <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                            {labels.lowStock}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        placeholder="10"
                        value={quantities[p.id] ?? ''}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleRestock(p.id)}
                      >
                        {isPending ? labels.restocking : labels.restock}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
