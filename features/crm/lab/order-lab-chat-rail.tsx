'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Loader2, MessageSquare, FlaskConical, X } from 'lucide-react'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export {
  EmbeddedConversation,
  LabThread,
} from '@/features/chat/components/embedded-conversation'
export type { EmbeddedConversationVariant } from '@/features/chat/components/embedded-conversation'

import { EmbeddedConversation } from '@/features/chat/components/embedded-conversation'

/**
 * Integrator Order Lab chat rail — single shared Project room (buyer + integrator + Reggie).
 */
export function OrderLabChatRail({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('calculator')
  const { data: session, status } = useSession()
  const [labId, setLabId] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      setBooting(true)
      setBootError(null)
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          labConversationId?: string
          orderLabConversationId?: string
        }>(`/api/my-jobs/${orderId}/chat`)
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to open chats')
        if (data.error) throw new Error(data.error)
        if (!cancelled) {
          setLabId(data.labConversationId || data.orderLabConversationId || null)
        }
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : 'Chat bootstrap failed')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const userId = session?.user?.id

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          {t('order.lab.projectRoom')}
        </div>
        <Button size="icon" type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {status === 'loading' || booting ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        </div>
      ) : bootError ? (
        <p className="p-4 text-sm text-destructive">{bootError}</p>
      ) : !userId ? null : labId ? (
        <EmbeddedConversation conversationId={labId} userId={userId} variant="order_lab" />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">{t('order.lab.noProjectRoom')}</p>
      )}
    </div>
  )

  return (
    <>
      {!open && (
        <button
          aria-label={t('order.lab.chatTitle')}
          className="fixed right-0 top-1/2 z-[55] hidden -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl border border-r-0 bg-background/95 px-2 py-4 shadow-lg backdrop-blur transition-colors hover:bg-accent/40 md:flex"
          type="button"
          onClick={() => onOpenChange(true)}
        >
          <MessageSquare className="h-4 w-4 text-amber-600" />
          <span className="text-[11px] font-medium tracking-wide [writing-mode:vertical-rl] rotate-180">
            {t('order.lab.chatRailLabel')}
          </span>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col border-y bg-background shadow-2xl md:hidden">
            {panel}
          </div>
          <div
            className={cn(
              'fixed inset-y-0 right-0 z-[60] hidden w-[min(420px,100vw)] border-l bg-background shadow-2xl md:flex md:flex-col',
            )}
          >
            {panel}
          </div>
          <button
            aria-label="Close"
            className="fixed inset-0 z-[59] hidden bg-black/20 md:block"
            type="button"
            onClick={() => onOpenChange(false)}
          />
        </>
      )}
    </>
  )
}
