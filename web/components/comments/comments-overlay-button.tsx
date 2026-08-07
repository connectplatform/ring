'use client'

import { useState, useCallback, useEffect } from 'react'
import { MessageCircle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RingCenterPaneOverlay } from '@/components/layout/ring-center-pane-overlay'
import CommentList from '@/features/comments/components/comment-list'
import CommentForm from '@/features/comments/components/comment-form'
import { useTunnel } from '@/hooks/use-tunnel'
import type { Comment, CommentTargetType } from '@/features/comments/types'
import type { TunnelMessage } from '@/lib/tunnel/types'

interface CommentsOverlayButtonProps {
  targetId: string
  targetType: CommentTargetType
  initialCount?: number
  buttonLabel?: string
  className?: string
}

export function CommentsOverlayButton({
  targetId,
  targetType,
  initialCount = 0,
  buttonLabel,
  className,
}: CommentsOverlayButtonProps) {
  // Whether the comments overlay panel is open/visible
  const [open, setOpen] = useState(false)
  // The current list of comments loaded and shown in overlay
  const [comments, setComments] = useState<Comment[]>([])
  // Loading state while fetching comments
  const [loading, setLoading] = useState(false)
  // Holds error message if fetching comments fails
  const [error, setError] = useState<string | null>(null)
  // Count of total comments, used for badge, may get out-of-sync with actual list if comment:created/deleted from other clients
  const [count, setCount] = useState(initialCount)

  // Handles when the button is clicked and overlay opens.
  // Only fetches if not already loaded.
  const handleOpen = useCallback(async () => {
    setOpen(true)
    if (comments.length > 0) return // No need to re-fetch if already have comments

    setLoading(true)
    setError(null)

    try {
      // Fetch most recent 20 comments for this target from API
      const res = await fetch(
        `/api/comments?targetId=${encodeURIComponent(targetId)}&targetType=${encodeURIComponent(targetType)}&limit=20&sortBy=createdAt&sortOrder=desc`,
      )
      if (!res.ok) throw new Error('Failed to load comments')
      const data = await res.json()
      setComments(data.data ?? [])
    } catch (e) {
      // Catch and display any errors from network/API
      setError(e instanceof Error ? e.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [targetId, targetType, comments.length])

  // Handles closing the overlay
  const handleClose = useCallback(async () => {
    setOpen(false)
  }, [])

  // Tunnel channel for this comment target (used for "live" updates)
  const tunnelChannel = open ? `comments:${targetType}:${targetId}` : null
  // Only subscribe when overlay is open to save resources
  const { subscribe } = useTunnel({ autoConnect: false })

  useEffect(() => {
    if (!tunnelChannel) return

    // Subscribe to tunnel for real-time updates (created/deleted/updated comments)
    const unsub = subscribe(tunnelChannel, (message: TunnelMessage) => {
      if (message.event === 'comment:created') {
        const comment = message.payload?.comment as Comment | undefined
        if (!comment) return
        setComments((prev) =>
          prev.some((c) => c.id === comment.id) ? prev : [comment, ...prev],
        )
        setCount((c) => c + 1) // optimistic update; may drift if deleted elsewhere
      }

      if (message.event === 'comment:deleted') {
        const commentId = message.payload?.commentId as string | undefined
        if (!commentId) return
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        setCount((c) => Math.max(0, c - 1))
      }

      if (message.event === 'comment:updated') {
        const updated = message.payload?.comment as Comment | undefined
        if (!updated) return
        setComments((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
        )
      }
    })

    // Clean up subscription on close/unmount
    return () => {
      unsub()
    }
  }, [tunnelChannel, subscribe])

  // TODO: Consider using React 19 Server Actions for fetching initial comments on open,
  // or Next 16's useOptimistic/useActionState for more robust optimistic UI on comment creation.

  return (
    <>
      {/* Button to open comments overlay. Shows icon + count/label. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={`gap-1.5 ${className ?? ''}`}
        aria-label={`Comments (${count})`}
      >
        <MessageCircle className="h-4 w-4" />
        {/* Use custom label if provided, or fallback to count */}
        <span className="text-xs">{buttonLabel ?? `${count} comments`}</span>
      </Button>

      {/* Overlay panel containing comments list and form */}
      <RingCenterPaneOverlay open={open} onClose={handleClose} ariaLabel="Comments">
        <div className="flex flex-col h-full">
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comments
            </h2>
            {/* Close button */}
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close comments">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Comments list: shows loader, error or the list itself */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              // Spinner/loader while loading
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              // Error message if failed to load comments
              <p className="text-sm text-destructive text-center py-8">{error}</p>
            ) : (
              // Comment list component, passing down list and config
              <CommentList
                targetId={targetId}
                targetType={targetType}
                initialComments={comments}
                initialError={null}
                limit={20}
                allowReplies
                showLikes
                showReplyForm={false}
              />
            )}
          </div>

          {/* Form for posting a new comment */}
          <div className="shrink-0 border-t px-6 py-4">
            <CommentForm
              targetId={targetId}
              targetType={targetType}
              placeholder="Write a comment..."
              onCommentPosted={(comment) => {
                // Optimistically add new comment to list and increment count
                setComments((prev) => [comment, ...prev])
                setCount((c) => c + 1)
                // TODO: Use useOptimistic (React 19) or useActionState for better UX and server sync,
                // especially to avoid race conditions/duplicates.
              }}
            />
          </div>
        </div>
      </RingCenterPaneOverlay>
    </>
  )
}
