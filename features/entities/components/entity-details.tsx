'use client'

import React, { useState, useEffect } from 'react'
import { EntityLogo } from '@/components/ui/safe-image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { SlidingPopup } from '@/components/common/widgets/modal'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { SerializedEntity } from '@/features/entities/types'
import { SerializedOpportunity } from '@/features/opportunities/types'
import {
  Building, Users, Calendar, MapPin, Phone, Mail, Globe, MessageCircle,
  Briefcase, Package, Star, Award, TrendingUp, Eye, Heart, Share2,
  Clock, CheckCircle, AlertCircle, Zap, Target, BookOpen, ExternalLink
} from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// Avatar components not available, using EntityLogo instead
import { apiClient } from '@/lib/api-client'
import OpportunityCard from '@/features/opportunities/components/opportunity-list'
import { formatDateValue } from '@/lib/utils'

interface EntityDetailsProps {
  initialEntity: SerializedEntity | null
  initialError: string | null
  chatComponent: React.ReactNode
}

/**
 * Enhanced Entity Showcase Page
 * A comprehensive business profile with opportunities, products, analytics, and engagement features
 */
export default function EntityDetails({ initialEntity, initialError, chatComponent }: EntityDetailsProps) {
  const t = useTranslations('modules.entities')
  const [entity] = useState<SerializedEntity | null>(initialEntity)
  const [error] = useState<string | null>(initialError)
  const [opportunities, setOpportunities] = useState<SerializedOpportunity[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Popup states
  const [isWebsitePopupOpen, setIsWebsitePopupOpen] = useState(false)
  const [isContactPopupOpen, setIsContactPopupOpen] = useState(false)
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false)
  const [isInquiryPopupOpen, setIsInquiryPopupOpen] = useState(false)

  const { data: session } = useSession()

  // Load opportunities and products when entity is available
  useEffect(() => {
    if (entity && entity.opportunities?.length > 0) {
      loadEntityOpportunities()
    }
    if (entity && entity.storeActivated) {
      loadEntityProducts()
    }
  }, [entity])

  const loadEntityOpportunities = async () => {
    if (!entity?.opportunities?.length) return

    setIsLoading(true)
    try {
      const opportunityPromises = entity.opportunities.map(oppId =>
        apiClient.get(`/api/opportunities/${oppId}`)
      )

      const responses = await Promise.allSettled(opportunityPromises)
      const loadedOpportunities = responses
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => (result as any).value.data)

      setOpportunities(loadedOpportunities)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadEntityProducts = async () => {
    try {
      const response = await apiClient.get('/api/store/products')
      if (response.success) {
        // Filter products by this entity (assuming products have entityId field)
        const entityProducts = response.data.items.filter((product: any) =>
          product.entityId === entity?.id
        )
        setProducts(entityProducts)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const handleCloseWebsitePopup = async () => setIsWebsitePopupOpen(false)
  const handleCloseContactPopup = async () => setIsContactPopupOpen(false)
  const handleCloseChatPopup = async () => setIsChatPopupOpen(false)
  const handleCloseInquiryPopup = async () => setIsInquiryPopupOpen(false)

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    )
  }

  if (!entity) {
    return (
      <Alert className="m-4">
        <AlertTitle>{t('entityNotFound')}</AlertTitle>
      </Alert>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-background"
    >
      {/* Hero Section */}
      <EntityHeroSection entity={entity} t={t} />

      {/* Main Content */}
      <div className="container mx-auto px-0 py-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview">{t('status.overview', { defaultValue: 'Overview' })}</TabsTrigger>
            <TabsTrigger value="opportunities">{t('status.opportunities', { defaultValue: 'Opportunities' })}</TabsTrigger>
            <TabsTrigger value="products">{t('status.products', { defaultValue: 'Products' })}</TabsTrigger>
            <TabsTrigger value="analytics">{t('status.analytics', { defaultValue: 'Analytics' })}</TabsTrigger>
            <TabsTrigger value="contact">{t('contact', { defaultValue: 'Contact' })}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <EntityOverviewSection entity={entity} t={t} />
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-6">
            <EntityOpportunitiesSection
              opportunities={opportunities}
              isLoading={isLoading}
              entity={entity}
              t={t}
            />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <EntityProductsSection
              products={products}
        entity={entity} 
        t={t} 
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <EntityAnalyticsSection entity={entity} t={t} />
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <EntityContactSection
              entity={entity}
        onContactClick={() => setIsContactPopupOpen(true)}
        onChatClick={() => setIsChatPopupOpen(true)}
              onInquiryClick={() => setIsInquiryPopupOpen(true)}
        t={t}
      />
          </TabsContent>
        </Tabs>
      </div>

      {/* Popups */}
      {entity.website && (
        <WebsitePopup 
          isOpen={isWebsitePopupOpen} 
          onCloseAction={handleCloseWebsitePopup}
          website={entity.website}
          t={t}
        />
      )}

      <ContactPopup 
        isOpen={isContactPopupOpen} 
        onCloseAction={handleCloseContactPopup}
        entity={entity}
        t={t}
      />

      <ChatPopup 
        isOpen={isChatPopupOpen} 
        onCloseAction={handleCloseChatPopup}
        entityName={entity.name}
        chatComponent={chatComponent}
        t={t}
      />

      <InquiryPopup
        isOpen={isInquiryPopupOpen}
        onCloseAction={handleCloseInquiryPopup}
        entity={entity}
        t={t}
      />
    </motion.div>
  )
}

// Hero Section Component
interface EntityHeroSectionProps {
  entity: SerializedEntity
  t: any
}

const EntityHeroSection: React.FC<EntityHeroSectionProps> = ({ entity, t }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.8 }}
    className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b"
  >
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="flex-shrink-0">
    <EntityLogo
      src={entity.logo}
      entityName={entity.name}
            size="lg"
            className="rounded-xl shadow-lg"
          />
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">{entity.name}</h1>
            {entity.storeVerification?.identityVerified && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {t('status.verified', { defaultValue: 'Verified' })}
              </Badge>
            )}
          </div>

          <p className="text-xl text-muted-foreground max-w-2xl">
            {entity.shortDescription}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building className="w-4 h-4" />
              <span>{entity.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{entity.location}</span>
            </div>
            {entity.foundedYear && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{t('foundedIn', { year: entity.foundedYear })}</span>
              </div>
            )}
            {entity.employeeCount && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{t('employees', { count: entity.employeeCount })}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              {t('contactUs', { defaultValue: 'Contact' })}
            </Button>
            {entity.website && (
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                {t('visitWebsite', { defaultValue: 'Visit Website' })}
              </Button>
            )}
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          {entity.storeMetrics && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {entity.storeMetrics.trustScore}/100
              </div>
              <div className="text-sm text-muted-foreground">
                {t('status.trustScore', { defaultValue: 'Trust Score' })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('status.profileViews', { defaultValue: 'Profile Views' })}: 1.2K
            </span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
)

// Overview Section Component
interface EntityOverviewSectionProps {
  entity: SerializedEntity
  t: any
}

const EntityOverviewSection: React.FC<EntityOverviewSectionProps> = ({ entity, t }) => (
  <div className="space-y-8">
    {/* Key Stats */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{entity.opportunities?.length || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('status.openOpportunities', { defaultValue: 'Open Opportunities' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{entity.members?.length || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('status.teamMembers', { defaultValue: 'Team Members' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">
                {entity.storeMetrics?.averageRating?.toFixed(1) || 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('status.averageRating', { defaultValue: 'Average Rating' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">
                {entity.storeMetrics?.totalSales || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('status.totalSales', { defaultValue: 'Total Sales' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* About Section */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {t('about', { defaultValue: 'About' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">
          {entity.fullDescription || entity.shortDescription}
        </p>
      </CardContent>
    </Card>

    {/* Services Section */}
    {entity.services && entity.services.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t('services', { defaultValue: 'Services' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entity.services.map((service, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>{service}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Certifications Section */}
    {entity.certifications && entity.certifications.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            {t('certifications', { defaultValue: 'Certifications' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {entity.certifications.map((cert, index) => (
              <Badge key={index} variant="outline" className="px-3 py-1">
                {cert}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Recent Activity */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('status.recentActivity', { defaultValue: 'Recent Activity' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div>
              <p className="text-sm">
                {t('status.profileUpdated', { defaultValue: 'Profile updated' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateValue(entity.lastUpdated)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm">
                {t('status.entityCreated', { defaultValue: 'Entity created' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateValue(entity.dateAdded)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
)

// Opportunities Section Component
interface EntityOpportunitiesSectionProps {
  opportunities: SerializedOpportunity[]
  isLoading: boolean
  entity: SerializedEntity
  t: any
}

const EntityOpportunitiesSection: React.FC<EntityOpportunitiesSectionProps> = ({
  opportunities,
  isLoading,
  entity,
  t
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">{t('status.openOpportunities', { defaultValue: 'Open Opportunities' })}</h2>
        <p className="text-muted-foreground">
          {t('status.opportunitiesSubtitle', { count: opportunities.length, defaultValue: `${opportunities.length} opportunities available` })}
        </p>
      </div>
      <Badge variant="secondary" className="text-lg px-3 py-1">
        {opportunities.length} {t('status.active', { defaultValue: 'Active' })}
      </Badge>
    </div>

    {isLoading ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded mb-4"></div>
              <div className="h-8 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : opportunities.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {opportunities.map((opportunity) => (
          <Card key={opportunity.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{opportunity.title}</h3>
                  <Badge variant="outline" className="text-xs">
                    {opportunity.type}
                  </Badge>
                </div>
                {opportunity.budget && (
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {opportunity.budget.max} {opportunity.budget.currency}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('budget', { defaultValue: 'Budget' })}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {opportunity.briefDescription}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{opportunity.location}</span>
                </div>
                {opportunity.applicationDeadline && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateValue(opportunity.applicationDeadline)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-3 h-3" />
                  <span>{opportunity.applicantCount || 0} {t('applicants', { defaultValue: 'applicants' })}</span>
                </div>
                <Button size="sm" variant="outline">
                  {t('viewDetails', { defaultValue: 'View Details' })}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <Card>
        <CardContent className="p-12 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('status.noOpportunities', { defaultValue: 'No opportunities available' })}
          </h3>
          <p className="text-muted-foreground mb-4">
            {t('status.noOpportunitiesDescription', { defaultValue: 'This entity doesn\'t have any open opportunities at the moment.' })}
          </p>
          <Button>
            {t('status.contactEntity', { defaultValue: 'Contact Entity' })}
          </Button>
        </CardContent>
      </Card>
    )}
  </div>
)

// Products Section Component
interface EntityProductsSectionProps {
  products: any[]
  entity: SerializedEntity
  t: any
}

const EntityProductsSection: React.FC<EntityProductsSectionProps> = ({
  products,
  entity,
  t
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">{t('status.products', { defaultValue: 'Products & Services' })}</h2>
        <p className="text-muted-foreground">
          {t('status.productsSubtitle', { count: products.length, defaultValue: `${products.length} products available` })}
        </p>
      </div>
      {entity.storeActivated && (
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {t('status.storeActive', { defaultValue: 'Store Active' })}
        </Badge>
      )}
    </div>

    {products.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>

              <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {product.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="font-semibold text-primary">
                  {product.price} {product.currency}
                </div>
                <Button size="sm">
                  {t('status.viewProduct', { defaultValue: 'View Product' })}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <Card>
        <CardContent className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('status.noProducts', { defaultValue: 'No products available' })}
          </h3>
          <p className="text-muted-foreground mb-4">
            {t('status.noProductsDescription', { defaultValue: 'This entity doesn\'t have any products listed at the moment.' })}
          </p>
          {!entity.storeActivated && (
            <p className="text-sm text-muted-foreground">
              {t('status.storeNotActivated', { defaultValue: 'Store not activated yet' })}
            </p>
          )}
        </CardContent>
      </Card>
    )}
  </div>
)

// Analytics Section Component
interface EntityAnalyticsSectionProps {
  entity: SerializedEntity
  t: any
}

const EntityAnalyticsSection: React.FC<EntityAnalyticsSectionProps> = ({ entity, t }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold mb-2">{t('status.analytics', { defaultValue: 'Analytics & Insights' })}</h2>
      <p className="text-muted-foreground">
        {t('status.analyticsDescription', { defaultValue: 'Performance metrics and engagement data' })}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('status.profileViews', { defaultValue: 'Profile Views' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">1,247</div>
          <p className="text-sm text-muted-foreground">
            {t('status.last30Days', { defaultValue: 'Last 30 days' })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('status.inquiries', { defaultValue: 'Inquiries' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">23</div>
          <p className="text-sm text-muted-foreground">
            {t('status.thisMonth', { defaultValue: 'This month' })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {t('status.engagement', { defaultValue: 'Engagement' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">87%</div>
          <p className="text-sm text-muted-foreground">
            {t('status.responseRate', { defaultValue: 'Response rate' })}
          </p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{t('status.performanceChart', { defaultValue: 'Performance Chart' })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {t('status.chartPlaceholder', { defaultValue: 'Interactive performance chart' })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
)

// Contact Section Component
interface EntityContactSectionProps {
  entity: SerializedEntity
  onContactClick: () => void
  onChatClick: () => void
  onInquiryClick: () => void
  t: any
}

const EntityContactSection: React.FC<EntityContactSectionProps> = ({
  entity,
  onContactClick,
  onChatClick,
  onInquiryClick,
  t
}) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold mb-2">{t('contact', { defaultValue: 'Contact & Connect' })}</h2>
      <p className="text-muted-foreground">
        {t('status.contactDescription', { defaultValue: 'Get in touch with this entity' })}
      </p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('status.quickMessage', { defaultValue: 'Quick Message' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('status.quickMessageDescription', { defaultValue: 'Send a direct message to start a conversation' })}
          </p>
          <Button onClick={onChatClick} className="w-full">
            {t('status.startChat', { defaultValue: 'Start Chat' })}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t('status.contactForm', { defaultValue: 'Contact Form' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('status.contactFormDescription', { defaultValue: 'Send a detailed inquiry with your contact information' })}
          </p>
          <Button onClick={onContactClick} variant="outline" className="w-full">
            {t('status.sendInquiry', { defaultValue: 'Send Inquiry' })}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('visitWebsite', { defaultValue: 'Visit Website' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('status.visitWebsiteDescription', { defaultValue: 'Explore their website for more information' })}
          </p>
          {entity.website ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(entity.website, '_blank')}
            >
              {t('status.openWebsite', { defaultValue: 'Open Website' })}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              {t('status.noWebsite', { defaultValue: 'No Website' })}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Contact Information */}
    <Card>
      <CardHeader>
        <CardTitle>{t('status.contactInfo', { defaultValue: 'Contact Information' })}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entity.phoneNumber && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium">{entity.phoneNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {t('status.phone', { defaultValue: 'Phone' })}
                </div>
              </div>
            </div>
          )}

          {entity.contactEmail && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium">{entity.contactEmail}</div>
                <div className="text-sm text-muted-foreground">
                  {t('status.email', { defaultValue: 'Email' })}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">{entity.location}</div>
              <div className="text-sm text-muted-foreground">
                {t('location', { defaultValue: 'Location' })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
)

interface EntityDetailsGridProps {
  entity: SerializedEntity
  t: any // Use any to match useTranslations return type
  onWebsiteClick: () => void
}

const EntityDetailsGrid: React.FC<EntityDetailsGridProps> = ({ entity, t, onWebsiteClick }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('details')}</h2>
      <ul className="space-y-2">
        <li className="flex items-center">
          <Building className="w-5 h-5 mr-2" />
          <span>{entity.type}</span>
        </li>
        <li className="flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          <span>{entity.location}</span>
        </li>
        {entity.foundedYear && (
          <li className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            <span>{t('foundedIn', { year: entity.foundedYear })}</span>
          </li>
        )}
        {entity.employeeCount && (
          <li className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            <span>{t('employees', { count: entity.employeeCount })}</span>
          </li>
        )}
      </ul>
    </div>

    <div>
      <h2 className="text-xl font-semibold mb-4">{t('contact')}</h2>
      <ul className="space-y-2">
        {entity.phoneNumber && (
          <li className="flex items-center">
            <Phone className="w-5 h-5 mr-2" />
            <a href={`tel:${entity.phoneNumber}`} className="hover:underline">
              {entity.phoneNumber}
            </a>
          </li>
        )}
        {entity.contactEmail && (
          <li className="flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            <a href={`mailto:${entity.contactEmail}`} className="hover:underline">
              {entity.contactEmail}
            </a>
          </li>
        )}
        {entity.website && (
          <li className="flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            <Button
              variant="link"
              onClick={onWebsiteClick}
              className="p-0 h-auto"
            >
              {t('visitWebsite')}
            </Button>
          </li>
        )}
      </ul>
    </div>
  </div>
)

interface EntityFullDescriptionProps {
  description: string | undefined
  t: (key: string) => string
}

const EntityFullDescription: React.FC<EntityFullDescriptionProps> = ({ description, t }) => {
  if (!description) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">{t('about')}</h2>
      <p>{description}</p>
    </div>
  )
}

interface EntityServicesProps {
  services: string[] | undefined
  t: (key: string) => string
}

const EntityServices: React.FC<EntityServicesProps> = ({ services, t }) => {
  if (!services || services.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">{t('services')}</h2>
      <ul className="list-disc list-inside">
        {services.map((service, index) => (
          <li key={index}>{service}</li>
        ))}
      </ul>
    </div>
  )
}

interface EntityActionsProps {
  onContactClick: () => void
  onChatClick: () => void
  t: (key: string) => string
}

const EntityActions: React.FC<EntityActionsProps> = ({ onContactClick, onChatClick, t }) => (
  <div className="mt-6 flex justify-end space-x-4">
    <Button onClick={onContactClick}>
      {t('contactUs')}
    </Button>
    <Button onClick={onChatClick}>
      <MessageCircle className="w-5 h-5 mr-2" />
      {t('chat')}
    </Button>
  </div>
)

interface WebsitePopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  website: string
  t: (key: string) => string
}

const WebsitePopup: React.FC<WebsitePopupProps> = ({ isOpen, onCloseAction, website, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('externalWebsite')}</h2>
      <p className="mb-4">{t('externalWebsiteWarning')}</p>
      <Button
        onClick={() => {
          window.open(website, '_blank', 'noopener,noreferrer')
        }}
      >
        {t('continueToWebsite')}
      </Button>
    </div>
  </SlidingPopup>
)

interface ContactPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  entity: SerializedEntity
  t: any // Use any to match useTranslations return type
}

const ContactPopup: React.FC<ContactPopupProps> = ({ isOpen, onCloseAction, entity, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('contactEntity', { name: entity.name })}</h2>
      <ContactForm 
        entityId={entity.id} 
        entityName={entity.name}
        initialUserInfo={{
          name: '',
          email: ''
        }}
      />
    </div>
  </SlidingPopup>
)

interface ChatPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  entityName: string
  chatComponent: React.ReactNode
  t: any // Use any to match useTranslations return type
}

const ChatPopup: React.FC<ChatPopupProps> = ({ isOpen, onCloseAction, entityName, chatComponent, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">{t('chatWith', { name: entityName })}</h2>
      {chatComponent}
    </div>
  </SlidingPopup>
)

// Inquiry Popup Component
interface InquiryPopupProps {
  isOpen: boolean
  onCloseAction: () => Promise<void>
  entity: SerializedEntity
  t: any
}

const InquiryPopup: React.FC<InquiryPopupProps> = ({ isOpen, onCloseAction, entity, t }) => (
  <SlidingPopup isOpen={isOpen} onCloseAction={onCloseAction}>
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">
        {t('status.inquiryForm', { defaultValue: 'Direct Inquiry' })} - {entity.name}
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('status.inquiryType', { defaultValue: 'Inquiry Type' })}
          </label>
          <select className="w-full p-2 border rounded-lg">
            <option>{t('status.generalInquiry', { defaultValue: 'General Inquiry' })}</option>
            <option>{t('status.partnership', { defaultValue: 'Partnership Opportunity' })}</option>
            <option>{t('status.collaboration', { defaultValue: 'Collaboration Request' })}</option>
            <option>{t('status.support', { defaultValue: 'Support Request' })}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            {t('status.message', { defaultValue: 'Message' })}
          </label>
          <textarea
            className="w-full p-2 border rounded-lg h-32"
            placeholder={t('status.inquiryPlaceholder', { defaultValue: 'Tell us about your inquiry...' })}
          />
        </div>

        <div className="flex gap-2">
          <Button className="flex-1">
            {t('status.sendInquiry', { defaultValue: 'Send Inquiry' })}
          </Button>
          <Button variant="outline" onClick={onCloseAction}>
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
        </div>
      </div>
    </div>
  </SlidingPopup>
)
