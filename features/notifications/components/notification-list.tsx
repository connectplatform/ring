/**
 * Notification List Component
 * Full-page notification management with filtering, search, and bulk actions
 * Enhanced with React 19 navigation
 */

'use client';

import React, { useState, useMemo, useTransition, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Check, 
  CheckCheck, 
  Trash2,
  Bell,
  Settings,
  ChevronDown,
  X,
  Loader2
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';
import { NotificationItem } from './notification-item';
import { NotificationType, NotificationPriority } from '@/features/notifications/types';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { useCursorFeed } from '@/hooks/use-cursor-feed';
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint';
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response';
import { apiClient, type ApiResponse } from '@/lib/api-client';
import type { Notification, NotificationListResponse } from '@/features/notifications/types';
import { useSession } from 'next-auth/react';

interface NotificationListProps {
  className?: string;
}

export function NotificationList({ className }: NotificationListProps) {
  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | NotificationType>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | NotificationPriority>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // Hooks — actions/stats from useNotifications; list pagination via useCursorFeed SSOT
  const { data: session } = useSession();
  const locale = useLocale();
  const {
    unreadCount,
    totalCount,
    markingAllAsRead,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications({
    unreadOnly: selectedFilter === 'unread',
    types: selectedFilter !== 'all' && selectedFilter !== 'unread' ? [selectedFilter] : undefined,
    autoRefresh: false,
    listEnabled: false,
  });

  const typesParam =
    selectedFilter !== 'all' && selectedFilter !== 'unread' ? [selectedFilter as NotificationType] : undefined;

  const filterFingerprint = useMemo(
    () =>
      buildFilterFingerprint('notifications', {
        unreadOnly: selectedFilter === 'unread',
        types: typesParam?.join(',') || '',
        search: searchQuery,
        priority: selectedPriority,
        sortBy,
      }),
    [selectedFilter, typesParam, searchQuery, selectedPriority, sortBy],
  );

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('startAfter', cursor);
      if (selectedFilter === 'unread') params.set('unreadOnly', 'true');
      if (typesParam?.length) params.set('types', typesParam.join(','));

      const response: ApiResponse<NotificationListResponse> = await apiClient.get(
        `/api/notifications?${params.toString()}`,
        { timeout: 8000, retries: 1 },
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

      const data = response.data;
      return normalizePaginatedResponse<Notification>(
        {
          notifications: data.notifications,
          items: data.notifications,
          lastVisible: data.lastVisible,
          cursor: data.lastVisible,
          hasMore: data.hasMore,
        },
        20,
      );
    },
    [selectedFilter, typesParam],
  );

  const {
    items: feedNotifications,
    loading,
    hasMore,
    sentinelRef,
    reload,
  } = useCursorFeed<Notification>({
    moduleId: 'notifications',
    locale,
    limit: 20,
    filterFingerprint,
    initialItems: [],
    initialCursor: null,
    enabled: Boolean(session?.user),
    fetchPage,
    restoreScroll: false,
  });

  // Prefer feed list; keep refresh wired to both
  const notifications = feedNotifications;
  const refreshing = loading && notifications.length > 0;
  const refreshAll = useCallback(async () => {
    await reload();
    await refresh();
  }, [reload, refresh]);

  // React 19 Enhanced Navigation
  const { navigateToSettings, isNavigating } = useNotificationNavigation();

  // Search and filter change handlers - wrapped in useTransition for non-blocking updates
  const handleSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  }, [startTransition]);

  const handleFilterChange = useCallback((filter: 'all' | 'unread' | NotificationType) => {
    startTransition(() => {
      setSelectedFilter(filter);
    });
  }, [startTransition]);

  const handlePriorityChange = useCallback((priority: 'all' | NotificationPriority) => {
    startTransition(() => {
      setSelectedPriority(priority);
    });
  }, [startTransition]);

  const handleSortChange = useCallback((sort: 'newest' | 'oldest' | 'priority') => {
    startTransition(() => {
      setSortBy(sort);
    });
  }, [startTransition]);

  const handleClearFilters = useCallback(() => {
    startTransition(() => {
      setSearchQuery('');
      setSelectedFilter('all');
      setSelectedPriority('all');
    });
  }, [startTransition]);

  // Filter and sort notifications
  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications.filter(notification => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!notification.title.toLowerCase().includes(query) && 
            !notification.body.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Priority filter
      if (selectedPriority !== 'all' && notification.priority !== selectedPriority) {
        return false;
      }

      return true;
    });

    // Sort notifications
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

    return filtered;
  }, [notifications, searchQuery, selectedPriority, sortBy]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredAndSortedNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredAndSortedNotifications.map(n => n.id)));
    }
  };

  const handleSelectNotification = (id: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  // Bulk actions
  const handleBulkMarkAsRead = async () => {
    const promises = Array.from(selectedNotifications).map(id => markAsRead(id));
    await Promise.all(promises);
    setSelectedNotifications(new Set());
  };

  const handleBulkDelete = async () => {
    // TODO: Implement bulk delete API
    console.log('Bulk delete:', Array.from(selectedNotifications));
    setSelectedNotifications(new Set());
  };

  const handleSettings = () => {
    navigateToSettings();
  };

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Notifications', count: totalCount },
    { value: 'unread', label: 'Unread', count: unreadCount },
    { value: NotificationType.OPPORTUNITY_CREATED, label: 'Opportunities', count: 0 },
    { value: NotificationType.ENTITY_VERIFIED, label: 'Entities', count: 0 },
    { value: NotificationType.WALLET_TRANSACTION, label: 'Wallet', count: 0 },
    { value: NotificationType.SYSTEM_MAINTENANCE, label: 'System', count: 0 }
  ];

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'priority', label: 'Priority' }
  ];

  return (
    <div className={cn('max-w-4xl mx-auto p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">
            {totalCount} total, {unreadCount} unread
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Refresh button */}
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Refresh notifications"
          >
            <Loader2 className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>

          {/* Settings button */}
          <button
            onClick={handleSettings}
            className={cn(
              "p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors",
              isNavigating && "opacity-50"
            )}
            aria-label="Notification settings"
            disabled={isNavigating}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter toggles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors',
                showFilters 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
            </button>

            {/* Quick stats */}
              <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedNotifications.length} of {totalCount} notifications
            </div>
          </div>

          {/* Bulk actions */}
          {selectedNotifications.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {selectedNotifications.size} selected
              </span>
              <button
                onClick={handleBulkMarkAsRead}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Mark as Read</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Type
                </label>
                <select
                  value={selectedFilter}
                  onChange={(e) => handleFilterChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {filterOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} {option.count > 0 && `(${option.count})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Priority
                </label>
                <select
                  value={selectedPriority}
                  onChange={(e) => handlePriorityChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions bar */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={markAllAsRead}
            disabled={markingAllAsRead}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {markingAllAsRead ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            <span>Mark All as Read</span>
          </button>
        </div>
      )}

      {/* Notifications list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Select all header */}
        {filteredAndSortedNotifications.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedNotifications.size === filteredAndSortedNotifications.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
                <span className="text-sm font-medium text-muted-foreground">
                Select all notifications
              </span>
            </label>
          </div>
        )}

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-muted-foreground">Loading notifications...</span>
          </div>
        ) : error ? (
          <div className="text-center p-12">
            <div className="text-red-600 mb-4">
              <Bell className="w-12 h-12 mx-auto mb-3" />
              <p className="text-lg font-medium">Failed to load notifications</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredAndSortedNotifications.length === 0 ? (
          <div className="text-center p-12">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all'
                ? 'No matching notifications'
                : 'No notifications yet'
              }
            </h3>
              <p className="text-muted-foreground">
              {searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all'
                ? 'Try adjusting your search or filters'
                : 'New notifications will appear here when they arrive'
              }
            </p>
            {(searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="mt-3 text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAndSortedNotifications.map((notification) => (
              <div key={notification.id} className="relative">
                {/* Selection checkbox */}
                <div className="absolute left-4 top-4 z-10">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.has(notification.id)}
                    onChange={() => handleSelectNotification(notification.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                
                {/* Notification item */}
                <div className="pl-12">
                  <NotificationItem
                    notification={notification}
                    onMarkAsReadAction={markAsRead}
                    showActions={true}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel (useCursorFeed) */}
        {loading && notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 flex justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
      </div>
    </div>
  );
} 