'use client'

import React, { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { updateOrderStatus, refreshOrders } from '@/app/_actions/admin-orders'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

const ORDER_STATUSES = ['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'] as const
type OrderStatus = (typeof ORDER_STATUSES)[number]

interface Order {
  id: string
  status?: string
  userId?: string
  createdAt?: string
  items?: Array<{ name?: string; quantity?: number; price?: string; currency?: string }>
  [key: string]: unknown
}

interface AdminOrdersClientProps {
  initialOrders: Order[]
  currentStatusFilter?: string
  locale: Locale
}

export default function AdminOrdersClient({
  initialOrders,
  currentStatusFilter = '',
  locale,
}: AdminOrdersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('modules.admin.storeHub.ordersPage')
  const [isPending, startTransition] = useTransition()
  const [updateError, setUpdateError] = useState<string | null>(null)

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

      {initialOrders.length === 0 ? (
        <div className="text-muted-foreground">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {initialOrders.map((order) => (
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
    </div>
  )
}

interface OrderCardProps {
  order: Order
  statusLabel: (status: string) => string
  onUpdateStatus: (orderId: string, status: string) => void
  isUpdating: boolean
}

function OrderCard({ order, statusLabel, onUpdateStatus, isUpdating }: OrderCardProps) {
  const t = useTranslations('modules.admin.storeHub.ordersPage')
  const [selectedStatus, setSelectedStatus] = useState(order.status || 'new')
  const currentStatus = order.status || 'new'

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

      {order.items && order.items.length > 0 && (
        <div className="text-sm mt-2">
          <div className="font-medium">{t('itemsLabel')}:</div>
          <div className="ml-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>
                  {item.price} {item.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
      return 'text-muted-foreground'
  }
}
