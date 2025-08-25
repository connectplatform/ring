'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { SerializedOpportunity } from '@/features/opportunities/types'
import OpportunityList from '@/features/opportunities/components/opportunity-list'
import Link from 'next/link'
import { Plus, Briefcase, Send, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'


interface MyOpportunitiesWrapperProps {
  initialOpportunities: SerializedOpportunity[]
  initialError: string | null
  lastVisible: string | null
  initialLimit: number
  counts: {
    created: number
    applied: number
  }
}

/**
 * My Opportunities Wrapper Component
 * Displays user's created opportunities and applications
 * Following the professional mapping paradigm from PLATFORM-PHILOSOPHY.md
 */
export default function MyOpportunitiesWrapper({
  initialOpportunities,
  initialError,
  lastVisible,
  initialLimit,
  counts
}: MyOpportunitiesWrapperProps) {
  const t = useTranslations('modules.opportunities')
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const locale = session?.user?.settings?.language || 'en'
  
  const [filter, setFilter] = React.useState<'all' | 'created' | 'applied'>('created')
  
  // Use serialized opportunities directly since OpportunityList now accepts SerializedOpportunity[]
  const opportunities = initialOpportunities

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter as 'all' | 'created' | 'applied')
    // Update URL with new filter
    const url = new URL(window.location.href)
    url.searchParams.set('filter', newFilter)
    router.push(url.pathname + url.search)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('myOpportunities', { defaultValue: 'My Opportunities' })}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('myOpportunitiesDescription', { 
                defaultValue: 'Manage your created opportunities and track applications' 
              })}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href={`/${locale}/opportunities/add`}>
              <Button className="flex items-center gap-2">
                <Plus size={20} />
                {t('createNew', { defaultValue: 'Create New' })}
              </Button>
            </Link>
            <Link href={`/${locale}/opportunities`}>
              <Button variant="outline" className="flex items-center gap-2">
                <Briefcase size={20} />
                {t('viewAll', { defaultValue: 'View All' })}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t('createdOpportunities', { defaultValue: 'Created' })}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {counts.created}
                </p>
              </div>
              <Briefcase className="text-blue-500" size={32} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t('appliedOpportunities', { defaultValue: 'Applied' })}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {counts.applied}
                </p>
              </div>
              <Send className="text-green-500" size={32} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {t('totalOpportunities', { defaultValue: 'Total' })}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {counts.created + counts.applied}
                </p>
              </div>
              <Filter className="text-purple-500" size={32} />
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {initialError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{initialError}</p>
        </div>
      )}

      {/* Tabs for filtering */}
      <Tabs value={filter} onValueChange={handleFilterChange} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            {t('all', { defaultValue: 'All' })}
            {counts.created + counts.applied > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts.created + counts.applied}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="created" className="flex items-center gap-2">
            {t('created', { defaultValue: 'Created' })}
            {counts.created > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts.created}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="applied" className="flex items-center gap-2">
            {t('applied', { defaultValue: 'Applied' })}
            {counts.applied > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts.applied}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {initialOpportunities.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Briefcase className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'created' 
                  ? t('noCreatedOpportunities', { defaultValue: 'No opportunities created yet' })
                  : filter === 'applied'
                  ? t('noAppliedOpportunities', { defaultValue: 'No applications yet' })
                  : t('noOpportunities', { defaultValue: 'No opportunities yet' })
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {filter === 'created' 
                  ? t('createFirstOpportunity', { defaultValue: 'Create your first opportunity to get started' })
                  : filter === 'applied'
                  ? t('applyToOpportunities', { defaultValue: 'Browse opportunities and apply to get started' })
                  : t('getStartedWithOpportunities', { defaultValue: 'Create or apply to opportunities to get started' })
                }
              </p>
              <div className="flex justify-center gap-3">
                {(filter === 'created' || filter === 'all') && (
                  <Link href={`/${locale}/opportunities/add`}>
                    <Button>
                      <Plus className="mr-2" size={20} />
                      {t('createOpportunity', { defaultValue: 'Create Opportunity' })}
                    </Button>
                  </Link>
                )}
                {(filter === 'applied' || filter === 'all') && (
                  <Link href={`/${locale}/opportunities`}>
                    <Button variant="outline">
                      {t('browseOpportunities', { defaultValue: 'Browse Opportunities' })}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <OpportunityList
              initialOpportunities={opportunities}
              initialEntities={{}}
              initialError={null}
              lastVisible={lastVisible}
              limit={initialLimit}
              totalCount={initialOpportunities.length}
              locale={locale}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
