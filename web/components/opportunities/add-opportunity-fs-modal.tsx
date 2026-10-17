'use client'

import { FsModal } from '@/components/ui/fs-modal'
import { OpportunityTypeSelectorClient } from '@/components/opportunities/opportunity-type-selector-client'
import { HeroAmbient } from '@/lib/ui/davinci'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'

type AddOpportunityFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole: 'member' | 'subscriber'
  locale: Locale
}

/**
 * Shared create-opportunity type picker for every viewport.
 * FsModal chrome (title, close); body-only selector tiles (no inner header).
 */
export function AddOpportunityFsModal({
  open,
  onOpenChange,
  userRole,
  locale,
}: AddOpportunityFsModalProps) {
  const tOpp = useTranslations('modules.opportunities')

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={tOpp('type_selector.title')}
      description={tOpp('type_selector.subtitle')}
      layout="centerPane"
      hideHeaderSeparator
      chromeBackdrop={<HeroAmbient className="opacity-100" />}
      headerClassName="bg-transparent px-3"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden !bg-transparent !p-0"
      pinAboveMobileNav
    >
      <OpportunityTypeSelectorClient
        layout="body"
        onClose={() => onOpenChange(false)}
        userRole={userRole}
        locale={locale}
      />
    </FsModal>
  )
}
