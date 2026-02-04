'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { deleteOpportunity, type OpportunityFormState } from '@/app/_actions/opportunities'
import Link from 'next/link'
import { Plus, Briefcase, Send, Filter as FilterIcon, Search, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import FilterPanel from '@/components/opportunities/opportunities-filters-panel'

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
 * My Opportunities Wrapper Component (Consolidated Management & Tracking)
 * Displays user's opportunities with full CRUD capabilities
 * Combines tracking (created/applied) with management (edit/delete)
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

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  // Tab filter state
  const [filter, setFilter] = useState<'all' | 'created' | 'applied'>('created')
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [filteredOpportunities, setFilteredOpportunities] = useState<SerializedOpportunity[]>(initialOpportunities)

  // Apply filters whenever search or filter values change
  useEffect(() => {
    let filtered = [...initialOpportunities]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(opp => 
        opp.title.toLowerCase().includes(query) ||
        opp.briefDescription.toLowerCase().includes(query) ||
        opp.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(opp => opp.type === typeFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(opp => opp.status === statusFilter)
    }

    setFilteredOpportunities(filtered)
  }, [initialOpportunities, searchQuery, typeFilter, statusFilter])

  const handleFilterChange = useCallback((newFilter: string) => {
    startTransition(() => {
      setFilter(newFilter as 'all' | 'created' | 'applied')
    })
    // Update URL with new filter
    const url = new URL(window.location.href)
    url.searchParams.set('filter', newFilter)
    router.push(url.pathname + url.search)
  }, [startTransition, router])

  // Handle delete opportunity
  const handleDelete = async (opportunity: SerializedOpportunity) => {
    if (!confirm(`Are you sure you want to delete "${opportunity.title}"? This action cannot be undone.`)) {
      return
    }

    const formData = new FormData()
    formData.append('opportunityId', opportunity.id)

    const result = await deleteOpportunity(null, formData)

    if (result.success && result.redirectUrl) {
      // Reload page to reflect changes
      router.refresh()
    } else {
      alert(result.error || 'Failed to delete opportunity')
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white'
      case 'closed': return 'bg-gray-500 text-white'
      case 'expired': return 'bg-red-500 text-white'
      default: return 'bg-gray-300 text-gray-800'
    }
  }

  // Get type badge color
  const getTypeColor = (type: string) => {
    const requestTypes = ['request', 'ring_customization']
    return requestTypes.includes(type) 
      ? 'bg-blue-500 text-white' 
      : 'bg-purple-500 text-white'
  }

  return (
    <div className="container mx-auto px-0 py-0">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('myOpportunities', { defaultValue: 'My Opportunities' })}
            </h1>
            <p className="text-muted-foreground mt-2">
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
                <p className="text-sm text-muted-foreground">
                  {t('createdOpportunities', { defaultValue: 'Created' })}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {counts.created}
                </p>
              </div>
              <Briefcase className="text-blue-500" size={32} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('appliedOpportunities', { defaultValue: 'Applied' })}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {counts.applied}
                </p>
              </div>
              <Send className="text-green-500" size={32} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('totalOpportunities', { defaultValue: 'Total' })}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {counts.created + counts.applied}
                </p>
              </div>
              <FilterPanel />
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

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="request">Requests</SelectItem>
                <SelectItem value="offer">Offers</SelectItem>
                <SelectItem value="partnership">Partnerships</SelectItem>
                <SelectItem value="volunteer">Volunteer</SelectItem>
                <SelectItem value="mentorship">Mentorship</SelectItem>
                <SelectItem value="resource">Resources</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="ring_customization">Ring Customization</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for created/applied */}
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
          {filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Briefcase className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {initialOpportunities.length === 0
                    ? 'No opportunities yet'
                    : 'No opportunities match your filters'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {initialOpportunities.length === 0
                    ? 'Create your first opportunity to get started'
                    : 'Try adjusting your search or filters'}
                </p>
                {initialOpportunities.length === 0 && (
                  <Link href={`/${locale}/opportunities/add`}>
                    <Button>
                      <Plus className="mr-2" size={20} />
                      Create Opportunity
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOpportunities.map((opportunity) => (
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
                          {opportunity.status}
                        </Badge>
                        <Badge className={getTypeColor(opportunity.type)}>
                          {opportunity.type}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">
                          Created: {new Date(opportunity.dateCreated).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          Expires: {new Date(opportunity.expirationDate).toLocaleDateString()}
                        </span>
                        {opportunity.applicantCount > 0 && (
                          <>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {opportunity.applicantCount} {opportunity.applicantCount === 1 ? 'applicant' : 'applicants'}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          asChild
                        >
                          <Link href={`/${locale}/opportunities/${opportunity.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDelete(opportunity)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
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
