'use client'

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
        'flex-1 border rounded-lg bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 overflow-hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
            <span className="font-medium text-sm truncate">{productName}</span>
            <span className="text-green-600 dark:text-green-400 font-semibold text-sm shrink-0">
              {t('product.agentReady')}
            </span>
          </div>
        </div>
        <div className="px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium rounded-md flex items-center gap-2 shrink-0">
          <MessageSquare className="w-3.5 h-3.5" />
          {open ? t('product.close') : t('product.chat')}
        </div>
      </button>
    </div>
  )
}

export function ProductAgentChatShell({ locale }: { locale: Locale }) {
  const t = useTranslations('modules.store')
  const router = useRouter()
  const { open, setOpen, productId, productName } = useProductAgentChatContext()

  return (
    <>
      {/* Desktop / iPad: collapsed vertical rail (Cursor docs-style) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-[55] flex-col items-center gap-2 rounded-l-xl border border-r-0 bg-background/95 backdrop-blur px-2 py-4 shadow-lg hover:bg-accent/40 transition-colors"
          aria-label={t('product.chat')}
        >
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-[11px] font-medium [writing-mode:vertical-rl] rotate-180 tracking-wide">
            {t('product.agentRailLabel')}
          </span>
        </button>
      )}

      {/* Mobile: full-width panel below top bar */}
      {open && (
        <div className="md:hidden fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[60] bg-background border-y shadow-2xl flex flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
            <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{productName}</p>
              <p className="text-xs text-muted-foreground">{t('product.aiSalesAssistant')}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('product.close')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ProductAgentChatPanel productId={productId} productName={productName} locale={locale} />
        </div>
      )}

      {/* Desktop / iPad overlay above product right rail */}
      {open && (
        <>
          <div
            className="hidden md:block fixed inset-0 z-[58] bg-black/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div className="hidden md:flex fixed inset-y-0 right-0 z-[60] w-[min(420px,calc(100vw-2rem))] flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{productName}</p>
                <p className="text-xs text-muted-foreground">{t('product.aiSalesAssistant')}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('product.close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ProductAgentChatPanel productId={productId} productName={productName} locale={locale} />
          </div>
        </>
      )}
    </>
  )
}
