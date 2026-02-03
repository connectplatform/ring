import React from 'react'
import { Order } from '@/features/store/types'
import StoreWrapper from '@/components/wrappers/store-wrapper'

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

export default async function OrderDetailsPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id)
  if (!order) return <div>Order not found</div>
  return (
    <StoreWrapper locale="en">
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


