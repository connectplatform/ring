'use client';

import React, { useState, useEffect } from 'react';
import { NewsCard } from './news-card';
import { NewsArticle, NewsFilters, NewsCategoryInfo } from '@/features/news/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Loader2 } from 'lucide-react';

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
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<NewsFilters>({
    status: 'published',
    limit: limit,
    offset: 0,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(true);

  // Fetch articles based on current filters
  const fetchArticles = async (reset = false) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
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

      const response = await fetch(`/api/news?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        if (reset) {
          setArticles(data.data);
        } else {
          setArticles(prev => [...prev, ...data.data]);
        }
        setHasMore(data.data.length === filters.limit);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more articles
  const loadMore = () => {
    setFilters(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 10)
    }));
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof NewsFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset offset when filters change
    }));
  };

  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, offset: 0 }));
  };

  // Effect to fetch articles when filters change
  useEffect(() => {
    if (filters.offset === 0) {
      fetchArticles(true);
    } else {
      fetchArticles(false);
    }
  }, [filters, searchTerm]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="space-y-4">
          {showSearch && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search news articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Articles Grid */}
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

      {/* Load More Button */}
      {hasMore && articles.length > 0 && (
        <div className="text-center">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Articles'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}