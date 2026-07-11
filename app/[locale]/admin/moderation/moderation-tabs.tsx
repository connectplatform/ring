'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ModerationTab = 'queue' | 'rules' | 'reports' | 'analytics'

export function parseModerationTab(raw: string | null): ModerationTab {
  if (raw === 'rules' || raw === 'reports' || raw === 'analytics') return raw
  return 'queue'
}

interface ModerationTabsProps {
  children: React.ReactNode
}

/** URL-synced tabs for /admin/moderation (?tab=queue|rules|reports|analytics). */
export function ModerationTabs({ children }: ModerationTabsProps) {
  const t = useTranslations('modules.admin')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const activeTab = parseModerationTab(searchParams.get('tab'))

  const setTab = (tab: string) => {
    const next = parseModerationTab(tab)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'queue') {
        params.delete('tab')
      } else {
        params.set('tab', next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setTab}
      className={`space-y-6${isPending ? ' opacity-80' : ''}`}
    >
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="queue">{t('moderationTabQueue')}</TabsTrigger>
        <TabsTrigger value="rules">{t('moderationTabRules')}</TabsTrigger>
        <TabsTrigger value="reports">{t('moderationTabReports')}</TabsTrigger>
        <TabsTrigger value="analytics">{t('moderationTabAnalytics')}</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}
