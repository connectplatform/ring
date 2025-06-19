'use client'

import React, { useRef } from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { useSession } from 'next-auth/react'
import { createComment, CommentActionState } from '@/app/actions/comments'
import { Comment, CommentTargetType } from '@/types/comments'

interface CommentFormProps {
  targetId: string
  targetType: CommentTargetType
  parentId?: string
  placeholder?: string
  compact?: boolean
  onCommentPosted?: (comment: Comment) => void
  onCancel?: () => void
  className?: string
}

interface OptimisticComment {
  id: string
  content: string
  authorName: string
  authorAvatar?: string
  createdAt: Date
  isOptimistic: boolean
}

function CommentFormComponent({
  targetId,
  targetType,
  parentId,
  placeholder = "Write a comment...",
  compact = false,
  onCommentPosted,
  onCancel,
  className
}: CommentFormProps) {
  const { data: session } = useSession()
  const { pending } = useFormStatus()
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [optimisticComments, addOptimisticComment] = useOptimistic<OptimisticComment[], OptimisticComment>(
    [],
    (currentComments, newComment) => [...currentComments, newComment]
  )

  const [state, formAction] = useActionState<CommentActionState | null, FormData>(
    createComment,
    null
  )

  const handleSubmit = async (formData: FormData) => {
    const content = formData.get('content') as string
    
    if (!content.trim() || !session?.user) return

    // Create optimistic comment
    const optimisticComment: OptimisticComment = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      authorName: session.user.name || 'You',
      authorAvatar: session.user.photoURL || undefined,
      createdAt: new Date(),
      isOptimistic: true
    }

    // Add optimistic comment immediately
    addOptimisticComment(optimisticComment)

    // Clear form
    if (textareaRef.current) {
      textareaRef.current.value = ''
    }

    // Submit to server
    formAction(formData)
  }

  // Handle server action result through state
  React.useEffect(() => {
    if (state?.success && state.comment && onCommentPosted) {
      onCommentPosted(state.comment)
    }
  }, [state, onCommentPosted])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const handleCancel = () => {
    if (textareaRef.current) {
      textareaRef.current.value = ''
    }
    onCancel?.()
  }

  if (!session?.user) {
    return (
      <Card className={`${className} border-dashed`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            <span>Please sign in to comment</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Optimistic Comments Display */}
      <AnimatePresence>
        {optimisticComments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.7, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-3 bg-muted/30 rounded-lg border-l-4 border-primary/30"
          >
            <div className="flex items-start gap-3">
              <Avatar 
                src={comment.authorAvatar} 
                alt={comment.authorName}
                fallback={comment.authorName[0]}
                size="sm"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{comment.authorName}</span>
                  <span className="text-xs text-muted-foreground">Posting...</span>
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Comment Form */}
      <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <input type="hidden" name="targetId" value={targetId} />
            <input type="hidden" name="targetType" value={targetType} />
            {parentId && <input type="hidden" name="parentId" value={parentId} />}
            
            <div className="flex gap-3">
              <Avatar 
                src={session.user.photoURL || undefined}
                alt={session.user.name || 'User'}
                fallback={session.user.name?.[0] || 'U'}
                size={compact ? "sm" : "md"}
              />
              
              <div className="flex-1 space-y-3">
                <Textarea
                  ref={textareaRef}
                  name="content"
                  placeholder={placeholder}
                  className={`min-h-[80px] resize-none border-0 shadow-none focus-visible:ring-1 ${
                    compact ? 'text-sm' : ''
                  }`}
                  onKeyDown={handleKeyDown}
                  maxLength={2000}
                  required
                />
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Press Ctrl+Enter to post
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {onCancel && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        disabled={pending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    
                    <Button
                      type="submit"
                      size="sm"
                      disabled={pending}
                      className="min-w-[80px]"
                    >
                      {pending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          {parentId ? 'Reply' : 'Comment'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Error display */}
          <AnimatePresence>
            {state?.error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <p className="text-sm text-destructive">{state.error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success message */}
          <AnimatePresence>
            {state?.success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md"
              >
                <p className="text-sm text-green-700">{state.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CommentForm(props: CommentFormProps) {
  return <CommentFormComponent {...props} />
}

// Convenience exports for different target types
export function NewsCommentForm(props: Omit<CommentFormProps, 'targetType'>) {
  return <CommentForm {...props} targetType="news" />
}

export function EntityCommentForm(props: Omit<CommentFormProps, 'targetType'>) {
  return <CommentForm {...props} targetType="entity" />
}

export function OpportunityCommentForm(props: Omit<CommentFormProps, 'targetType'>) {
  return <CommentForm {...props} targetType="opportunity" />
} 