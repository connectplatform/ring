/**
 * Notification List Component
 * Full-page notification management with filtering, search, and bulk actions
 * List feed via useCursorFeed (cursor pagination SSOT); stats/actions via useNotifications
 */

'use client';

import React, { useState, useMemo, useTransition, useCallback } from 'react';
import {
  Search,
  Filter,
  Check,
  CheckCheck,
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
import { useLocale, useTranslations } from 'next-intl';
import { useCursorFeed } from '@/hooks/use-cursor-feed';
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint';
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response';
import { apiClient, type ApiResponse } from '@/lib/api-client';
import type { Notification, NotificationListResponse } from '@/features/notifications/types';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { davinciGlassSurface } from '@/lib/ui/davinci';

interface NotificationListProps {
  className?: string;
}

export function NotificationList({ className }: NotificationListProps) {
  // React 19 useTransition for non-blocking filter updates
  const [, startTransition] = useTransition();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | NotificationType>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | NotificationPriority>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // i18n
  const t = useTranslations('modules.notifications.list');
  const tItem = useTranslations('modules.notifications.item');
  const locale = useLocale();

  // Hooks — actions/stats from useNotifications; list pagination via useCursorFeed SSOT
  const { data: session } = useSession();
  const {
    unreadCount,
    totalCount,
    markingAllAsRead,
    error: statsError,
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
        throw new Error(response.error || t('errorTitle'));
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
    [selectedFilter, typesParam, t],
  );

  const {
    items: feedNotifications,
    loading,
    hasMore,
    error: feedError,
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
  const displayError = feedError ?? statsError;
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
      // Search filter (client-side over loaded pages)
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
        case 'priority': {
          const priorityOrder: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
          return (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
        }
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

  // Bulk actions (only working actions are exposed — delete has no backend)
  const handleBulkMarkAsRead = async () => {
    const promises = Array.from(selectedNotifications).map(id => markAsRead(id));
    await Promise.all(promises);
    setSelectedNotifications(new Set());
  };

  const handleSettings = () => {
    navigateToSettings();
  };

  // Filter options — labels reuse item.categories i18n keys
  const filterOptions: Array<{ value: 'all' | 'unread' | NotificationType; label: string; count?: number }> = [
    { value: 'all', label: t('allTypes'), count: totalCount },
    { value: 'unread', label: t('unread'), count: unreadCount },
    { value: NotificationType.OPPORTUNITY_CREATED, label: tItem('categories.opportunity') },
    { value: NotificationType.ENTITY_VERIFIED, label: tItem('categories.entity') },
    { value: NotificationType.WALLET_TRANSACTION, label: tItem('categories.wallet') },
    { value: NotificationType.REWARD_CREDIT_RECEIVED, label: tItem('categories.reward') },
    { value: NotificationType.SYSTEM_MAINTENANCE, label: tItem('categories.system') },
  ];

  const priorityOptions: Array<{ value: 'all' | NotificationPriority; label: string }> = [
    { value: 'all', label: t('allPriorities') },
    { value: NotificationPriority.URGENT, label: t('priorities.urgent') },
    { value: NotificationPriority.HIGH, label: t('priorities.high') },
    { value: NotificationPriority.NORMAL, label: t('priorities.normal') },
    { value: NotificationPriority.LOW, label: t('priorities.low') },
  ];

  const sortOptions: Array<{ value: 'newest' | 'oldest' | 'priority'; label: string }> = [
    { value: 'newest', label: t('newestFirst') },
    { value: 'oldest', label: t('oldestFirst') },
    { value: 'priority', label: t('prioritySort') },
  ];

  return (
    <div className={cn('w-full min-w-0 max-w-4xl mx-auto', className)}>
      {/* Stats + controls row (title lives in right rail — site-wide pattern) */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t('totalUnread', { total: totalCount, unread: unreadCount })}
        </p>

        <div className="flex items-center space-x-2">
          {/* Refresh button */}
          <Button
            onClick={refreshAll}
            disabled={refreshing}
            variant="outline"
            size="icon"
            aria-label={t('refresh')}
          >
            <Loader2 className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>

          {/* Settings button */}
          <Button
            onClick={handleSettings}
            variant="outline"
            size="icon"
            aria-label={t('settings')}
            disabled={isNavigating}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className={cn(davinciGlassSurface, 'p-4 mb-4')}>
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-9"
            aria-label={t('searchPlaceholder')}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('clearFilters')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4" />
              <span>{t('filters')}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
            </Button>

            {/* Quick stats — honest loaded-count */}
            <div className="text-sm text-muted-foreground tabular-nums">
              {t('showing', { shown: filteredAndSortedNotifications.length, total: totalCount })}
            </div>
          </div>

          {/* Bulk actions (working actions only) */}
          {selectedNotifications.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground tabular-nums">
                {t('selectedCount', { count: selectedNotifications.size })}
              </span>
              <Button
                onClick={handleBulkMarkAsRead}
                variant="outline"
                size="sm"
              >
                <Check className="w-4 h-4" />
                <span>{t('markSelectedRead')}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('type')}
                </label>
                <Select
                  value={selectedFilter}
                  onValueChange={(value) => handleFilterChange(value as 'all' | 'unread' | NotificationType)}
                >
                  <SelectTrigger className="w-full" aria-label={t('type')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        {typeof option.count === 'number' && option.count > 0 ? ` (${option.count})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('priority')}
                </label>
                <Select
                  value={selectedPriority}
                  onValueChange={(value) => handlePriorityChange(value as 'all' | NotificationPriority)}
                >
                  <SelectTrigger className="w-full" aria-label={t('priority')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort filter */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('sortBy')}
                </label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => handleSortChange(value as 'newest' | 'oldest' | 'priority')}
                >
                  <SelectTrigger className="w-full" aria-label={t('sortBy')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions bar */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-primary" aria-hidden />
            <span className="text-primary font-medium">
              {t('unreadBanner', { count: unreadCount })}
            </span>
          </div>
          <Button
            onClick={markAllAsRead}
            disabled={markingAllAsRead}
            size="sm"
          >
            {markingAllAsRead ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            <span>{t('markAllAsRead')}</span>
          </Button>
        </div>
      )}

      {/* Notifications list */}
      <div className={cn(davinciGlassSurface, 'rounded-lg overflow-hidden')}>
        {/* Select all header */}
        {filteredAndSortedNotifications.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <label className="flex items-center space-x-3 cursor-pointer">
              <Checkbox
                checked={
                  selectedNotifications.size === 0 || filteredAndSortedNotifications.length === 0
                    ? false
                    : selectedNotifications.size === filteredAndSortedNotifications.length
                      ? true
                      : 'indeterminate'
                }
                onCheckedChange={handleSelectAll}
                aria-label={t('selectAll')}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {t('selectAll')}
              </span>
            </label>
          </div>
        )}

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
            <span className="ml-3 text-muted-foreground">{t('loading')}</span>
          </div>
        ) : displayError ? (
          <div className="text-center p-12">
            <div className="text-destructive mb-4">
              <Bell className="w-12 h-12 mx-auto mb-3" aria-hidden />
              <p className="text-lg font-medium">{t('errorTitle')}</p>
              <p className="text-sm text-muted-foreground">{displayError}</p>
            </div>
            <Button onClick={refreshAll} variant="outline">
              {t('retry')}
            </Button>
          </div>
        ) : filteredAndSortedNotifications.length === 0 ? (
          <div className="text-center p-12">
            <Bell className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" aria-hidden />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all'
                ? t('emptyFilteredTitle')
                : t('emptyTitle')
              }
            </h3>
              <p className="text-muted-foreground">
              {searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all'
                ? t('emptyFilteredDescription')
                : t('emptyDescription')
              }
            </p>
            {(searchQuery || selectedFilter !== 'all' || selectedPriority !== 'all') && (
              <Button
                onClick={handleClearFilters}
                variant="ghost"
                className="mt-3 text-primary"
              >
                {t('clearFilters')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAndSortedNotifications.map((notification) => (
              <div key={notification.id} className="relative">
                {/* Selection checkbox */}
                <div className="absolute left-4 top-4 z-10">
                  <Checkbox
                    checked={selectedNotifications.has(notification.id)}
                    onCheckedChange={() => handleSelectNotification(notification.id)}
                    aria-label={t('selectNotification')}
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
          <div className="p-4 border-t border-border flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            <span className="text-sm">{t('loadMore')}</span>
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
      </div>
    </div>
  );
}
