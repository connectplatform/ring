'use client'

/**
 * Product agent chat shell — mobile toggled panel.
 * Desktop always-on chat lives in ProductDetailsWrapper right-rail (lower 50%).
 */

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, MessageSquare, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductAgentChatPanel } from '@/features/store/components/product-agent-chat-panel'
import {
  useOptionalProductAgentChatContext,
  useProductAgentChatContext,
} from '@/features/store/context/product-agent-chat-context'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

export function ProductAgentChatTopBar({ className }: { className?: string }) {
  const t = useTranslations('modules.store')
  const context = useOptionalProductAgentChatContext()
  if (!context) return null

  const { open, toggle, productName } = context

  return (
    <div
      className={cn(
        'flex-1 overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30',
        // Desktop: chat is always in the right rail — keep a compact status chip only
        'md:pointer-events-none',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 md:cursor-default"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
            <span className="truncate text-sm font-medium">{productName}</span>
            <span className="shrink-0 text-sm font-semibold text-green-600 dark:text-green-400">
              {t('product.agentReady')}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-1 text-sm font-medium text-white md:hidden">
          <MessageSquare className="h-3.5 w-3.5" />
          {open ? t('product.close') : t('product.chat')}
        </div>
        <div className="hidden shrink-0 text-xs text-muted-foreground md:block">
          {t('product.aiSalesAssistant')}
        </div>
      </button>
    </div>
  )
}

/** Mobile-only overlay; desktop chat is embedded in the product right rail. */
export function ProductAgentChatShell({ locale }: { locale: Locale }) {
  const t = useTranslations('modules.store')
  const router = useRouter()
  const { open, setOpen, productId, productName } = useProductAgentChatContext()

  if (!open) return null

  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col border-y bg-background shadow-2xl md:hidden">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{productName}</p>
          <p className="text-xs text-muted-foreground">{t('product.aiSalesAssistant')}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('product.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ProductAgentChatPanel
        productId={productId}
        productName={productName}
        locale={locale}
        showCartSummary
      />
    </div>
  )
}
