'use client'

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import type { OpportunitySubmenuCounts } from '@/features/opportunities/types'
import { SerializedOpportunity } from '@/features/opportunities/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { deleteOpportunity } from '@/app/_actions/opportunities'
import Link from 'next/link'
import { Plus, Briefcase, Archive, Clock, FileText, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import OpportunitiesBrowseRail from '@/components/opportunities/opportunities-browse-rail'
import {
  type MyOpportunitiesCounts,
  type MyOpportunitiesView,
  canOwnerDeleteOpportunity,
  isDraftBucket,
} from '@/features/opportunities/lib/lifecycle-status'

interface MyOpportunitiesWrapperProps {
  locale: Locale
  initialOpportunities: SerializedOpportunity[]
  initialError: string | null
  lastVisible: string | null
  initialLimit: number
  initialView?: MyOpportunitiesView
  counts: OpportunitySubmenuCounts
  lifecycleCounts: MyOpportunitiesCounts
}

const LIFECYCLE_TABS: MyOpportunitiesView[] = ['all', 'drafts', 'pending', 'active']

export default function MyOpportunitiesWrapper({
  locale,
  initialOpportunities,
  initialError,
  initialView = 'all',
  lifecycleCounts,
}: MyOpportunitiesWrapperProps) {
  const t = useTranslations('modules.opportunities')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [, startTransition] = useTransition()
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const [view, setView] = useState<MyOpportunitiesView>(initialView)

  const isArchiveView = view === 'archived'
  const tabValue = isArchiveView ? 'all' : view

  const urlSearch = searchParams.get('q') || ''
  const urlTypesKey = searchParams.get('types') ?? ''
  const urlCategoriesKey = searchParams.get('categories') ?? ''

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  const filteredOpportunities = useMemo(() => {
    let filtered = [...initialOpportunities]
    const urlTypes = urlTypesKey.split(',').filter(Boolean)
    const urlCategories = urlCategoriesKey.split(',').filter(Boolean)

    if (urlSearch) {
      const query = urlSearch.toLowerCase()
      filtered = filtered.filter(
        (opp) =>
          opp.title.toLowerCase().includes(query) ||
          opp.briefDescription.toLowerCase().includes(query) ||
          opp.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    if (urlTypes.length > 0) {
      filtered = filtered.filter((opp) => urlTypes.includes(opp.type))
    }

    if (urlCategories.length > 0) {
      filtered = filtered.filter((opp) => urlCategories.includes(opp.category))
    }

    return filtered
  }, [initialOpportunities, urlSearch, urlTypesKey, urlCategoriesKey])

  const pushView = useCallback(
    (nextView: MyOpportunitiesView) => {
      startTransition(() => setView(nextView))
      const url = new URL(window.location.href)
      url.searchParams.set('view', nextView)
      url.searchParams.delete('filter')
      url.searchParams.delete('tab')
      router.push(url.pathname + url.search)
    },
    [router, startTransition],
  )

  const handleTabChange = useCallback(
    (value: string) => {
      pushView(value as MyOpportunitiesView)
    },
    [pushView],
  )

  const handleArchiveToggle = useCallback(() => {
    pushView(isArchiveView ? 'all' : 'archived')
  }, [isArchiveView, pushView])

  const handleDelete = async (opportunity: SerializedOpportunity) => {
    if (!canOwnerDeleteOpportunity(opportunity.status)) {
      alert(
        t('deleteArchivedOnly', {
          defaultValue: 'Only archived opportunities can be deleted. Archive the listing first.',
        }),
      )
      return
    }

    if (
      !confirm(
        t('confirmDeleteArchived', {
          defaultValue: `Permanently delete archived opportunity "${opportunity.title}"?`,
          title: opportunity.title,
        }),
      )
    ) {
      return
    }

    const formData = new FormData()
    formData.append('opportunityId', opportunity.id)

    const result = await deleteOpportunity(null, formData, locale)

    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || t('deleteFailed', { defaultValue: 'Failed to delete opportunity' }))
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-500 text-white'
    if (status === 'pending') return 'bg-amber-500 text-white'
    if (status === 'archived') return 'bg-slate-500 text-white'
    if (isDraftBucket(status)) return 'bg-gray-500 text-white'
    return 'bg-gray-300 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return t('pending', { defaultValue: 'Pending' })
    if (status === 'active') return t('active', { defaultValue: 'Active' })
    if (status === 'archived') return t('archived', { defaultValue: 'Archived' })
    if (isDraftBucket(status)) return t('draft', { defaultValue: 'Draft' })
    return status
  }

  const getTypeColor = (type: string) => {
    const requestTypes = ['request', 'ring_customization']
    return requestTypes.includes(type) ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
  }

  const countForTab = (tab: MyOpportunitiesView) => {
    switch (tab) {
      case 'all':
        return lifecycleCounts.all
      case 'drafts':
        return lifecycleCounts.drafts
      case 'pending':
        return lifecycleCounts.pending
      case 'active':
        return lifecycleCounts.active
      case 'archived':
        return lifecycleCounts.archived
      default:
        return 0
    }
  }

  const isOwner = (opportunity: SerializedOpportunity) =>
    opportunity.createdBy === session?.user?.id

  const content = (
    <DavinciCenterPane>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('myOpportunities')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('myOpportunitiesDescription', {
            defaultValue: 'Manage drafts, pending review, active listings, and archive',
          })}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              { key: 'all', label: t('all'), icon: Briefcase },
              { key: 'drafts', label: t('draftOpportunities', { defaultValue: 'Drafts' }), icon: FileText },
              { key: 'pending', label: t('pendingOpportunities', { defaultValue: 'Pending' }), icon: Clock },
              { key: 'active', label: t('activeOpportunities', { defaultValue: 'Active' }), icon: Briefcase },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="rounded-xl border border-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)] bg-[color-mix(in_oklch,var(--davinci-surface-bg)_55%,transparent)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{countForTab(key)}</p>
                </div>
                <Icon className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {initialError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <p>{initialError}</p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-4">
        {!isArchiveView ? (
          <Tabs value={tabValue} onValueChange={handleTabChange} className="flex-1">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              {LIFECYCLE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="flex items-center gap-1.5">
                  <span>
                    {tab === 'all' && t('all')}
                    {tab === 'drafts' && t('draftOpportunities', { defaultValue: 'Drafts' })}
                    {tab === 'pending' && t('pending')}
                    {tab === 'active' && t('active')}
                  </span>
                  {countForTab(tab) > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-xs">
                      {countForTab(tab)}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Archive className="h-4 w-4" />
            {t('archivedOpportunities', { defaultValue: 'Archived' })}
            {lifecycleCounts.archived > 0 && (
              <Badge variant="secondary">{lifecycleCounts.archived}</Badge>
            )}
          </div>
        )}

        <Button
          type="button"
          variant={isArchiveView ? 'default' : 'outline'}
          size="icon"
          aria-pressed={isArchiveView}
          aria-label={t('archiveView', { defaultValue: 'Show archived opportunities' })}
          title={t('archiveView', { defaultValue: 'Show archived opportunities' })}
          onClick={handleArchiveToggle}
        >
          <Archive className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={tabValue} className="mb-6">
        <TabsContent value={tabValue} className="mt-0">
          {filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">
                  {isArchiveView
                    ? t('noArchivedOpportunities', { defaultValue: 'No archived opportunities' })
                    : initialOpportunities.length === 0
                      ? t('myOpportunitiesEmpty', { defaultValue: 'No opportunities yet' })
                      : t('noOpportunities')}
                </h3>
                {!isArchiveView && initialOpportunities.length === 0 && (
                  <Link href={ROUTES.ADD_OPPORTUNITY(locale)} className="mt-4 inline-block">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('createFirstOpportunity', { defaultValue: 'Create Opportunity' })}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOpportunities.map((opportunity) => {
                const showDelete =
                  isOwner(opportunity) && canOwnerDeleteOpportunity(opportunity.status)

                return (
                  <Card key={opportunity.id} className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{opportunity.title}</CardTitle>
                          <CardDescription className="mt-2">
                            {opportunity.briefDescription}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getStatusColor(opportunity.status)}>
                            {getStatusLabel(opportunity.status)}
                          </Badge>
                          <Badge className={getTypeColor(opportunity.type)}>
                            {opportunity.type}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{new Date(opportunity.dateCreated).toLocaleDateString(locale)}</span>
                          <span>•</span>
                          <span>{new Date(opportunity.expirationDate).toLocaleDateString(locale)}</span>
                        </div>
                        <div className="flex gap-2">
                          {!isArchiveView && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={ROUTES.OPPORTUNITY_EDIT(opportunity.id, locale)}>
                                <Pencil className="mr-1 h-4 w-4" />
                                {t('status.actions.continueEditing', { defaultValue: 'Edit' })}
                              </Link>
                            </Button>
                          )}
                          {showDelete && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(opportunity)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              {t('delete', { defaultValue: 'Delete' })}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DavinciCenterPane>
  )

  return (
    <RingRightRailLayout
      showRightRail
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={
        <OpportunitiesBrowseRail
          locale={locale}
          onNavigate={() => setRightSidebarOpen(false)}
        />
      }
    >
      {content}
    </RingRightRailLayout>
  )
}
