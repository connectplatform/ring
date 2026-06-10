'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { useConversations, useConversation } from '@/hooks/use-messaging'
import { ConversationHeader } from '@/features/chat/components/conversation-header'
import { MessageThread } from '@/features/chat/components/message-thread'
import { cn } from '@/lib/utils'

interface EntityConversationPanelProps {
  entityId: string
  entityName: string
  entityCreatorId: string
  className?: string
}

export function EntityConversationPanel({
  entityId,
  entityName,
  entityCreatorId,
  className,
}: EntityConversationPanelProps) {
  const t = useTranslations('modules.messenger')
  const { data: session, status } = useSession()
  const filters = useMemo(
    () => ({ type: 'entity' as const, entityId, isActive: true }),
    [entityId],
  )
  const inbox = useConversations(filters)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const { conversation } = useConversation(conversationId || '', { enabled: !!conversationId })

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setBootstrapping(false)
      return
    }
    if (inbox.loading) return

    let cancelled = false

    const bootstrap = async () => {
      const existing = inbox.conversations.find((c) => c.metadata.entityId === entityId)
      if (existing) {
        if (!cancelled) {
          setConversationId(existing.id)
          setBootstrapping(false)
        }
        return
      }

      if (session.user.id !== entityCreatorId && entityCreatorId) {
        const created = await inbox.createConversation({
          type: 'entity',
          participantIds: [session.user.id, entityCreatorId],
          metadata: { entityId, entityName },
        })
        if (!cancelled && created) {
          setConversationId(created.id)
        }
      }

      if (!cancelled) {
        setBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [
    status,
    session?.user?.id,
    inbox.loading,
    inbox.conversations,
    inbox.createConversation,
    entityId,
    entityName,
    entityCreatorId,
  ])

  if (status === 'loading' || bootstrapping || inbox.loading) {
    return (
      <div className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
        {t('loadingChat')}
      </div>
    )
  }

  if (!session?.user?.id) {
    return null
  }

  if (!conversationId || !conversation) {
    return (
      <div className={cn('p-6 text-sm text-muted-foreground text-center', className)}>
        {t('entityChatEmpty')}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-[600px] border rounded-lg bg-card overflow-hidden', className)}>
      <ConversationHeader conversation={conversation} currentUserId={session.user.id} />
      <MessageThread
        conversationId={conversationId}
        userId={session.user.id}
        conversation={conversation}
        className="flex-1 min-h-0"
      />
    </div>
  )
}

export default EntityConversationPanel
