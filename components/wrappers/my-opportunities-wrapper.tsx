'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import type { OpportunitySubmenuCounts } from '@/features/opportunities/types'
import { SerializedOpportunity } from '@/features/opportunities/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { deleteOpportunity } from '@/app/_actions/opportunities'
import Link from 'next/link'
import {
  Plus,
  Briefcase,
  Filter as FilterIcon,
  Search,
  Pencil,
  Trash2,
  Archive,
  Clock,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  const { data: session } = useSession()
  const [, startTransition] = useTransition()

  const [view, setView] = useState<MyOpportunitiesView>(initialView)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [filteredOpportunities, setFilteredOpportunities] =
    useState<SerializedOpportunity[]>(initialOpportunities)

  const isArchiveView = view === 'archived'
  const tabValue = isArchiveView ? 'all' : view

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    let filtered = [...initialOpportunities]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (opp) =>
          opp.title.toLowerCase().includes(query) ||
          opp.briefDescription.toLowerCase().includes(query) ||
          opp.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((opp) => opp.type === typeFilter)
    }

    setFilteredOpportunities(filtered)
  }, [initialOpportunities, searchQuery, typeFilter])

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
    return requestTypes.includes(type)
      ? 'bg-blue-500 text-white'
      : 'bg-purple-500 text-white'
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

  return (
    <div className="ring-content-panel min-w-0 min-h-full">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('myOpportunities', { defaultValue: 'My Opportunities' })}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('myOpportunitiesDescription', {
                defaultValue: 'Manage drafts, pending review, active listings, and archive',
              })}
            </p>
          </div>

          <div className="flex gap-3">
            <Link href={ROUTES.ADD_OPPORTUNITY(locale)}>
              <Button className="flex items-center gap-2">
                <Plus size={20} />
                {t('createNew', { defaultValue: 'Create New' })}
              </Button>
            </Link>
            <Link href={ROUTES.OPPORTUNITIES(locale)}>
              <Button variant="outline" className="flex items-center gap-2">
                <Briefcase size={20} />
                {t('viewAll', { defaultValue: 'View All' })}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {(
            [
              { key: 'all', label: t('all', { defaultValue: 'All' }), icon: Briefcase },
              { key: 'drafts', label: t('draftOpportunities', { defaultValue: 'Drafts' }), icon: FileText },
              { key: 'pending', label: t('pendingOpportunities', { defaultValue: 'Pending' }), icon: Clock },
              { key: 'active', label: t('activeOpportunities', { defaultValue: 'Active' }), icon: Briefcase },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <div key={key} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-foreground">{countForTab(key)}</p>
                </div>
                <Icon className="text-primary" size={28} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {initialError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{initialError}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            {t('search', { defaultValue: 'Search' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('searchOpportunities', { defaultValue: 'Search opportunities...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('allTypes', { defaultValue: 'All Types' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes', { defaultValue: 'All Types' })}</SelectItem>
                <SelectItem value="request">{t('request', { defaultValue: 'Request' })}</SelectItem>
                <SelectItem value="offer">{t('offer', { defaultValue: 'Offer' })}</SelectItem>
                <SelectItem value="ring_customization">
                  {t('ring_customization', { defaultValue: 'Ring Customization' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 mb-4">
        {!isArchiveView ? (
          <Tabs value={tabValue} onValueChange={handleTabChange} className="flex-1">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              {LIFECYCLE_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="flex items-center gap-1.5">
                  <span>
                    {tab === 'all' && t('all', { defaultValue: 'All' })}
                    {tab === 'drafts' && t('draftOpportunities', { defaultValue: 'Drafts' })}
                    {tab === 'pending' && t('pending', { defaultValue: 'Pending' })}
                    {tab === 'active' && t('active', { defaultValue: 'Active' })}
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
              <CardContent className="text-center py-12">
                <Briefcase className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {isArchiveView
                    ? t('noArchivedOpportunities', { defaultValue: 'No archived opportunities' })
                    : initialOpportunities.length === 0
                      ? t('myOpportunitiesEmpty', { defaultValue: 'No opportunities yet' })
                      : t('noOpportunities', { defaultValue: 'No opportunities match your filters' })}
                </h3>
                {!isArchiveView && initialOpportunities.length === 0 && (
                  <Link href={ROUTES.ADD_OPPORTUNITY(locale)} className="inline-block mt-4">
                    <Button>
                      <Plus className="mr-2" size={20} />
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
                  <Card key={opportunity.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
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
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>
                            {new Date(opportunity.dateCreated).toLocaleDateString(locale)}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(opportunity.expirationDate).toLocaleDateString(locale)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {!isArchiveView && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`${ROUTES.OPPORTUNITY(opportunity.id, locale)}/edit`}>
                                <Pencil className="h-4 w-4 mr-1" />
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
                              <Trash2 className="h-4 w-4 mr-1" />
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
    </div>
  )
}
