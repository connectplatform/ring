import type { Metadata } from 'next'
import React from 'react'
import { Order } from '@/features/store/types'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'store.orders.detail',
    pathname: `/store/orders/${id}`,
    variables: { orderId: id },
    robots: { index: false, follow: false },
  })
}

async function getOrder(id: string): Promise<Order | null> {
  try {
    console.log('getOrder: Starting direct service call', { orderId: id });
    
    // Import and call the service function directly
    const { StoreOrdersService } = await import('@/features/store/services/orders-service');
    
    console.log('getOrder: Calling StoreOrdersService.getOrderById');
    const order = await StoreOrdersService.getOrderById(id);
    
    console.log('getOrder: Order fetched successfully', { orderExists: !!order });
    return order as Order | null;
  } catch (error) {
    console.error('getOrder: Error during service call:', error);
    return null;
  }
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const order = await getOrder(id)
  if (!order) return <div>Order not found</div>
  return (
    <StoreWrapper locale={validLocale}>
      <div>
        <h1 className="text-2xl font-semibold mb-4">Order #{order.id}</h1>
        <div className="space-y-2">
          <div className="text-sm">Status: {order.status}</div>
          <div className="text-sm">Created: {order.createdAt}</div>
          <div className="text-sm font-medium">Items</div>
          <div className="space-y-1">
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


