'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  confirmOrderParcelAction,
  loadMoreAdminOrders,
  clearShipmentIntentAction,
  refreshOrderTracking,
  refreshOrders,
  resolveOrderSettlementAction,
  restockReturnedLineAction,
  saveOrderNovaPostLocationAction,
  updateOrderStatus,
} from '@/app/_actions/admin-orders'
import { NovaPostSelector, type NovaPostLocation } from '@/features/store/components/shipping/nova-post-selector'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { AdminOrderDto } from '@/lib/admin/admin-list-dto'
import { Button } from '@/components/ui/button'

const ORDER_STATUSES = ['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]

interface AdminOrdersClientProps {
  initialOrders: AdminOrderDto[]
  initialHasMore: boolean
  initialNextOffset: number
  currentStatusFilter?: string
  locale: Locale
  shipmentWatch?: { stalePending: number; refused: number; truncated: boolean } | null
}

export default function AdminOrdersClient({
  initialOrders,
  initialHasMore,
  initialNextOffset,
  currentStatusFilter = '',
  locale,
  shipmentWatch = null,
}: AdminOrdersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('modules.admin.storeHub.ordersPage')
  const [isPending, startTransition] = useTransition()
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [orders, setOrders] = useState(initialOrders)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)

  useEffect(() => {
    setOrders(initialOrders)
    setHasMore(initialHasMore)
    setNextOffset(initialNextOffset)
  }, [initialOrders, initialHasMore, initialNextOffset])

  const statusLabel = (status: string) => {
    if (ORDER_STATUSES.includes(status as OrderStatus)) {
      return t(`statuses.${status as OrderStatus}`)
    }
    return status
  }

  const handleStatusFilterChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    if (newStatus) {
      params.set('status', newStatus)
    } else {
      params.delete('status')
    }

    startTransition(() => {
      router.push(`${ROUTES.ADMIN_STORE_ORDERS(locale)}?${params.toString()}`)
    })
  }

  const handleRefresh = () => {
    startTransition(async () => {
      await refreshOrders()
      router.refresh()
    })
  }

  const handleLoadMore = () => {
    startTransition(async () => {
      setUpdateError(null)
      const result = await loadMoreAdminOrders({
        offset: nextOffset,
        statusFilter: currentStatusFilter || undefined,
      })
      if (!result.success) {
        setUpdateError(result.error || t('updateStatusError'))
        return
      }
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.id))
        return [...prev, ...result.items.filter((o) => !seen.has(o.id))]
      })
      setHasMore(result.hasMore)
      setNextOffset(result.nextOffset)
    })
  }

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const formData = new FormData()
    formData.append('orderId', orderId)
    formData.append('status', newStatus)

    startTransition(async () => {
      setUpdateError(null)
      const result = await updateOrderStatus(formData)
      if (!result.success) {
        setUpdateError(result.error || t('updateStatusError'))
      } else {
        router.refresh()
      }
    })
  }

  const emptyMessage = currentStatusFilter
    ? t('noOrdersWithStatus', { status: statusLabel(currentStatusFilter) })
    : t('noOrders')

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>
      {shipmentWatch && (shipmentWatch.stalePending > 0 || shipmentWatch.refused > 0) ? (
        <div className="mb-4 space-y-1 text-sm">
          {shipmentWatch.stalePending > 0 ? (
            <p>{t('stalePending', { count: shipmentWatch.stalePending })}</p>
          ) : null}
          {shipmentWatch.refused > 0 ? (
            <p>{t('refusedShipments', { count: shipmentWatch.refused })}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 mb-4">
        <select
          className="border rounded px-2 py-1"
          value={currentStatusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          disabled={isPending}
        >
          <option value="">{t('allStatuses')}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>

        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? t('refreshing') : t('refresh')}
        </button>
      </div>

      {updateError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {t('errorPrefix')}: {updateError}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-muted-foreground">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              statusLabel={statusLabel}
              onUpdateStatus={handleUpdateOrderStatus}
              isUpdating={isPending}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? t('refreshing') : t('showMore')}
          </Button>
        </div>
      )}
    </div>
  )
}

interface OrderCardProps {
  order: AdminOrderDto
  statusLabel: (status: string) => string
  onUpdateStatus: (orderId: string, status: string) => void
  isUpdating: boolean
}

function OrderCard({ order, statusLabel, onUpdateStatus, isUpdating }: OrderCardProps) {
  const t = useTranslations('modules.admin.storeHub.ordersPage')
  const router = useRouter()
  const [, startTrack] = useTransition()
  const [selectedStatus, setSelectedStatus] = useState(order.status || 'new')
  const [location, setLocation] = useState<NovaPostLocation | null>(null)
  const [parcels, setParcels] = useState<Record<string, { weight: string; length: string; width: string; height: string }>>({})
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [note, setNote] = useState<string | null>(null)
  const keys = useRef<Record<string, string>>({})
  const currentStatus = order.status || 'new'
  const shipments = order.shipments || []
  const needsSettlement = order.shippingMethod === 'nova-post' && !order.shippingSettlementId && !shipments.some((row) => row.number)
  const parcelDraft = (warehouseId: string) => parcels[warehouseId] || { weight: '', length: '', width: '', height: '' }

  const handleUpdateClick = () => {
    if (selectedStatus !== order.status) {
      onUpdateStatus(order.id, selectedStatus)
    }
  }

  const statusChanged = selectedStatus !== currentStatus

  return (
    <div className="border rounded p-3">
      <div className="font-medium">{t('orderNumber', { id: order.id })}</div>
      <div className="text-sm text-muted-foreground">
        {t('statusLabel')}:{' '}
        <span className={`font-medium ${getStatusColor(currentStatus)}`}>
          {statusLabel(currentStatus)}
        </span>
      </div>
      <div className="text-sm">
        {t('userLabel')}: {order.userId || '-'}
      </div>
      <div className="text-sm">
        {t('createdLabel')}: {order.createdAt || '-'}
      </div>
      {(order.subtotal != null || order.total != null) && (
        <div className="text-sm mt-2 space-y-1">
          {order.subtotal != null ? <div>Subtotal: {order.subtotal.toFixed(2)} {order.currency || ''}</div> : null}
          {order.discountAmount ? (
            <div>Discount{order.promoCode ? ` (${order.promoCode})` : ''}: -{order.discountAmount.toFixed(2)}</div>
          ) : null}
          {order.shippingCost != null ? <div>Shipping: {order.shippingCost.toFixed(2)}</div> : null}
          {order.total != null ? <div className="font-medium">Total: {order.total.toFixed(2)} {order.currency || ''}</div> : null}
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <div className="text-sm mt-2">
          <div className="font-medium">{t('itemsLabel')}:</div>
          <div className="ml-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                  {item.fulfillmentWarehouseId ? ` · ${item.fulfillmentWarehouseId}` : ''}
                </span>
                <span>
                  {item.price} {item.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm mt-2 space-y-1">
        {order.shippingMethod ? <div>{t('shippingMethod')}: {order.shippingMethod}</div> : null}
        {order.shippingBranch ? <div>{t('branch')}: {order.shippingBranch}</div> : null}
        {order.paymentStatus ? <div>{t('payment')}: {order.paymentStatus}</div> : null}
        {shipments.map((shipment) => (
          <div key={shipment.warehouseId}>
            <div>
              {t('shipment')} · {shipment.warehouseId}
              {shipment.number ? `: ${shipment.number}` : ''}
              {shipment.status ? ` · ${shipment.status}` : ''}
            </div>
            {shipment.intentStatus === 'pending' && shipment.intentAt ? (
              <div className="text-xs text-muted-foreground">{t('shipmentPendingSince', { at: shipment.intentAt })}</div>
            ) : null}
            {shipment.intentStatus === 'failed' && shipment.intentDetail ? (
              <div className="text-xs">{t('shipmentRefused', { detail: shipment.intentDetail })}</div>
            ) : null}
            {shipment.number ? (
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    startTrack(async () => {
                      await refreshOrderTracking(order.id)
                      router.refresh()
                    })
                  }}
                >
                  {t('track')}
                </button>
                <a className="text-primary underline" href={`/api/shipping/novapost/shipments/${encodeURIComponent(shipment.number)}/print`}>
                  {t('printSlip')}
                </a>
              </div>
            ) : shipment.intentStatus === 'pending' ? (
              <button
                type="button"
                className="text-primary underline"
                onClick={() => {
                  startTrack(async () => {
                    try {
                      await clearShipmentIntentAction(order.id, shipment.warehouseId)
                      setNote(t('intentCleared'))
                      router.refresh()
                    } catch (error) {
                      setNote(error instanceof Error ? error.message : t('updateStatusError'))
                    }
                  })
                }}
              >
                {t('clearShipmentIntent')}
              </button>
            ) : null}
            {shipment.history?.length ? (
              <ul className="mt-1 text-xs text-muted-foreground">
                {shipment.history.map((entry, index) => (
                  <li key={`${entry.date}-${index}`}>{entry.date} {entry.status}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {needsSettlement ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">{t('settlementMissing')}</p>
          {order.shippingDivisionId ? (
            <button
              type="button"
              className="text-primary underline text-sm"
              onClick={() =>
                startTrack(async () => {
                  setNote(null)
                  const result = await resolveOrderSettlementAction(order.id)
                  setNote(result.resolved ? t('resolveSaved') : t('settlementMissing'))
                  if (result.resolved) router.refresh()
                })
              }
            >
              {t('resolveSettlement')}
            </button>
          ) : null}
          <NovaPostSelector selected={location} onSelect={setLocation} />
          <button
            type="button"
            className="text-sm underline"
            disabled={!location?.id || !location.settlementId}
            onClick={() =>
              startTrack(async () => {
                if (!location?.id || !location.settlementId) return
                await saveOrderNovaPostLocationAction({
                  orderId: order.id,
                  id: location.id,
                  name: location.name,
                  address: location.address,
                  settlementId: location.settlementId,
                  settlementName: location.settlementName,
                })
                router.refresh()
              })
            }
          >
            {t('saveBranch')}
          </button>
        </div>
      ) : null}
      {shipments.filter((row) => row.needsParcel).map((shipment) => {
        const draft = parcelDraft(shipment.warehouseId)
        return (
          <div key={`parcel-${shipment.warehouseId}`} className="mt-3 grid grid-cols-2 gap-2 max-w-sm">
            <p className="col-span-2 text-sm">{t('confirmParcelFor', { warehouse: shipment.warehouseId })}</p>
            {(['weight', 'length', 'width', 'height'] as const).map((field) => (
              <input
                key={field}
                className="border rounded px-2 py-1 text-sm"
                placeholder={t(field === 'weight' ? 'parcelWeight' : field === 'length' ? 'parcelLength' : field === 'width' ? 'parcelWidth' : 'parcelHeight')}
                value={draft[field]}
                onChange={(event) => setParcels((current) => ({
                  ...current,
                  [shipment.warehouseId]: { ...draft, [field]: event.target.value },
                }))}
              />
            ))}
            <button
              type="button"
              className="text-sm underline col-span-2 text-left"
              onClick={() =>
                startTrack(async () => {
                  await confirmOrderParcelAction({
                    orderId: order.id,
                    warehouseId: shipment.warehouseId,
                    weight: Number(draft.weight),
                    length: Number(draft.length),
                    width: Number(draft.width),
                    height: Number(draft.height),
                  })
                  router.refresh()
                })
              }
            >
              {t('confirmParcel')}
            </button>
          </div>
        )
      })}
      {order.items?.some((item) => item.productId && shipments.some((row) => row.number && (!item.fulfillmentWarehouseId || row.warehouseId === item.fulfillmentWarehouseId))) ? (
        <div className="mt-2 space-y-1">
          {order.items.map((item, index) => {
            const shipment = shipments.find((row) => row.number && (!item.fulfillmentWarehouseId || row.warehouseId === item.fulfillmentWarehouseId))
            if (!item.productId || !shipment?.number) return null
            const slot = `${item.productId}:${item.fulfillmentWarehouseId || shipment.warehouseId}`
            const remaining = item.returnable ?? item.quantity ?? 1
            const quantity = Number(returnQty[slot] ?? remaining)
            return (
              <div key={`${item.productId}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
                <span>{item.name}</span>
                <span>{t('returnableLeft', { count: remaining })}</span>
                <input
                  className="w-16 border rounded px-1 py-0.5"
                  aria-label={t('returnQuantity')}
                  value={returnQty[slot] ?? String(remaining)}
                  onChange={(event) => setReturnQty((current) => ({ ...current, [slot]: event.target.value }))}
                />
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    startTrack(async () => {
                      const key = `return-${slot}`
                      if (!keys.current[key]) keys.current[key] = crypto.randomUUID()
                      try {
                        const result = await restockReturnedLineAction({
                          orderId: order.id,
                          productId: item.productId || '',
                          warehouseId: item.fulfillmentWarehouseId || shipment.warehouseId,
                          quantity,
                          mode: 'resellable',
                          idempotencyKey: keys.current[key],
                        })
                        if (result.success === false) {
                          setNote(result.error)
                          return
                        }
                        delete keys.current[key]
                        router.refresh()
                      } catch (error) {
                        setNote(error instanceof Error ? error.message : t('updateStatusError'))
                      }
                    })
                  }
                >
                  {t('restockReturn')}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    startTrack(async () => {
                      const key = `damage-${slot}`
                      if (!keys.current[key]) keys.current[key] = crypto.randomUUID()
                      try {
                        const result = await restockReturnedLineAction({
                          orderId: order.id,
                          productId: item.productId || '',
                          warehouseId: item.fulfillmentWarehouseId || shipment.warehouseId,
                          quantity,
                          mode: 'damaged',
                          idempotencyKey: keys.current[key],
                        })
                        if (result.success === false) {
                          setNote(result.error)
                          return
                        }
                        delete keys.current[key]
                        router.refresh()
                      } catch (error) {
                        setNote(error instanceof Error ? error.message : t('updateStatusError'))
                      }
                    })
                  }
                >
                  {t('markDamaged')}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

      <div className="mt-2 flex items-center gap-2">
        <select
          className="border rounded px-2 py-1"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isUpdating}
        >
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>

        <button
          className={`px-3 py-1 rounded text-white disabled:opacity-50 ${
            statusChanged
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          onClick={handleUpdateClick}
          disabled={isUpdating || !statusChanged}
        >
          {isUpdating ? t('updating') : t('update')}
        </button>
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'new':
      return 'text-blue-600'
    case 'paid':
      return 'text-green-600'
    case 'processing':
      return 'text-yellow-600'
    case 'shipped':
      return 'text-purple-600'
    case 'completed':
      return 'text-green-800'
    case 'canceled':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}
