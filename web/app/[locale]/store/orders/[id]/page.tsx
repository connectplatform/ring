import type { Metadata } from 'next'
import React from 'react'

import { Order } from '@/features/store/types'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// Generate the page's metadata (title, robots, i18n, etc) based on params.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  // Next.js passes params as a promise, so we await
  const { locale: localeParam, id } = await params
  // Ensure locale is valid or fallback to default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale) // Set the locale for server requests
  return buildLocalizedMetadata({
    locale,
    path: 'store.orders.detail',
    pathname: `/store/orders/${id}`,
    variables: { orderId: id }, // Used for i18n placeholders
    robots: { index: false, follow: false }, // Don't index/follow order pages
  })
}

async function getOrder(id: string): Promise<Order | null> {
  try {
    const { StoreOrdersService } = await import('@/features/store/services/orders-service')
    return await StoreOrdersService.getOrderById(id)
  } catch (error) {
    console.error('getOrder: Error during service call:', error)
    return null
  }
}

// Page component for individual order details
export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const { auth } = await import('@/auth')
  const { isPlatformAdmin } = await import('@/features/auth/user-role')
  const session = await auth()
  const order = await getOrder(id)

  if (!order) {
    return <div>Order not found</div>
  }
  if (
    order.userId &&
    (!session?.user?.id || (session.user.id !== order.userId && !isPlatformAdmin(session.user.role)))
  ) {
    return <div>Order not found</div>
  }

  const orderCurrency = order.items?.[0]?.currency || 'UAH'
  const fmt = (value?: number) => (typeof value === 'number' ? `${value.toFixed(2)} ${orderCurrency}` : '—')

  // Order exists: display order details inside store context wrapper
  return (
    <StoreWrapper locale={validLocale}>
      <div>
        <h1 className="text-2xl font-semibold mb-4">Order #{order.id}</h1>
        <div className="space-y-2">
          <div className="text-sm">Status: {order.status}</div>
          <div className="text-sm">Created: {order.createdAt}</div>
          <div className="text-sm font-medium mt-4">Summary</div>
          <div className="text-sm">Subtotal: {fmt(order.subtotal)}</div>
          {order.discountAmount ? (
            <div className="text-sm">
              Discount{order.promoCode ? ` (${order.promoCode})` : ''}: -{fmt(order.discountAmount)}
            </div>
          ) : null}
          <div className="text-sm">
            Shipping:{' '}
            {typeof order.shippingCost === 'number'
              ? order.shippingCost <= 0
                ? 'Free'
                : fmt(order.shippingCost)
              : order.shipping?.provider ?? '—'}
          </div>
          <div className="text-sm font-medium">Total: {fmt(order.total)}</div>
          <div className="text-sm font-medium mt-4">Items</div>
          <div className="space-y-1">
            {/* Map through order items and render them */}
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div>{item.name} × {item.quantity}</div>
                <div>{item.price} {item.currency}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StoreWrapper>
  )
}
