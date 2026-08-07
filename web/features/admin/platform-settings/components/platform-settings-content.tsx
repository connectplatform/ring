'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import {
  DEFAULT_SECTION_ICONS,
  SettingsSectionNav,
  type PlatformSettingsSection,
} from '@/features/admin/platform-settings/components/settings-section-nav'
import { AISettingsSection } from '@/features/admin/platform-settings/components/sections/ai-settings-section'
import { BrandingSettingsSection } from '@/features/admin/platform-settings/components/sections/branding-settings-section'
import type { PlatformAISettingsView, PlatformBrandingData } from '@/features/admin/platform-settings/types'
import type {
  PlatformSettingsActionState,
  TestConnectionResult,
} from '@/app/_actions/platform-settings'

type PlatformSettingsContentProps = {
  ai: PlatformAISettingsView
  branding: PlatformBrandingData
  updateAIAction: (
    prev: PlatformSettingsActionState | null,
    formData: FormData,
  ) => Promise<PlatformSettingsActionState>
  updateBrandingAction: (
    prev: PlatformSettingsActionState | null,
    formData: FormData,
  ) => Promise<PlatformSettingsActionState>
  testConnectionAction: () => Promise<TestConnectionResult>
}

export function PlatformSettingsContent({
  ai,
  branding,
  updateAIAction,
  updateBrandingAction,
  testConnectionAction,
}: PlatformSettingsContentProps) {
  const t = useTranslations('modules.admin.settings')
  const [activeSection, setActiveSection] = useState<PlatformSettingsSection>('ai')
  const [navOpen, setNavOpen] = useState(false)

  const menuItems = useMemo(
    () => [
      { id: 'ai' as const, label: t('sections.ai.nav'), icon: DEFAULT_SECTION_ICONS.ai },
      { id: 'branding' as const, label: t('sections.branding.nav'), icon: DEFAULT_SECTION_ICONS.branding },
    ],
    [t],
  )

  const handleSelect = (section: PlatformSettingsSection) => {
    setActiveSection(section)
    setNavOpen(false)
  }

  const nav = (
    <SettingsSectionNav
      items={menuItems}
      activeSection={activeSection}
      onSelect={handleSelect}
      title={t('navTitle')}
    />
  )

  return (
    <div className="min-h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex min-h-full gap-3">
        <div className="ring-content-panel flex-1 min-w-0 pb-24 lg:pb-8">
          {activeSection === 'ai' && (
            <AISettingsSection
              initial={ai}
              updateAction={updateAIAction}
              testConnectionAction={testConnectionAction}
            />
          )}
          {activeSection === 'branding' && (
            <BrandingSettingsSection initial={branding} updateAction={updateBrandingAction} />
          )}
        </div>

        <div className="hidden lg:block w-[240px] shrink-0">
          <div className="sticky top-8">{nav}</div>
        </div>
      </div>

      <FloatingSidebarToggle
        isOpen={navOpen}
        onToggle={setNavOpen}
        mobileWidth="85%"
        tabletWidth="320px"
        showControls={false}
      >
        {nav}
      </FloatingSidebarToggle>
    </div>
  )
}
