'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  receiveWarehouseStockAction,
  recordSupplierPaymentAction,
  transferWarehouseStockAction,
} from '@/app/_actions/admin-store-erp'
import type { WarehouseStockReport } from '@/features/store/services/warehouse-fulfillment'

export function WarehouseStockPanel({
  report,
  locale,
  allowSwitcher = false,
}: {
  report: WarehouseStockReport
  locale: Locale
  allowSwitcher?: boolean
}) {
  const t = useTranslations('modules.admin.storeHub')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [productId, setProductId] = useState(report.catalog[0]?.productId || report.products[0]?.productId || '')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('0')
  const [amountPaid, setAmountPaid] = useState('0')
  const [amountOwed, setAmountOwed] = useState('0')
  const [supplierName, setSupplierName] = useState('')
  const [targetId, setTargetId] = useState(
    report.warehouses.find((row) => row.id !== report.warehouse.id)?.id || '',
  )

  const run = (work: () => Promise<void>) => {
    setMessage(null)
    startTransition(async () => {
      try {
        await work()
        setMessage(t('saved'))
        router.refresh()
      } catch {
        setMessage(t('saveFailed'))
      }
    })
  }

  const figures: Array<[string, string]> = [
    [t('remaining'), String(report.remaining)],
    [t('reserved'), String(report.reserved)],
    [t('received'), String(report.receivedQty)],
    [t('supplierPaid'), report.supplierPaid.toFixed(2)],
    [t('supplierOwed'), report.supplierOwed.toFixed(2)],
    [t('referralOwed'), report.referralOwed.toFixed(2)],
    [t('vendorNetOwed'), report.vendorNetOwed.toFixed(2)],
    [t('vendorNetPaid'), report.vendorNetPaid.toFixed(2)],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{report.warehouse.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('stockPageHint')}</p>
        </div>
        {allowSwitcher ? (
          <label className="text-sm space-y-1">
            <span className="block">{t('warehouse')}</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3"
              value={report.warehouse.id}
              onChange={(event) => {
                router.push(`${ROUTES.ADMIN_STORE_STOCK(locale)}?warehouse=${encodeURIComponent(event.target.value)}`)
              }}
            >
              {report.warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('products')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">{t('product')}</th>
                <th className="py-2 pr-3">{t('remaining')}</th>
                <th className="py-2 pr-3">{t('reserved')}</th>
                <th className="py-2 pr-3">{t('unitCost')}</th>
                <th className="py-2">{t('stockValue')}</th>
              </tr>
            </thead>
            <tbody>
              {report.products.map((row) => (
                <tr key={row.productId} className="border-b">
                  <td className="py-2 pr-3">{row.name}</td>
                  <td className="py-2 pr-3">{row.available}</td>
                  <td className="py-2 pr-3">{row.reserved}</td>
                  <td className="py-2 pr-3">{row.unitCost.toFixed(2)}</td>
                  <td className="py-2">{row.stockValue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('receiveStock')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="receive-product">{t('product')}</Label>
              <select
                id="receive-product"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                {(report.catalog.length ? report.catalog : report.products).map((row) => (
                  <option key={row.productId} value={row.productId}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="receive-qty">{t('quantity')}</Label>
                <Input id="receive-qty" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receive-cost">{t('unitCost')}</Label>
                <Input id="receive-cost" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receive-paid">{t('supplierPaid')}</Label>
                <Input id="receive-paid" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receive-owed">{t('supplierOwed')}</Label>
                <Input id="receive-owed" value={amountOwed} onChange={(event) => setAmountOwed(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="receive-supplier">{t('supplier')}</Label>
              <Input id="receive-supplier" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
            </div>
            <Button
              type="button"
              disabled={pending || !productId}
              onClick={() =>
                run(() =>
                  receiveWarehouseStockAction({
                    warehouseId: report.warehouse.id,
                    productId,
                    quantity: Number(quantity),
                    unitCost: Number(unitCost) || 0,
                    amountPaid: Number(amountPaid) || 0,
                    amountOwed: Number(amountOwed) || 0,
                    supplierName,
                  }),
                )
              }
            >
              {pending ? t('saving') : t('receiveStock')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('transferStock')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="transfer-target">{t('warehouse')}</Label>
              <select
                id="transfer-target"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                {report.warehouses
                  .filter((row) => row.id !== report.warehouse.id)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !productId || !targetId}
              onClick={() =>
                run(() =>
                  transferWarehouseStockAction({
                    fromWarehouseId: report.warehouse.id,
                    toWarehouseId: targetId,
                    productId,
                    quantity: Number(quantity),
                  }),
                )
              }
            >
              {t('transferStock')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('movements')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {report.movements.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>
                {row.productName} · {row.movementType} · {row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange}
                {row.counterWarehouseId ? ` → ${row.counterWarehouseId}` : ''}
              </span>
              <span className="text-muted-foreground">{row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}</span>
              {row.movementType === 'receipt' && Number(row.amountOwed || 0) > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      recordSupplierPaymentAction({
                        movementId: row.id,
                        warehouseId: report.warehouse.id,
                        amount: Number(row.amountOwed),
                      }),
                    )
                  }
                >
                  {t('recordPayment')}
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {allowSwitcher ? null : (
        <p className="text-sm">
          <Link className="underline" href={ROUTES.WAREHOUSES(locale)}>
            {t('warehouses')}
          </Link>
        </p>
      )}
    </div>
  )
}
