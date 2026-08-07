"use client"

import type React from "react"
import { useCallback, useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import type { Opportunity } from "@/types"
import Link from "next/link"
import { Calendar, MapPin, Tag, Building, Lock, DollarSign, Clock } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { hasConfidentialAccess } from '@/features/auth/user-role'
import { AddOpportunityButton } from '@/components/opportunities/add-opportunity-button'
import { formatBudget, truncateDescription, formatTimestampOrFieldValue } from "@/lib/utils"
import { useAppContext } from "@/contexts/app-context"
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'

/**
 * Props for the ConfidentialOpportunities component
 */
interface ConfidentialOpportunitiesProps {
  initialOpportunities: Opportunity[]
  totalOpportunities: number
  initialError: string | null
  lastVisible: string | null
  filter: string
  limit: number
  page: number
  sort: string
  totalPages: number
}

/**
 * ConfidentialOpportunities component
 * Displays a list of confidential opportunities with infinite scrolling
 */
const ConfidentialOpportunities: React.FC<ConfidentialOpportunitiesProps> = ({
  initialOpportunities,
  initialError,
  lastVisible: initialLastVisible,
  limit,
  sort,
  filter,
}) => {
  const t = useTranslations('modules.opportunities')
  const locale = useLocale()
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setOpportunities, error, setError } = useAppContext()

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('confidential-opportunities', { sort, filter }),
    [sort, filter],
  )

  const canFetch =
    status === 'authenticated' &&
    Boolean(session) &&
    hasConfidentialAccess(session?.user?.role)

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const params = new URLSearchParams({
        limit: String(limit),
        sort,
        filter,
      })
      if (cursor) params.set('startAfter', cursor)

      const response = await fetch(`/api/confidential/opportunities?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch confidential opportunities')
      }
      const data = await response.json()
      return normalizePaginatedResponse<Opportunity>(
        {
          opportunities: data.opportunities,
          items: data.opportunities,
          lastVisible: data.lastVisible,
          cursor: data.cursor ?? data.lastVisible,
          hasMore: data.hasMore,
        },
        limit,
      )
    },
    [filter, limit, sort],
  )

  const {
    items,
    loading,
    hasMore,
    error: feedError,
    sentinelRef,
  } = useCursorFeed<Opportunity>({
    moduleId: 'confidential-opportunities',
    locale,
    limit,
    filterFingerprint,
    initialItems: initialOpportunities,
    initialCursor: initialLastVisible,
    enabled: canFetch,
    fetchPage,
  })

  useEffect(() => {
    setOpportunities(items)
    setError(feedError || initialError)
  }, [items, feedError, initialError, setOpportunities, setError])

  if (status === "loading") {
    return <LoadingMessage message={t("loadingMessage")} />
  }

  if (!session) {
    const search = searchParams.toString()
    const from = pathname + (search ? `?${search}` : '')
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Lock className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-4xl font-bold mb-4"
        >
          {t('confidentialTitle') || 'Confidential Opportunities'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="max-w-2xl text-muted-foreground mb-8"
        >
          {t('confidentialDescription') || 'Access exclusive confidential opportunities and partnerships. Sign in to view restricted content.'}
        </motion.p>
        <div className="w-full max-w-md">
          <UnifiedLoginInline from={from} variant="hero" />
        </div>
      </div>
    )
  }

  if (!hasConfidentialAccess(session.user?.role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Lock className="mx-auto h-16 w-16 text-orange-500 mb-4" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl font-bold mb-4"
        >
          {t('accessDeniedTitle') || 'Access Restricted'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="max-w-2xl text-muted-foreground mb-8"
        >
          {t('accessDeniedDescription') || 'This content requires confidential access level. Contact support to upgrade your account.'}
        </motion.p>
        <Button asChild variant="outline">
          <Link href="/contact">
            {t('contactSupport') || 'Contact Support'}
          </Link>
        </Button>
      </div>
    )
  }

  if (error && items.length === 0) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[hsl(var(--page-background))] text-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <PageTitle title={t("ConfidentialOpportunitiesTitle")} />
          <AddOpportunityButton />
        </div>
        <OpportunityGrid opportunities={items} />
        {loading && (
          <div className="mt-6 text-center text-sm text-muted-foreground">{t("loadingMore")}</div>
        )}
        {hasMore && <div ref={sentinelRef} className="mt-8 h-10" aria-hidden />}
      </div>
    </div>
  )
}

/**
 * LoadingMessage component
 * Displays a loading message with animation
 */
const LoadingMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center text-xl">
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {message}
    </motion.p>
  </div>
)

/**
 * ErrorMessage component
 * Displays an error message with animation
 */
const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center text-xl text-destructive">
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      {message}
    </motion.p>
  </div>
)

/**
 * PageTitle component
 * Displays the page title with animation
 */
const PageTitle: React.FC<{ title: string }> = ({ title }) => (
  <motion.h1
    initial={{ opacity: 0, y: -50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="text-4xl font-bold text-center mb-8"
  >
    {title}
  </motion.h1>
)

/**
 * OpportunityGrid component
 * Displays a grid of opportunity cards
 */
const OpportunityGrid: React.FC<{ opportunities: Opportunity[] }> = ({ opportunities }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <AnimatePresence>
      {opportunities.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} />
      ))}
    </AnimatePresence>
  </div>
)

/**
 * OpportunityCard component
 * Displays a card for a single opportunity
 */
const OpportunityCard: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => {
  const t = useTranslations('modules.opportunities')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <Card className="relative">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-2">{opportunity.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{truncateDescription(opportunity.briefDescription)}</p>
          <OpportunityDetails opportunity={opportunity} />
          <OpportunityTags tags={opportunity.tags} />
        </CardContent>
        <CardFooter className="bg-muted/50">
          <Link href={`/confidential/opportunities/${opportunity.id}`} className="w-full">
            <Button className="w-full">{t("viewConfidentialDetails")}</Button>
          </Link>
        </CardFooter>
        <ConfidentialBadge />
      </Card>
    </motion.div>
  )
}

/**
 * OpportunityDetails component
 * Displays the details of an opportunity
 */
const OpportunityDetails: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => (
  <div className="space-y-2">
    <DetailItem icon={Building} text={opportunity.organizationId} />
    <DetailItem icon={MapPin} text={opportunity.location} />
    <DetailItem icon={Calendar} text={formatTimestampOrFieldValue(opportunity.dateCreated)} />
    <DetailItem icon={Clock} text={formatTimestampOrFieldValue(opportunity.expirationDate)} />
    {opportunity.budget && <DetailItem icon={DollarSign} text={formatBudget(opportunity.budget)} />}
  </div>
)

/**
 * DetailItem component
 * Displays a single detail item with an icon
 */
const DetailItem: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex items-center text-sm">
    <Icon className="w-4 h-4 mr-2" />
    <span>{text}</span>
  </div>
)

/**
 * OpportunityTags component
 * Displays the tags for an opportunity
 */
const OpportunityTags: React.FC<{ tags: string[] }> = ({ tags }) => {
  const t = useTranslations('modules.opportunities')

  if (!tags || tags.length === 0) return null

  return (
    <div className="mt-4">
      <div className="flex items-center text-sm mb-2">
        <Tag className="w-4 h-4 mr-2" />
        <span className="font-semibold">{t("tags")}:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * ConfidentialBadge component
 * Displays a confidential badge on the opportunity card
 */
const ConfidentialBadge: React.FC = () => {
  const t = useTranslations('modules.opportunities')

  return (
    <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded flex items-center">
      <Lock className="w-3 h-3 mr-1" />
      {t("confidential")}
    </div>
  )
}

export default ConfidentialOpportunities

