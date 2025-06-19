'use client'

import React, { useCallback, useEffect } from 'react'
import { useOptimistic, useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { useInView } from 'react-intersection-observer'
import { 
  MessageCircle, 
  Heart, 
  Reply, 
  MoreHorizontal, 
  Flag, 
  Edit, 
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react'

import { Comment, CommentTargetType } from '@/types/comments'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createComment, CommentActionState } from '@/app/actions/comments'
import { toggleLike, LikeActionState } from '@/app/actions/likes'
import CommentForm from './comment-form'
import { formatDistanceToNow } from 'date-fns'

interface CommentListProps {
  targetId: string
  targetType: CommentTargetType
  initialComments: Comment[]
  initialError: string | null
  limit?: number
  allowReplies?: boolean
  maxDepth?: number
  showLikes?: boolean
  showReplyForm?: boolean
  className?: string
}

interface OptimisticComment extends Comment {
  isOptimistic?: boolean
  isPending?: boolean
  error?: string
  optimisticLikes?: number
  isLikedOptimistic?: boolean
}

interface CommentWithReplies extends Omit<OptimisticComment, 'replies'> {
  replies?: CommentWithReplies[]
  replyCount?: number
  showReplies?: boolean
  isExpanded?: boolean
  isLiked?: boolean
}

export default function CommentList({
  targetId,
  targetType,
  initialComments,
  initialError,
  limit = 20,
  allowReplies = true,
  maxDepth = 3,
  showLikes = true,
  showReplyForm = true,
  className = ''
}: CommentListProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [ref, inView] = useInView()

  // Optimistic state for comments
  const [optimisticComments, addOptimisticComment] = useOptimistic<
    CommentWithReplies[],
    CommentWithReplies
  >(
    buildCommentTree(initialComments),
    (currentComments, newComment) => {
      if (newComment.parentId) {
        // Add as reply to existing comment
        return addReplyToTree(currentComments, newComment)
      } else {
        // Add as top-level comment
        return [{ ...newComment, isOptimistic: true }, ...currentComments]
      }
    }
  )

  // Local state
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(initialError)
  const [expandedComments, setExpandedComments] = React.useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)

  // Server actions
  const [commentState, commentAction] = useActionState<CommentActionState | null, FormData>(
    createComment,
    null
  )

  const [likeState, likeAction] = useActionState<LikeActionState | null, FormData>(
    toggleLike,
    null
  )

  // Build comment tree structure
  function buildCommentTree(comments: Comment[]): CommentWithReplies[] {
    const commentMap = new Map<string, CommentWithReplies>()
    const rootComments: CommentWithReplies[] = []

    // First pass: create all comment objects
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
        replyCount: 0,
        showReplies: false,
        isExpanded: false
      })
    })

    // Second pass: build tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!
      
      if (comment.parentId && commentMap.has(comment.parentId)) {
        const parent = commentMap.get(comment.parentId)!
        parent.replies!.push(commentWithReplies)
        parent.replyCount = (parent.replyCount || 0) + 1
      } else {
        rootComments.push(commentWithReplies)
      }
    })

    return rootComments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  // Add reply to comment tree
  function addReplyToTree(
    comments: CommentWithReplies[], 
    newReply: CommentWithReplies
  ): CommentWithReplies[] {
    return comments.map(comment => {
      if (comment.id === newReply.parentId) {
        return {
          ...comment,
          replies: [{ ...newReply, isOptimistic: true }, ...(comment.replies || [])],
          replyCount: (comment.replyCount || 0) + 1,
          showReplies: true,
          isExpanded: true
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToTree(comment.replies, newReply)
        }
      }
      return comment
    })
  }

  // Handle optimistic comment creation
  const handleOptimisticComment = (commentData: Partial<Comment>, parentId?: string) => {
    if (!session?.user) return

    const optimisticComment: CommentWithReplies = {
      id: `temp-${Date.now()}`,
      content: commentData.content || '',
      authorId: session.user.id,
      authorName: session.user.name || 'Anonymous',
      authorAvatar: session.user.photoURL || '',
      targetId,
      targetType,
      parentId: parentId || null,
      level: parentId ? 1 : 0,
      likes: 0,
      
      status: 'active' as const,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLiked: false,
      replies: [],
      replyCount: 0,
      showReplies: false,
      isExpanded: false,
      isOptimistic: true,
      isPending: true
    }

    addOptimisticComment(optimisticComment)
  }

  // Handle optimistic like toggle
  const handleOptimisticLike = (commentId: string, currentLikes: number, isLiked: boolean) => {
    const updatedComments = updateCommentLikes(optimisticComments, commentId, currentLikes, isLiked)
    // Note: This would need a separate optimistic state for likes
    // For now, we'll handle it through the server action
  }

  // Update comment likes in tree
  function updateCommentLikes(
    comments: CommentWithReplies[],
    commentId: string,
    currentLikes: number,
    isLiked: boolean
  ): CommentWithReplies[] {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          optimisticLikes: isLiked ? currentLikes - 1 : currentLikes + 1,
          isLikedOptimistic: !isLiked
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, currentLikes, isLiked)
        }
      }
      return comment
    })
  }

  // Toggle comment expansion
  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) {
        newSet.delete(commentId)
      } else {
        newSet.add(commentId)
      }
      return newSet
    })
  }

  // Handle reply toggle
  const handleReplyToggle = (commentId: string) => {
    setReplyingTo(prev => prev === commentId ? null : commentId)
  }

  // Handle like action
  const handleLike = async (comment: CommentWithReplies) => {
    if (!session?.user) return

    const formData = new FormData()
    formData.append('targetId', comment.id)
    formData.append('targetType', 'comment')
    formData.append('currentlyLiked', comment.isLiked.toString())

    likeAction(formData)
  }

  // Load more comments (infinite scroll)
  const loadMoreComments = useCallback(async () => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/comments?targetId=${targetId}&targetType=${targetType}&limit=${limit}&offset=${optimisticComments.length}`
      )

      if (!response.ok) {
        throw new Error('Failed to load comments')
      }

      const data = await response.json()
      const newComments = buildCommentTree(data.comments)
      
      // Add new comments without affecting optimistic ones
      newComments.forEach(comment => {
        if (!optimisticComments.some(existing => existing.id === comment.id)) {
          addOptimisticComment(comment)
        }
      })

    } catch (error) {
      console.error('Error loading comments:', error)
      setError(t('errorLoadingComments'))
    } finally {
      setLoading(false)
    }
  }, [loading, targetId, targetType, limit, optimisticComments, t, addOptimisticComment])

  // Trigger infinite scroll
  useEffect(() => {
    if (inView && !loading) {
      loadMoreComments()
    }
  }, [inView, loadMoreComments, loading])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('comments')} ({optimisticComments.length})
        </h3>
      </div>

      {/* New Comment Form */}
      {showReplyForm && session && (
        <CommentForm
          targetId={targetId}
          targetType={targetType}
          onCommentPosted={(comment) => handleOptimisticComment(comment)}
          placeholder={t('writeComment')}
        />
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {optimisticComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              maxDepth={maxDepth}
              allowReplies={allowReplies}
              showLikes={showLikes}
              isExpanded={expandedComments.has(comment.id)}
              isReplying={replyingTo === comment.id}
              onToggleExpansion={() => toggleCommentExpansion(comment.id)}
              onToggleReply={() => handleReplyToggle(comment.id)}
              onLike={() => handleLike(comment)}
              onReplyPosted={(replyData) => handleOptimisticComment(replyData, comment.id)}
              targetId={targetId}
              targetType={targetType}
            />
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {optimisticComments.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noComments')}</h3>
            <p className="text-muted-foreground">{t('beFirstToComment')}</p>
          </motion.div>
        )}

        {/* Loading More */}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('loadingMoreComments')}</span>
            </div>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {!loading && optimisticComments.length >= limit && (
          <div ref={ref} className="h-10" />
        )}
      </div>
    </div>
  )
}

// Individual Comment Item Component
interface CommentItemProps {
  comment: CommentWithReplies
  depth: number
  maxDepth: number
  allowReplies: boolean
  showLikes: boolean
  isExpanded: boolean
  isReplying: boolean
  onToggleExpansion: () => void
  onToggleReply: () => void
  onLike: () => void
  onReplyPosted: (replyData: Partial<Comment>) => void
  targetId: string
  targetType: CommentTargetType
}

function CommentItem({
  comment,
  depth,
  maxDepth,
  allowReplies,
  showLikes,
  isExpanded,
  isReplying,
  onToggleExpansion,
  onToggleReply,
  onLike,
  onReplyPosted,
  targetId,
  targetType
}: CommentItemProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()

  const canReply = allowReplies && depth < maxDepth && session
  const hasReplies = comment.replies && comment.replies.length > 0
  const displayLikes = comment.optimisticLikes ?? comment.likes
  const isLiked = comment.isLikedOptimistic ?? comment.isLiked

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: comment.isOptimistic ? 0.7 : 1, 
        y: 0,
        scale: comment.isPending ? 0.98 : 1
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`${depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}
    >
      <Card className={`${
        comment.isOptimistic ? 'border-primary/50 bg-primary/5' : ''
      } ${comment.isPending ? 'border-dashed' : ''}`}>
        <CardContent className="p-4">
          {/* Comment Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar 
                src={comment.authorAvatar} 
                alt={comment.authorName}
                fallback={comment.authorName[0]}
                size="sm"
              />
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comment.authorName}</span>
                  {comment.isOptimistic && (
                    <Badge variant="secondary" className="text-xs">
                      {comment.isPending ? t('posting') : t('posted')}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Comment Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Flag className="h-4 w-4 mr-2" />
                  {t('report')}
                </DropdownMenuItem>
                {session?.user?.id === comment.authorId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Comment Content */}
          <div className="mb-3">
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center gap-4">
            {/* Like Button */}
            {showLikes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLike}
                disabled={!session || comment.isPending}
                className={`h-8 px-2 ${isLiked ? 'text-red-500' : ''}`}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-xs">{displayLikes}</span>
              </Button>
            )}

            {/* Reply Button */}
            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleReply}
                disabled={comment.isPending}
                className="h-8 px-2"
              >
                <Reply className="h-4 w-4 mr-1" />
                <span className="text-xs">{t('reply')}</span>
              </Button>
            )}

            {/* Show Replies Button */}
            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpansion}
                className="h-8 px-2"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 mr-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-1" />
                )}
                <span className="text-xs">
                  {isExpanded ? t('hideReplies') : t('showReplies')} ({comment.replyCount})
                </span>
              </Button>
            )}
          </div>

          {/* Reply Form */}
          <AnimatePresence>
            {isReplying && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <CommentForm
                  targetId={targetId}
                  targetType={targetType}
                  parentId={comment.id}
                  onCommentPosted={onReplyPosted}
                  placeholder={t('writeReply')}
                  compact={true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Nested Replies */}
      <AnimatePresence>
        {hasReplies && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-4"
          >
            {comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                depth={depth + 1}
                maxDepth={maxDepth}
                allowReplies={allowReplies}
                showLikes={showLikes}
                isExpanded={false} // Nested replies start collapsed
                isReplying={false}
                onToggleExpansion={() => {}} // Simplified for nested
                onToggleReply={() => {}}
                onLike={() => {}}
                onReplyPosted={onReplyPosted}
                targetId={targetId}
                targetType={targetType}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
} 