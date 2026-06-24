'use client';

import React, { useCallback, useMemo, useTransition } from 'react';
import { NewsCard } from './news-card';
import { NewsArticle, NewsFilters, NewsCategoryInfo } from '@/features/news/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Loader2 } from 'lucide-react';
import { useCursorFeed } from '@/hooks/use-cursor-feed';
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint';
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response';

interface NewsListProps {
  initialArticles?: NewsArticle[];
  categories?: NewsCategoryInfo[];
  showFilters?: boolean;
  showSearch?: boolean;
  limit?: number;
  className?: string;
  locale?: string;
}

export function NewsList({ 
  initialArticles = [],
  categories = [],
  showFilters = true,
  showSearch = true,
  limit = 10,
  className = '',
  locale = 'en'
}: NewsListProps) {
  const [, startTransition] = useTransition();

  const [filters, setFilters] = React.useState<NewsFilters>({
    status: 'published',
    limit,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = React.useState('');

  const filterFingerprint = useMemo(
    () =>
      buildFilterFingerprint('news', {
        ...filters,
        search: searchTerm,
      } as Record<string, unknown>),
    [filters, searchTerm],
  );

  const fetchNewsPage = useCallback(
    async (cursor: string | null) => {
      const queryParams = new URLSearchParams();
      queryParams.set('pagination', 'cursor');
      queryParams.set('limit', String(filters.limit ?? limit));

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && key !== 'offset') {
          if (Array.isArray(value)) {
            queryParams.set(key, value.join(','));
          } else {
            queryParams.set(key, value.toString());
          }
        }
      });

      if (searchTerm) {
        queryParams.set('search', searchTerm);
      }

      if (cursor) {
        queryParams.set('startAfter', cursor);
      }

      const response = await fetch(`/api/news?${queryParams.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch news articles');
      }

      const items = (data.items ?? data.data ?? []) as NewsArticle[];
      return normalizePaginatedResponse<NewsArticle>(
        { items, cursor: data.cursor, hasMore: data.hasMore },
        filters.limit ?? limit,
      );
    },
    [filters, limit, searchTerm],
  );

  const {
    items: articles,
    loading,
    hasMore,
    sentinelRef,
  } = useCursorFeed<NewsArticle>({
    moduleId: 'news',
    locale,
    limit: filters.limit ?? limit,
    filterFingerprint,
    initialItems: initialArticles,
    initialCursor: null,
    fetchPage: fetchNewsPage,
  });

  const handleSearchChange = useCallback((value: string) => {
    startTransition(() => {
      setSearchTerm(value);
    });
  }, [startTransition]);

  const handleFilterChange = useCallback((key: keyof NewsFilters, value: unknown) => {
    startTransition(() => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    });
  }, [startTransition]);

  const handleSearch = useCallback(() => {
    startTransition(() => {
      setSearchTerm((current) => current.trim());
    });
  }, [startTransition]);

  return (
    <div className={`space-y-6 ${className}`}>
      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {showSearch && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search news articles..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}

          {showFilters && (
            <div className="flex flex-wrap gap-4">
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => 
                  handleFilterChange('category', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.sortBy || 'publishedAt'}
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publishedAt">Latest</SelectItem>
                  <SelectItem value="views">Most Viewed</SelectItem>
                  <SelectItem value="likes">Most Liked</SelectItem>
                  <SelectItem value="createdAt">Recently Added</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => handleFilterChange('featured', !filters.featured)}
                className={filters.featured ? 'bg-primary text-primary-foreground' : ''}
              >
                <Filter className="h-4 w-4 mr-2" />
                Featured Only
              </Button>
            </div>
          )}
        </div>
      )}

      {articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {loading ? 'Loading articles...' : 'No articles found.'}
          </p>
        </div>
      )}

      {loading && articles.length > 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-10" />}
    </div>
  );
}
