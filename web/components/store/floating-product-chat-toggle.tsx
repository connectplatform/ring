'use client'

/**
 * Floating product-chat toggle (mobile only).
 *
 * Reuses the FAB placement/behavior of the product agent floating button and
 * the visual treatment of the floating profile button (mobile-user-widget):
 * rounded FAB, green "online" presence marker, unread-message counter badge.
 *
 * Badge = server `conversation.unreadCount` SSOT from ProductAgentChatProvider:
 * seeded by the provider bootstrap (works before the chat is ever opened),
 * bumped live by the user tunnel while the chat is closed, cleared via
 * `mark_read` when messages are seen. No client-side timestamp guessing.
 */

import { useTranslations } from 'next-intl'
import { Headset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProductAgentChatContext } from '@/features/store/context/product-agent-chat-context'
import { cn } from '@/lib/utils'

export default function FloatingProductChatToggle() {
  const t = useTranslations('modules.store')
  const { open, setOpen, unreadCount } = useProductAgentChatContext()

  return (
    <div className="fixed right-4 top-[calc(50%+4rem)] z-50 -translate-y-1/2 md:hidden">
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="sm"
        variant="secondary"
        className={cn(
          'relative h-14 w-14 rounded-full border border-primary/50 bg-background/90 p-0',
          'shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-background',
        )}
        aria-label={t('product.agentRailLabel')}
        aria-pressed={open}
        title={t('product.agentRailLabel')}
        data-floating-product-chat-toggle=""
      >
        <Headset className="h-6 w-6 text-primary" />

        {/* Green "online" marker — treatment from the floating profile button */}
        <span
          aria-hidden
          className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background bg-green-500 shadow"
        />

        {/* Unread message counter badge — treatment from the floating profile button */}
        {!open && unreadCount > 0 ? (
          <span
            data-unread-count={unreadCount}
            className="absolute -right-1 -top-1 flex h-[24px] min-w-[24px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>
    </div>
  )
}
