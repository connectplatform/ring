'use client'

import React from 'react'
import Image from 'next/image'
import { Review } from '@/types/reviews'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Flag,
  Shield,
  Calendar,
  User
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ReviewCardProps {
  review: Review
  currentUserId?: string
  canModerate?: boolean
  // @ts-ignore React 19 serialization - client-side callbacks
  onEdit?: (reviewId: string) => void
  // @ts-ignore React 19 serialization - client-side callbacks
  onDelete?: (reviewId: string) => void
  // @ts-ignore React 19 serialization - client-side callbacks
  onReport?: (reviewId: string) => void
  // @ts-ignore React 19 serialization - client-side callbacks
  onVoteHelpful?: (reviewId: string) => void
  // @ts-ignore React 19 serialization - client-side callbacks
  onVoteUnhelpful?: (reviewId: string) => void
}

// Simple Avatar component
function SimpleAvatar({ src, alt, fallback }: { src?: string; alt: string; fallback: string }) {
  return (
    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
      {src ? (
        <Image 
          src={src} 
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
              <span className="text-sm font-medium text-muted-foreground">
          {fallback}
        </span>
      )}
    </div>
  )
}

export function ReviewCard({
  review,
  currentUserId,
  canModerate = false,
  onEdit,
  onDelete,
  onReport,
  onVoteHelpful,
  onVoteUnhelpful
}: ReviewCardProps) {
  const isOwnReview = currentUserId === review.reviewerId
  const canEdit = isOwnReview && onEdit
  const canDelete = (isOwnReview || canModerate) && onDelete

  // Client-side event handlers
  const handleEdit = () => onEdit?.(review.id)
  const handleDelete = () => onDelete?.(review.id)
  const handleReport = () => onReport?.(review.id)
  const handleVoteHelpful = () => onVoteHelpful?.(review.id)
  const handleVoteUnhelpful = () => onVoteUnhelpful?.(review.id)

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <SimpleAvatar
              src={review.reviewerAvatar}
              alt={review.reviewerName}
              fallback={review.reviewerName.charAt(0).toUpperCase()}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-sm">{review.reviewerName}</h4>
                {review.isVerified && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {review.isEdited && (
                  <span className="text-xs text-gray-500">(edited)</span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true })}
                  </span>
                </div>
                {renderStars(review.rating)}
              </div>
            </div>
          </div>
          
          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Review
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Review
                </DropdownMenuItem>
              )}
              {!isOwnReview && onReport && (
                <DropdownMenuItem onClick={handleReport}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report Review
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Review Content */}
          <p className="text-muted-foreground leading-relaxed">
            {review.content}
          </p>

          {/* Review Responses */}
          {review.responses && review.responses.length > 0 && (
            <div className="space-y-3 pt-3 border-t">
              {review.responses.map((response) => (
                <div key={response.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {response.responderType === 'admin' ? 'Admin' : 'Business'} Response
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(response.createdAt.toDate(), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{response.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Helpful Votes */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVoteHelpful}
                className="text-xs"
                disabled={!onVoteHelpful}
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Helpful ({review.helpfulVotes || 0})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVoteUnhelpful}
                className="text-xs"
                disabled={!onVoteUnhelpful}
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Not Helpful ({review.unhelpfulVotes || 0})
              </Button>
            </div>

            {/* Moderation Status */}
            {review.moderationStatus && review.moderationStatus !== 'approved' && (
              <Badge 
                variant={review.moderationStatus === 'pending' ? 'secondary' : 'destructive'}
                className="text-xs"
              >
                {review.moderationStatus}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 