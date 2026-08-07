import { Timestamp } from 'firebase/firestore'

export interface Review {
  id: string
  targetId: string // Entity, Opportunity, or News article ID
  targetType: 'entity' | 'opportunity' | 'news'
  reviewerId: string
  reviewerName: string
  reviewerAvatar?: string
  rating: number // 1-5 stars
  content: string
  isVerified?: boolean // For verified purchases/interactions
  helpfulVotes?: number
  unhelpfulVotes?: number
  createdAt: Timestamp
  updatedAt: Timestamp
  editedAt?: Timestamp
  isEdited?: boolean
  moderationStatus?: 'pending' | 'approved' | 'rejected'
  moderationReason?: string
  responses?: ReviewResponse[] // Admin/business responses
}

export interface ReviewResponse {
  id: string
  responderId: string
  responderName: string
  responderType: 'admin' | 'business' | 'owner'
  content: string
  createdAt: Timestamp
}

export interface ReviewFilters {
  rating: string // 'all' | '5' | '4' | '3' | '2' | '1'
  verified: string // 'all' | 'verified' | 'unverified'
  timeRange?: string // 'all' | '30d' | '90d' | '1y'
}

export type ReviewSort = 
  | 'newest' 
  | 'oldest' 
  | 'highest_rated' 
  | 'lowest_rated' 
  | 'most_helpful'

export interface ReviewFormData {
  rating: number
  content: string
  isAnonymous?: boolean
}

export interface ReviewStats {
  totalReviews: number
  averageRating: number
  ratingDistribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
  verifiedReviews: number
  recentReviews: Review[]
}

export interface ReviewModeration {
  id: string
  reviewId: string
  moderatorId: string
  action: 'approve' | 'reject' | 'flag'
  reason: string
  createdAt: Timestamp
} 