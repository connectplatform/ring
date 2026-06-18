'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { restockVendorProduct } from '@/app/_actions/admin-store-erp'
import type { StoreProduct } from '@/features/store/types'
import { STOCK_THRESHOLDS } from '@/features/store/constants/stock'

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
  }
}

export default function VendorStockClient({ products, labels }: VendorStockClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{labels.title}</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
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
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <Badge variant={isLow ? 'destructive' : 'secondary'} className="mt-1">
                        {labels.stock}: {stock}
                      </Badge>
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
