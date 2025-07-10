'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useOptimistic, useTransition } from 'react'
import { ThumbsUp, ThumbsDown, MoreHorizontal, Flag, Edit, Trash2, Calendar, User } from 'lucide-react'
import { StarRating } from '@/components/ui/star-rating'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface Review {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  title: string
  content: string
  photos?: string[]
  helpfulVotes: number
  unhelpfulVotes: number
  userVote?: 'helpful' | 'unhelpful' | null
  createdAt: Date
  updatedAt?: Date
  verified: boolean
}

export interface ReviewListProps {
  /** Reviews to display */
  reviews: Review[]
  /** Current user ID for permissions */
  currentUserId?: string
  /** Whether current user can moderate */
  canModerate?: boolean
  /** Loading state */
  loading?: boolean
  /** Callback when review is edited */
  onEdit?: (reviewId: string) => void
  /** Callback when review is deleted */
  onDelete?: (reviewId: string) => void
  /** Callback when review is reported */
  onReport?: (reviewId: string) => void
  /** Callback when helpful vote is cast */
  onVoteHelpful?: (reviewId: string) => Promise<void>
  /** Callback when unhelpful vote is cast */
  onVoteUnhelpful?: (reviewId: string) => Promise<void>
  /** Custom class name */
  className?: string
  /** Number of reviews per page */
  pageSize?: number
}

interface OptimisticVote {
  reviewId: string
  vote: 'helpful' | 'unhelpful' | null
  helpfulVotes: number
  unhelpfulVotes: number
}

// Simple date formatting function
function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function ReviewList({
  reviews,
  currentUserId,
  canModerate = false,
  loading = false,
  onEdit,
  onDelete,
  onReport,
  onVoteHelpful,
  onVoteUnhelpful,
  className,
  pageSize = 10
}: ReviewListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'helpful' | 'rating'>('newest')
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  // Optimistic updates for voting
  const [optimisticVotes, updateOptimisticVotes] = useOptimistic<OptimisticVote[]>(
    [],
    (state, newVote: OptimisticVote) => {
      const existingIndex = state.findIndex(v => v.reviewId === newVote.reviewId)
      if (existingIndex >= 0) {
        return state.map((vote, index) => 
          index === existingIndex ? newVote : vote
        )
      }
      return [...state, newVote]
    }
  )

  // Get optimistic vote data for a review
  const getOptimisticData = useCallback((review: Review) => {
    const optimisticVote = optimisticVotes.find(v => v.reviewId === review.id)
    if (optimisticVote) {
      return {
        ...review,
        userVote: optimisticVote.vote,
        helpfulVotes: optimisticVote.helpfulVotes,
        unhelpfulVotes: optimisticVote.unhelpfulVotes
      }
    }
    return review
  }, [optimisticVotes])

  // Handle helpful vote with optimistic update
  const handleVoteHelpful = useCallback(async (review: Review) => {
    if (!currentUserId || !onVoteHelpful) return

    const currentVote = review.userVote
    const newVote = currentVote === 'helpful' ? null : 'helpful'
    
    // Calculate optimistic vote counts
    let newHelpfulVotes = review.helpfulVotes
    let newUnhelpfulVotes = review.unhelpfulVotes

    if (currentVote === 'helpful') {
      newHelpfulVotes -= 1
    } else if (currentVote === 'unhelpful') {
      newUnhelpfulVotes -= 1
      newHelpfulVotes += 1
    } else {
      newHelpfulVotes += 1
    }

    // Apply optimistic update
    updateOptimisticVotes({
      reviewId: review.id,
      vote: newVote,
      helpfulVotes: newHelpfulVotes,
      unhelpfulVotes: newUnhelpfulVotes
    })

    // Perform actual API call
    startTransition(async () => {
      try {
        await onVoteHelpful(review.id)
      } catch (error) {
        // Revert optimistic update on error
        updateOptimisticVotes({
          reviewId: review.id,
          vote: currentVote,
          helpfulVotes: review.helpfulVotes,
          unhelpfulVotes: review.unhelpfulVotes
        })
      }
    })
      }, [currentUserId, onVoteHelpful, updateOptimisticVotes, startTransition])

  // Handle unhelpful vote with optimistic update  
  const handleVoteUnhelpful = useCallback(async (review: Review) => {
    if (!currentUserId || !onVoteUnhelpful) return

    const currentVote = review.userVote
    const newVote = currentVote === 'unhelpful' ? null : 'unhelpful'
    
    // Calculate optimistic vote counts
    let newHelpfulVotes = review.helpfulVotes
    let newUnhelpfulVotes = review.unhelpfulVotes

    if (currentVote === 'unhelpful') {
      newUnhelpfulVotes -= 1
    } else if (currentVote === 'helpful') {
      newHelpfulVotes -= 1
      newUnhelpfulVotes += 1
    } else {
      newUnhelpfulVotes += 1
    }

    // Apply optimistic update
    updateOptimisticVotes({
      reviewId: review.id,
      vote: newVote,
      helpfulVotes: newHelpfulVotes,
      unhelpfulVotes: newUnhelpfulVotes
    })

    // Perform actual API call
    startTransition(async () => {
      try {
        await onVoteUnhelpful(review.id)
      } catch (error) {
        // Revert optimistic update on error
        updateOptimisticVotes({
          reviewId: review.id,
          vote: currentVote,
          helpfulVotes: review.helpfulVotes,
          unhelpfulVotes: review.unhelpfulVotes
        })
      }
    })
  }, [currentUserId, onVoteUnhelpful, updateOptimisticVotes, startTransition])

  // Sort and filter reviews
  const processedReviews = useMemo(() => {
    let filtered = reviews

    // Filter by rating if specified
    if (filterRating !== null) {
      filtered = filtered.filter(review => review.rating === filterRating)
    }

    // Sort reviews
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'helpful':
          return b.helpfulVotes - a.helpfulVotes
        case 'rating':
          return b.rating - a.rating
        default:
          return 0
      }
    })

    return sorted
  }, [reviews, sortBy, filterRating])

  // Paginate reviews
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return processedReviews.slice(startIndex, endIndex)
  }, [processedReviews, currentPage, pageSize])

  const totalPages = Math.ceil(processedReviews.length / pageSize)

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-20 bg-gray-200 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="text-gray-500">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
          <p>Be the first to share your experience!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={sortBy === 'newest' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('newest')}
          >
            Newest
          </Button>
          <Button
            variant={sortBy === 'helpful' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('helpful')}
          >
            Most Helpful
          </Button>
          <Button
            variant={sortBy === 'rating' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('rating')}
          >
            Highest Rating
          </Button>
        </div>

        <div className="flex gap-2">
          {[5, 4, 3, 2, 1].map(rating => (
            <Button
              key={rating}
              variant={filterRating === rating ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterRating(filterRating === rating ? null : rating)}
            >
              {rating}★
            </Button>
          ))}
          {filterRating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterRating(null)}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {paginatedReviews.map(review => {
          const reviewData = getOptimisticData(review)
          const canEdit = currentUserId === review.userId
          const canDelete = canEdit || canModerate

          return (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  {/* User Avatar */}
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {review.userAvatar ? (
                      <img 
                        src={review.userAvatar} 
                        alt={review.userName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      review.userName.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {review.userName}
                          </h4>
                          {review.verified && (
                            <Badge variant="secondary" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <StarRating value={review.rating} size="sm" />
                          <span>•</span>
                          <Calendar className="w-4 h-4" />
                          <span>{formatDistanceToNow(review.createdAt)}</span>
                          {review.updatedAt && review.updatedAt > review.createdAt && (
                            <>
                              <span>•</span>
                              <span className="text-gray-500">edited</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit?.(review.id)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Review
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem 
                              onClick={() => onDelete?.(review.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Review
                            </DropdownMenuItem>
                          )}
                          {!canEdit && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onReport?.(review.id)}>
                                <Flag className="w-4 h-4 mr-2" />
                                Report Review
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Review Title */}
                    <h5 className="font-medium text-gray-900 mb-2">
                      {review.title}
                    </h5>

                    {/* Review Content */}
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {review.content}
                    </p>

                    {/* Review Photos */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                        {review.photos.map((photo, index) => (
                          <img
                            key={index}
                            src={photo}
                            alt={`Review photo ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ))}
                      </div>
                    )}

                    {/* Helpful Voting */}
                    {currentUserId && currentUserId !== review.userId && (
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <span className="text-sm text-gray-600">Was this helpful?</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoteHelpful(review)}
                            disabled={isPending}
                            className={cn(
                              'flex items-center gap-1',
                              reviewData.userVote === 'helpful' && 'text-green-600 bg-green-50'
                            )}
                          >
                            <ThumbsUp className="w-4 h-4" />
                            <span>{reviewData.helpfulVotes}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoteUnhelpful(review)}
                            disabled={isPending}
                            className={cn(
                              'flex items-center gap-1',
                              reviewData.userVote === 'unhelpful' && 'text-red-600 bg-red-50'
                            )}
                          >
                            <ThumbsDown className="w-4 h-4" />
                            <span>{reviewData.unhelpfulVotes}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1
            return (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            )
          })}
          
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

export default ReviewList 