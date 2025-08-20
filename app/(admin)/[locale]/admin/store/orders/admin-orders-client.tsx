'use client'

import React, { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { updateOrderStatus, refreshOrders } from '@/app/_actions/admin-orders'

interface Order {
  id: string;
  status?: string;
  userId?: string;
  createdAt?: string;
  items?: any[];
  [key: string]: any;
}

interface AdminOrdersClientProps {
  initialOrders: Order[];
  currentStatusFilter?: string;
  locale: string;
}

export default function AdminOrdersClient({ 
  initialOrders, 
  currentStatusFilter = '', 
  locale 
}: AdminOrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Handle status filter change
  const handleStatusFilterChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams);
    if (newStatus) {
      params.set('status', newStatus);
    } else {
      params.delete('status');
    }
    
    startTransition(() => {
      router.push(`/${locale}/admin/store/orders?${params.toString()}`);
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    startTransition(async () => {
      await refreshOrders();
      router.refresh();
    });
  };

  // Handle order status update
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('status', newStatus);
    
    startTransition(async () => {
      setUpdateError(null);
      const result = await updateOrderStatus(formData);
      if (!result.success) {
        setUpdateError(result.error || 'Failed to update order status');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Admin: Orders</h1>
      
      {/* Filters and Actions */}
      <div className="flex items-center gap-3 mb-4">
        <select 
          className="border rounded px-2 py-1" 
          value={currentStatusFilter} 
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          disabled={isPending}
        >
          <option value="">All statuses</option>
          <option value="new">new</option>
          <option value="paid">paid</option>
          <option value="processing">processing</option>
          <option value="shipped">shipped</option>
          <option value="completed">completed</option>
          <option value="canceled">canceled</option>
        </select>
        
        <button 
          className="px-3 py-1 border rounded disabled:opacity-50" 
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {updateError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {updateError}
        </div>
      )}

      {/* Orders List */}
      {initialOrders.length === 0 ? (
        <div className="text-muted-foreground">
          {currentStatusFilter ? `No orders with status "${currentStatusFilter}".` : 'No orders.'}
        </div>
      ) : (
        <div className="space-y-2">
          {initialOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onUpdateStatus={handleUpdateOrderStatus}
              isUpdating={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, status: string) => void;
  isUpdating: boolean;
}

function OrderCard({ order, onUpdateStatus, isUpdating }: OrderCardProps) {
  const [selectedStatus, setSelectedStatus] = useState(order.status || 'new');

  const handleUpdateClick = () => {
    if (selectedStatus !== order.status) {
      onUpdateStatus(order.id, selectedStatus);
    }
  };

  const statusChanged = selectedStatus !== (order.status || 'new');

  return (
    <div className="border rounded p-3">
      <div className="font-medium">Order #{order.id}</div>
      <div className="text-sm text-muted-foreground">
        Status: <span className={`font-medium ${getStatusColor(order.status || 'new')}`}>
          {order.status || 'new'}
        </span>
      </div>
      <div className="text-sm">User: {order.userId || '-'}</div>
      <div className="text-sm">Created: {order.createdAt || '-'}</div>
      
      {/* Order Items */}
      {order.items && order.items.length > 0 && (
        <div className="text-sm mt-2">
          <div className="font-medium">Items:</div>
          <div className="ml-2">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span>{item.name} × {item.quantity}</span>
                <span>{item.price} {item.currency}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Status Update Form */}
      <div className="mt-2 flex items-center gap-2">
        <select 
          className="border rounded px-2 py-1" 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isUpdating}
        >
          <option value="new">new</option>
          <option value="paid">paid</option>
          <option value="processing">processing</option>
          <option value="shipped">shipped</option>
          <option value="completed">completed</option>
          <option value="canceled">canceled</option>
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
          {isUpdating ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'text-blue-600';
    case 'paid': return 'text-green-600';
    case 'processing': return 'text-yellow-600';
    case 'shipped': return 'text-purple-600';
    case 'completed': return 'text-green-800';
    case 'canceled': return 'text-red-600';
    default: return 'text-gray-600';
  }
}
