'use client'

/**
 * Product agent chat shell — mobile overlay when chat context is open.
 * Always-on chat lives in ProductDetailsWrapper right-rail (all viewports).
 */

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductAgentChatPanel } from '@/features/store/components/product-agent-chat-panel'
import { useProductAgentChatContext } from '@/features/store/context/product-agent-chat-context'
import type { Locale } from '@/i18n/shared'

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
