'use client'

import React, { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { Opportunity } from '@/features/opportunities/types'
import { Entity } from '@/types'
import Link from 'next/link'
import { Calendar, MapPin, Tag, Building, User, DollarSign, Clock } from 'lucide-react'
import Image from 'next/image'
import { useSession } from "next-auth/react"
import LoginForm from '@/components/auth/login-form'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useInView } from '@/hooks/use-intersection-observer'
import { formatTimestampOrFieldValue, truncateDescription, fetchOpportunities, formatBudget } from '@/lib/utils'
import { useAppContext } from '@/contexts/app-context'

interface OpportunitiesProps {
  initialOpportunities: Opportunity[]
  initialError: string | null
  lastVisible: string | null
  limit: number
}

const Opportunities: React.FC<OpportunitiesProps> = ({ 
  initialOpportunities, 
  initialError, 
  lastVisible: initialLastVisible,
  limit 
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const { error, setError } = useAppContext()
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(initialOpportunities)
  const [entities, setEntities] = React.useState<{ [key: string]: Entity }>({})
  const [loading, setLoading] = React.useState(false)
  const [lastVisible, setLastVisible] = React.useState<string | null>(initialLastVisible)
  const { ref, inView } = useInView()

  useEffect(() => {
    setOpportunities(initialOpportunities)
    setError(initialError)
  }, [initialOpportunities, initialError, setError])

  const fetchMoreOpportunities = useCallback(async () => {
    if (loading || !lastVisible) return

    setLoading(true)
    setError(null)

    try {
      const data = await fetchOpportunities('/api/opportunities', limit, lastVisible)
      setOpportunities(prev => [...prev, ...data.opportunities])
      setLastVisible(data.lastVisible)
    } catch (error) {
      console.error('Error fetching more opportunities:', error)
      setError(t('errorFetchingMoreOpportunities'))
    } finally {
      setLoading(false)
    }
  }, [loading, lastVisible, limit, t, setError])

  useEffect(() => {
    if (inView) {
      fetchMoreOpportunities()
    }
  }, [inView, fetchMoreOpportunities])

  useEffect(() => {
    const fetchEntities = async () => {
      if (!session) return

      setLoading(true)
      setError(null)
      try {
        const entityPromises = opportunities.map(opp => 
          fetch(`/api/entities/${opp.organizationId}`).then(res => res.json())
        )
        const fetchedEntities = await Promise.all(entityPromises)
        const entityMap = fetchedEntities.reduce((acc, entity) => {
          if (entity) acc[entity.id] = entity
          return acc
        }, {} as { [key: string]: Entity })
        setEntities(prev => ({ ...prev, ...entityMap }))
      } catch (error) {
        console.error('Error fetching entities:', error)
        setError(t('errorFetchingEntities'))
      } finally {
        setLoading(false)
      }
    }

    fetchEntities()
  }, [opportunities, session, t, setError])

  if (status === 'loading') {
    return <LoadingMessage message={t('loadingMessage')} />
  }

  if (!session) {
    return <LoginForm />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[hsl(var(--page-background))] text-foreground">
      <div className="container mx-auto px-4 py-12">
        <PageTitle title={t('opportunities')} />
        <OpportunityList opportunities={opportunities} entities={entities} />
        {loading && <LoadingMessage message={t('loadingMoreOpportunities')} />}
        {!loading && lastVisible && <div ref={ref} className="h-10" />}
      </div>
    </div>
  )
}

const LoadingMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center">
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-xl"
    >
      {message}
    </motion.p>
  </div>
)

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="container mx-auto px-4 py-12 text-center">
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="text-xl text-destructive"
    >
      {message}
    </motion.p>
  </div>
)

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

const OpportunityList: React.FC<{ opportunities: Opportunity[], entities: { [key: string]: Entity } }> = ({ opportunities, entities }) => (
  <div className="max-w-2xl mx-auto">
    <AnimatePresence>
      {opportunities.map((opportunity) => (
        <OpportunityCard key={opportunity.id} opportunity={opportunity} entity={entities[opportunity.organizationId]} />
      ))}
    </AnimatePresence>
  </div>
)

const OpportunityCard: React.FC<{ opportunity: Opportunity, entity: Entity | undefined }> = ({ opportunity, entity }) => {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <Image
              src={entity?.logo || '/placeholder.svg'}
              alt={entity?.name || 'Company logo'}
              width={40}
              height={40}
              className="rounded-full mr-3"
            />
            <div>
              <h2 className="font-semibold">{entity?.name}</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{opportunity.location}</span>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">{opportunity.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{truncateDescription(opportunity.briefDescription)}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center text-sm">
              <Building className="w-4 h-4 mr-2" />
              <span>{opportunity.category}</span>
            </div>
            <div className="flex items-center text-sm">
              <User className="w-4 h-4 mr-2" />
              <span>{opportunity.createdBy}</span>
            </div>
            <div className="flex items-center text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{formatTimestampOrFieldValue(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2" />
              <span>{formatTimestampOrFieldValue(opportunity.dateCreated)}</span>
            </div>
          </div>
          {opportunity.budget && (
            <div className="flex items-center text-sm mb-4">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>{formatBudget(opportunity.budget)}</span>
            </div>
          )}
          <OpportunityTags tags={opportunity.tags} />
          <Link href={`/opportunities/${opportunity.id}`} passHref>
            <Button className="w-full mt-4">{t('viewDetails')}</Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

const OpportunityTags: React.FC<{ tags: string[] }> = ({ tags }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    <Tag className="w-4 h-4 mr-2" />
    {tags.slice(0, 3).map((tag, index) => (
      <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">{tag}</span>
    ))}
    {tags.length > 3 && (
      <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">+{tags.length - 3}</span>
    )}
  </div>
)

export default Opportunities

