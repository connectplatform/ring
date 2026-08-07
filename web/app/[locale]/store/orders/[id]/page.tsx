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

// Calls order service to fetch order by ID. Returns null if error.
async function getOrder(id: string): Promise<Order | null> {
  try {
    // For debugging: log start of service call
    console.log('getOrder: Starting direct service call', { orderId: id });
    
    // Dynamically import the service method (on server)
    const { StoreOrdersService } = await import('@/features/store/services/orders-service');
    
    // For debugging: log about to call service
    console.log('getOrder: Calling StoreOrdersService.getOrderById');
    const order = await StoreOrdersService.getOrderById(id);
    
    // For debugging: log success/failure
    console.log('getOrder: Order fetched successfully', { orderExists: !!order });
    return order;
  } catch (error) {
    // Log and swallow errors (return null if fetch fails)
    console.error('getOrder: Error during service call:', error);
    return null;
  }
}

// Page component for individual order details
export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  // Params is a promise due to Next.js dynamic route handling
  const { id, locale } = await params;
  // Validate/normalize locale value
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  // Attempt to fetch order
  const order = await getOrder(id)

  if (!order) {
    // If not found, show message
    return <div>Order not found</div>
  }

  // TODO: If real-time order status or items are needed, consider using React 19 use() hook or partial rendering.

  // Order exists: display order details inside store context wrapper
  return (
    <StoreWrapper locale={validLocale}>
      <div>
        {/* Display order ID in header */}
        <h1 className="text-2xl font-semibold mb-4">Order #{order.id}</h1>
        <div className="space-y-2">
          {/* Display order status */}
          <div className="text-sm">Status: {order.status}</div>
          {/* Display order creation date */}
          <div className="text-sm">Created: {order.createdAt}</div>
          {/* Display items section */}
          <div className="text-sm font-medium">Items</div>
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
