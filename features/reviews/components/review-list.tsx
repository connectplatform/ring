'use client';

import React from 'react';
import { Review, ReviewFilters, ReviewSort } from '@/types/reviews';
import { ReviewCard } from './review-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Star, 
  Filter, 
  Search, 
  SortAsc, 
  MessageSquare 
} from 'lucide-react';

interface ReviewListProps {
  reviews: Review[];
  isLoading?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  showSorting?: boolean;
  emptyMessage?: string;
  filters?: ReviewFilters;
  sort?: ReviewSort;
  onFiltersChange?: (filters: ReviewFilters) => void;
  onSortChange?: (sort: ReviewSort) => void;
  
  // Action callbacks - client-side functions
  // @ts-ignore React 19 serialization - client-side callback
  onEdit?: (reviewId: string) => void;
  // @ts-ignore React 19 serialization - client-side callback
  onDelete?: (reviewId: string) => void;
  // @ts-ignore React 19 serialization - client-side callback
  onReport?: (reviewId: string) => void;
  // @ts-ignore React 19 serialization - client-side callback
  onVoteHelpful?: (reviewId: string) => void;
  // @ts-ignore React 19 serialization - client-side callback
  onVoteUnhelpful?: (reviewId: string) => void;
}

const RATING_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4+ Stars' },
  { value: '3', label: '3+ Stars' },
  { value: '2', label: '2+ Stars' },
  { value: '1', label: '1+ Star' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'lowest_rated', label: 'Lowest Rated' },
  { value: 'most_helpful', label: 'Most Helpful' },
];

export function ReviewList({
  reviews,
  isLoading = false,
  showFilters = true,
  showSearch = true,
  showSorting = true,
  emptyMessage = "No reviews yet. Be the first to leave a review!",
  filters = { rating: 'all', verified: 'all' },
  sort = 'newest',
  onFiltersChange,
  onSortChange,
  onEdit,
  onDelete,
  onReport,
  onVoteHelpful,
  onVoteUnhelpful
}: ReviewListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [localFilters, setLocalFilters] = React.useState(filters);
  const [localSort, setLocalSort] = React.useState(sort);

  // Client-side filter change handler
  const handleFiltersChange = (newFilters: Partial<ReviewFilters>) => {
    const updatedFilters = { ...localFilters, ...newFilters };
    setLocalFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  };

  // Client-side sort change handler
  const handleSortChange = (newSort: ReviewSort) => {
    setLocalSort(newSort);
    onSortChange?.(newSort);
  };

  // Calculate average rating
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  // Rating distribution
  const ratingDistribution = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  };

  // Filter reviews based on search and filters
  const filteredReviews = React.useMemo(() => {
    let filtered = reviews;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(review =>
        review.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.reviewerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Rating filter
    if (localFilters.rating !== 'all') {
      const minRating = parseInt(localFilters.rating);
      filtered = filtered.filter(review => review.rating >= minRating);
    }

    // Verified filter
    if (localFilters.verified !== 'all') {
      const isVerified = localFilters.verified === 'verified';
      filtered = filtered.filter(review => review.isVerified === isVerified);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (localSort) {
        case 'newest':
          return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
        case 'oldest':
          return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
        case 'highest_rated':
          return b.rating - a.rating;
        case 'lowest_rated':
          return a.rating - b.rating;
        case 'most_helpful':
          return (b.helpfulVotes || 0) - (a.helpfulVotes || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [reviews, searchTerm, localFilters, localSort]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 w-full bg-gray-200 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Review Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Reviews Summary
          </CardTitle>
          <CardDescription>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} with an average rating of {averageRating.toFixed(1)} stars
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Average Rating */}
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-500 mb-2">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(averageRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <div className="text-sm text-gray-600">
                Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{
                        width: `${reviews.length > 0 ? (ratingDistribution[rating as keyof typeof ratingDistribution] / reviews.length) * 100 : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">
                    {ratingDistribution[rating as keyof typeof ratingDistribution]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      {(showFilters || showSearch || showSorting) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter & Sort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              {showSearch && (
                <div className="space-y-2">
                  <Label htmlFor="search">Search Reviews</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="search"
                      placeholder="Search reviews..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {/* Rating Filter */}
              {showFilters && (
                <div className="space-y-2">
                  <Label>Minimum Rating</Label>
                  <Select
                    value={localFilters.rating}
                    onValueChange={(value) => handleFiltersChange({ rating: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sort */}
              {showSorting && (
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select
                    value={localSort}
                    onValueChange={(value: ReviewSort) => handleSortChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Filter Summary */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-gray-600">
                Showing {filteredReviews.length} of {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
              {(localFilters.rating !== 'all' || localFilters.verified !== 'all' || searchTerm.trim()) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setLocalFilters({ rating: 'all', verified: 'all' });
                    handleFiltersChange({ rating: 'all', verified: 'all' });
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm.trim() || localFilters.rating !== 'all' || localFilters.verified !== 'all'
                  ? "No reviews match your criteria"
                  : "No reviews yet"
                }
              </h3>
              <p className="text-gray-600">
                {emptyMessage}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              onVoteHelpful={onVoteHelpful}
              onVoteUnhelpful={onVoteUnhelpful}
            />
          ))
        )}
      </div>
    </div>
  );
} 