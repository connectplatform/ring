'use client'

import React from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion } from 'framer-motion'
import { Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { toggleLike, LikeActionState } from '@/app/actions/likes'

interface LikeButtonProps {
  targetId: string
  targetType: 'entity' | 'opportunity' | 'comment' | 'news'
  initialLikeCount: number
  initialIsLiked: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'outline'
  showCount?: boolean
  className?: string
}

interface LikeState {
  count: number
  isLiked: boolean
}

function LikeButtonComponent({ 
  targetId, 
  targetType, 
  initialLikeCount, 
  initialIsLiked,
  size = 'md',
  variant = 'ghost',
  showCount = true,
  className 
}: LikeButtonProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { pending } = useFormStatus()

  const initialState: LikeState = {
    count: initialLikeCount,
    isLiked: initialIsLiked
  }

  // Optimistic updates for instant like feedback
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    initialState,
    (currentState: LikeState, action: 'toggle') => ({
      count: currentState.isLiked 
        ? currentState.count - 1 
        : currentState.count + 1,
      isLiked: !currentState.isLiked
    })
  )

  const [state, formAction] = useActionState<LikeActionState | null, FormData>(
    toggleLike,
    null
  )

  const handleLike = async (formData: FormData) => {
    if (!session?.user) return

    // Optimistic update - change UI immediately
    addOptimisticLike('toggle')

    // Send to server
    await formAction(formData)
  }

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-base'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  if (!session?.user) {
    return (
      <Button
        variant={variant}
        size="sm"
        disabled
        className={`${sizeClasses[size]} ${className}`}
      >
        <Heart className={`${iconSizes[size]} mr-1`} />
        {showCount && <span>{optimisticLikes.count}</span>}
      </Button>
    )
  }

  return (
    <form action={handleLike}>
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="currentlyLiked" value={optimisticLikes.isLiked.toString()} />
      
      <Button
        type="submit"
        variant={variant}
        size="sm"
        disabled={pending}
        className={`${sizeClasses[size]} ${className} transition-all duration-200`}
      >
        {pending ? (
          <Loader2 className={`${iconSizes[size]} animate-spin mr-1`} />
        ) : (
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center"
          >
            <Heart 
              className={`${iconSizes[size]} mr-1 transition-colors duration-200 ${
                optimisticLikes.isLiked 
                  ? 'fill-red-500 text-red-500' 
                  : 'text-muted-foreground hover:text-red-500'
              }`}
            />
          </motion.div>
        )}
        
        {showCount && (
          <motion.span
            key={optimisticLikes.count}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`${
              optimisticLikes.isLiked ? 'text-red-500' : 'text-muted-foreground'
            }`}
          >
            {optimisticLikes.count}
          </motion.span>
        )}
      </Button>

      {/* Error display */}
      {state?.error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-destructive mt-1"
        >
          {state.error}
        </motion.p>
      )}
    </form>
  )
}

export default function LikeButton(props: LikeButtonProps) {
  return <LikeButtonComponent {...props} />
}

// Convenience exports for different use cases
export function EntityLikeButton(props: Omit<LikeButtonProps, 'targetType'>) {
  return <LikeButton {...props} targetType="entity" />
}

export function OpportunityLikeButton(props: Omit<LikeButtonProps, 'targetType'>) {
  return <LikeButton {...props} targetType="opportunity" />
}

export function CommentLikeButton(props: Omit<LikeButtonProps, 'targetType'>) {
  return <LikeButton {...props} targetType="comment" size="sm" showCount={false} />
}

export function NewsLikeButton(props: Omit<LikeButtonProps, 'targetType'>) {
  return <LikeButton {...props} targetType="news" />
} 