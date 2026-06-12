'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import type { SerializedEntity } from '@/features/entities/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import Link from 'next/link'
import { Plus, Building2, Search, Pencil, Trash2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MyEntitiesCounts, MyEntitiesView } from '@/features/entities/lib/my-entities-views'

interface MyEntitiesWrapperProps {
  locale: Locale
  initialEntities: SerializedEntity[]
  initialError: string | null
  lastVisible: string | null
  initialLimit: number
  initialView?: MyEntitiesView
  counts: MyEntitiesCounts
}

const VIEW_TABS: MyEntitiesView[] = ['all', 'store', 'member']

export default function MyEntitiesWrapper({
  locale,
  initialEntities,
  initialError,
  initialView = 'all',
  counts,
}: MyEntitiesWrapperProps) {
  const t = useTranslations('modules.entities')
  const router = useRouter()
  const { data: session } = useSession()
  const [, startTransition] = useTransition()

  const [view, setView] = useState<MyEntitiesView>(initialView)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredEntities, setFilteredEntities] = useState<SerializedEntity[]>(initialEntities)

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    let filtered = [...initialEntities]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (entity) =>
          entity.name.toLowerCase().includes(q) ||
          entity.shortDescription?.toLowerCase().includes(q) ||
          entity.location?.toLowerCase().includes(q),
      )
    }
    setFilteredEntities(filtered)
  }, [initialEntities, searchQuery])

  const pushView = useCallback(
    (nextView: MyEntitiesView) => {
      startTransition(() => setView(nextView))
      const url = new URL(window.location.href)
      url.searchParams.set('view', nextView)
      router.push(url.pathname + url.search)
    },
    [router, startTransition],
  )

  const tabCount = (tab: MyEntitiesView) => {
    if (tab === 'store') return counts.store
    if (tab === 'member') return counts.member
    return counts.all
  }

  if (initialError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6 text-destructive">{initialError}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('myEntities')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('myEntitiesDescription', {
              defaultValue: 'Organizations and profiles you manage on Ring.',
            })}
          </p>
        </div>
        <Button asChild>
          <Link href={ROUTES.ADD_ENTITY(locale)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addMyEntity')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchEntities')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => pushView(v as MyEntitiesView)}>
        <TabsList>
          {VIEW_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === 'all' && t('myEntitiesTabAll', { defaultValue: 'Owned' })}
              {tab === 'store' && (
                <>
                  <Store className="w-3 h-3 mr-1" />
                  {t('myEntitiesTabStore', { defaultValue: 'Stores' })}
                </>
              )}
              {tab === 'member' && t('myEntitiesTabMember', { defaultValue: 'Member of' })}
              <Badge variant="secondary" className="ml-2">
                {tabCount(tab)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={view} className="mt-6">
          {filteredEntities.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('noEntities')}</CardTitle>
                <CardDescription>{t('noEntitiesDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={ROUTES.ADD_ENTITY(locale)}>{t('createFirstEntity')}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEntities.map((entity) => (
                <Card key={entity.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-5 h-5 shrink-0 text-muted-foreground" />
                        <CardTitle className="text-lg truncate">
                          <Link
                            href={ROUTES.ENTITY(entity.id, locale)}
                            className="hover:underline"
                          >
                            {entity.name}
                          </Link>
                        </CardTitle>
                      </div>
                      {entity.storeActivated && (
                        <Badge variant="outline">{t('storeActive', { defaultValue: 'Store' })}</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {entity.shortDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={ROUTES.ENTITY(entity.id, locale)}>
                        {t('viewEntity', { defaultValue: 'View' })}
                      </Link>
                    </Button>
                    {session?.user?.id === entity.addedBy && (
                      <>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={ROUTES.ENTITY_EDIT(entity.id, locale)}>
                            <Pencil className="w-3 h-3 mr-1" />
                            {t('editEntity', { defaultValue: 'Edit' })}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="destructive">
                          <Link href={ROUTES.ENTITY_DELETE(entity.id, locale)}>
                            <Trash2 className="w-3 h-3 mr-1" />
                            {t('deleteEntity', { defaultValue: 'Delete' })}
                          </Link>
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
