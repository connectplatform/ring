'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { initializeWarehouseStock } from '@/app/_actions/admin-store-erp'
import type { StockMovement } from '@/features/store/types/erp-stock'
import type { StoreProduct } from '@/features/store/types'

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

export default function AdminStockClient({
  summary,
  lowStockProducts,
  movements,
}: AdminStockClientProps) {
  const router = useRouter()
  const t = useTranslations('modules.admin.storeHub')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('stockTitle')}</h1>
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
        <CardHeader>
          <CardTitle className="text-base">{t('lowStock')}</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noLowStockAlerts')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <Badge variant={p.stock === 0 ? 'destructive' : 'secondary'}>
                    {t('stockUnits', { count: p.stock ?? 0 })}
                  </Badge>
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
                  <th className="py-2">{t('timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{m.productId}</td>
                    <td className="py-2 pr-4">{m.movementType}</td>
                    <td className="py-2 pr-4">{m.quantityChange > 0 ? '+' : ''}{m.quantityChange}</td>
                    <td className="py-2 text-muted-foreground">{new Date(m.timestamp).toLocaleString()}</td>
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
