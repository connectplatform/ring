'use client'

import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  adjustProductStockAction,
  initializeWarehouseStock,
} from '@/app/_actions/admin-store-erp'
import type { StockMovement } from '@/features/store/types/erp-stock'
import type { StoreProduct } from '@/features/store/types'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  STOCK_THRESHOLDS,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'

interface AdminStockClientProps {
  summary: {
    totalProducts: number
    inStockProducts: number
    lowStockProducts: number
    criticalStockProducts: number
    outOfStockProducts: number
    totalStockValue: number
  }
  lowStockProducts: StoreProduct[]
  movements: StockMovement[]
}

type StockFilter = 'all' | 'low' | 'critical' | 'out'

export default function AdminStockClient({
  summary,
  lowStockProducts,
  movements,
}: AdminStockClientProps) {
  const router = useRouter()
  const t = useTranslations('modules.admin.storeHub')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StockFilter>('all')
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({})
  const [adjustReason, setAdjustReason] = useState('Admin restock')

  const filteredLow = useMemo(() => {
    return lowStockProducts.filter((p) => {
      const stock = p.stock ?? 0
      if (filter === 'out') return stock <= 0
      if (filter === 'critical') return stock > 0 && stock <= STOCK_THRESHOLDS.CRITICAL_STOCK
      if (filter === 'low') return stock > STOCK_THRESHOLDS.CRITICAL_STOCK && stock <= STOCK_THRESHOLDS.LOW_STOCK
      return true
    })
  }, [lowStockProducts, filter])

  const handleInitialize = () => {
    startTransition(async () => {
      setError(null)
      try {
        await initializeWarehouseStock(100)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('initStockError'))
      }
    })
  }

  const handleAdjust = (productId: string) => {
    const qty = parseInt(adjustQty[productId] || '0', 10)
    if (!qty || qty < 1) return
    startTransition(async () => {
      setError(null)
      try {
        const result = await adjustProductStockAction({
          productId,
          quantity: qty,
          operation: 'add',
          reason: adjustReason || 'Admin restock',
        })
        if (!result.success) {
          setError(result.error || t('adjustStockError'))
          return
        }
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('adjustStockError'))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('stockTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('warehouseLabel', {
              name: DEFAULT_WAREHOUSE_NAME,
              id: ZERO_WAREHOUSE_ID,
              storeId: DEFAULT_INVENTORY_STORE_ID,
            })}
          </p>
        </div>
        <Button onClick={handleInitialize} disabled={isPending}>
          {isPending ? t('initializingStock') : t('initializeStock')}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stockSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{t('totalProductsLabel')}: <strong>{summary.totalProducts}</strong></p>
            <p>{t('inStockLabel')}: <strong>{summary.inStockProducts}</strong></p>
            <p>{t('lowStockCountLabel')}: <strong className="text-amber-600">{summary.lowStockProducts}</strong></p>
            <p>{t('criticalLabel')}: <strong className="text-orange-600">{summary.criticalStockProducts}</strong></p>
            <p>{t('outOfStockLabel')}: <strong className="text-destructive">{summary.outOfStockProducts}</strong></p>
            <p>{t('inventoryValueLabel')}: <strong>{summary.totalStockValue.toLocaleString()}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t('lowStock')}</CardTitle>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'low', 'critical', 'out'] as StockFilter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
              >
                {t(`filter.${f}`)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 max-w-md">
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={t('adjustReasonPlaceholder')}
            />
          </div>
          {filteredLow.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noLowStockAlerts')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredLow.map((p) => (
                <li key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <Badge
                      variant={(p.stock ?? 0) === 0 ? 'destructive' : 'secondary'}
                      className="ml-2"
                    >
                      {t('stockUnits', { count: p.stock ?? 0 })}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      placeholder="10"
                      value={adjustQty[p.id] ?? ''}
                      onChange={(e) =>
                        setAdjustQty((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                    />
                    <Button size="sm" disabled={isPending} onClick={() => handleAdjust(p.id)}>
                      {t('restock')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('movements')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMovementsYet')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">{t('product')}</th>
                  <th className="py-2 pr-4">{t('movementType')}</th>
                  <th className="py-2 pr-4">{t('quantityChange')}</th>
                  <th className="py-2 pr-4">{t('warehouse')}</th>
                  <th className="py-2 pr-4">{t('reason')}</th>
                  <th className="py-2">{t('timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{m.productId}</td>
                    <td className="py-2 pr-4">{m.movementType}</td>
                    <td className="py-2 pr-4">
                      {m.quantityChange > 0 ? '+' : ''}
                      {m.quantityChange}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {m.warehouseId || ZERO_WAREHOUSE_ID}
                    </td>
                    <td className="py-2 pr-4 text-xs max-w-[12rem] truncate">{m.reason}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(m.timestamp).toLocaleString()}
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
