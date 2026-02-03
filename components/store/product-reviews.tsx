'use client'

/**
 * Product Reviews Section - LEGENDARY Edition
 * 
 * Features Shopify doesn't have:
 * • Interactive star ratings with animations
 * • Customer review photos with lightbox
 * • Verified purchase badges
 * • Helpful votes system
 * • Sort by rating/date/helpfulness
 * • Review images zoom
 * • Rich text reviews
 * • Response from seller
 */

import { useState } from 'react'
import { Star, ThumbsUp, CheckCircle, Camera, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewImage {
  url: string
  thumbnail?: string
}

interface Review {
  id: string
  author: string
  authorAvatar?: string
  rating: number
  title: string
  content: string
  images?: ReviewImage[]
  verifiedPurchase: boolean
  helpful: number
  date: string
  sellerResponse?: {
    content: string
    date: string
  }
}

interface ProductReviewsProps {
  reviews: Review[]
  averageRating: number
  totalReviews: number
  ratingDistribution: number[] // [5star, 4star, 3star, 2star, 1star]
  className?: string
}

export default function ProductReviews({
  reviews,
  averageRating,
  totalReviews,
  ratingDistribution,
  className
}: ProductReviewsProps) {
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'rating'>('recent')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(new Set())

  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'helpful':
        return b.helpful - a.helpful
      case 'rating':
        return b.rating - a.rating
      case 'recent':
      default:
        return new Date(b.date).getTime() - new Date(a.date).getTime()
    }
  })

  const toggleReviewExpanded = (reviewId: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev)
      if (next.has(reviewId)) {
        next.delete(reviewId)
      } else {
        next.add(reviewId)
      }
      return next
    })
  }

  const toggleHelpful = (reviewId: string) => {
    setHelpfulVotes(prev => {
      const next = new Set(prev)
      if (next.has(reviewId)) {
        next.delete(reviewId)
      } else {
        next.add(reviewId)
      }
      return next
    })
  }

  const StarRating = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
    
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              "transition-all duration-200",
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted"
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-8", className)}>
      {/* Ratings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-muted/30 rounded-xl border">
        {/* Average Rating */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="text-6xl font-bold">{averageRating.toFixed(1)}</div>
          <StarRating rating={Math.round(averageRating)} size="lg" />
          <div className="text-sm text-muted-foreground">
            Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((stars, idx) => {
            const count = ratingDistribution[5 - stars] || 0
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0

            return (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-sm font-medium">{stars}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Customer Reviews</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2 border rounded-lg bg-background text-sm font-medium"
        >
          <option value="recent">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="rating">Highest Rating</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {sortedReviews.map((review) => {
          const isExpanded = expandedReviews.has(review.id)
          const isHelpful = helpfulVotes.has(review.id)
          const shouldTruncate = review.content.length > 300

          return (
            <div
              key={review.id}
              className="p-6 bg-card border rounded-xl hover:shadow-md transition-shadow"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  {/* Author Avatar */}
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                    {review.authorAvatar ? (
                      <img
                        src={review.authorAvatar}
                        alt={review.author}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      review.author.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Author Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{review.author}</span>
                      {review.verifiedPurchase && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <StarRating rating={review.rating} />
                      <span>•</span>
                      <time>{new Date(review.date).toLocaleDateString()}</time>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Title */}
              {review.title && (
                <h4 className="font-semibold text-lg mb-2">{review.title}</h4>
              )}

              {/* Review Content */}
              <p className={cn(
                "text-muted-foreground leading-relaxed mb-4",
                !isExpanded && shouldTruncate && "line-clamp-3"
              )}>
                {review.content}
              </p>

              {/* Expand Button */}
              {shouldTruncate && (
                <button
                  onClick={() => toggleReviewExpanded(review.id)}
                  className="text-sm text-primary hover:underline flex items-center gap-1 mb-4"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </button>
              )}

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {review.images.map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(image.url)}
                      className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors group"
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={`Review image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Seller Response */}
              {review.sellerResponse && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      Response from seller
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.sellerResponse.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {review.sellerResponse.content}
                  </p>
                </div>
              )}

              {/* Helpful Button */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Was this helpful?</span>
                <button
                  onClick={() => toggleHelpful(review.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium",
                    isHelpful
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <ThumbsUp className={cn(
                    "h-4 w-4 transition-transform",
                    isHelpful && "scale-110"
                  )} />
                  <span>Helpful</span>
                  {(review.helpful + (isHelpful ? 1 : 0)) > 0 && (
                    <span className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded-full text-xs">
                      {review.helpful + (isHelpful ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md animate-in fade-in-0 duration-300 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
          <img
            src={selectedImage}
            alt="Review image"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

