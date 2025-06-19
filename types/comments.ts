export type CommentTargetType = 'news' | 'entity' | 'opportunity' | 'comment'

export interface Comment {
  id: string
  content: string
  authorId: string
  authorName: string
  authorAvatar?: string
  targetId: string
  targetType: CommentTargetType
  parentId?: string // For nested replies
  level: number // 0 = top-level, 1 = reply, 2 = reply to reply, etc.
  likes: number
  replies: number
  status: 'active' | 'hidden' | 'deleted'
  isEdited: boolean
  isPinned?: boolean
  createdAt: Date
  updatedAt: Date
  editedAt?: Date
}

export interface CommentFormData {
  content: string
  targetId: string
  targetType: CommentTargetType
  parentId?: string
}

export interface CommentWithReplies extends Comment {
  childComments?: CommentWithReplies[]
}

export interface CommentFilters {
  targetId: string
  targetType: CommentTargetType
  parentId?: string
  status?: 'active' | 'hidden' | 'deleted'
  authorId?: string
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'likes' | 'replies'
  sortOrder?: 'asc' | 'desc'
}

export interface CommentStats {
  total: number
  active: number
  hidden: number
  deleted: number
  topLevel: number
  replies: number
}

export interface CommentActionResult {
  success: boolean
  error?: string
  message?: string
  data?: Comment
}

// React 19 Hook Types
export interface CommentActionState {
  error?: string
  success?: boolean
  message?: string
  comment?: Comment
} 