'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Briefcase, Crown, ArrowRight, Handshake, Heart, Users, Share2, Calendar, X, Sparkles, TrendingUp, Target, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect } from 'react'
import { eventBus } from '@/lib/event-bus.client'

interface OpportunityTypeSelectorClientProps {
  onClose: () => void
  userRole: 'member' | 'subscriber'
  locale: Locale
}

// Ring Platform Portal - Focused opportunity types
// Only 4 types: Ring Customization, Technology Request, Developer CV, Technology Offer
const opportunityTypeConfigs = {
  ring_customization: {
    icon: Zap,
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
    accentIcon: Crown,
    requiresMembership: true,
    popular: true,
    examples: ['platform_deployment', 'module_development', 'branding', 'database_migration', 'localization', 'payment_integration', 'smart_contracts', 'ai_customization', 'token_economics', 'documentation']
  },
  request: {
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    accentIcon: Target,
    requiresMembership: false,
    popular: true,
    examples: ['freelancer', 'service', 'advice']
  },
  cv: {
    icon: Zap,
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
    accentIcon: Crown,
    requiresMembership: false,
    popular: true,
    examples: ['developer_cv', 'portfolio', 'skills']
  },
  offer: {
    icon: Briefcase,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    accentIcon: TrendingUp,
    requiresMembership: true,
    examples: ['job', 'contract', 'internship']
  }
}

export function OpportunityTypeSelectorClient({ onClose, userRole, locale }: OpportunityTypeSelectorClientProps) {
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Listen for modal:close-all event from event bus
  useEffect(() => {
    const unsubscribe = eventBus.on('modal:close-all', () => {
      onClose()
    })
    
    // Emit modal opened event
    eventBus.emit('modal:opened', { modalId: 'opportunity-type-selector', zIndex: 8000 })
    
    return () => {
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'opportunity-type-selector' })
    }
  }, [onClose])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  if (showUpgradeModal) {
    return (
      <MembershipUpgradeModal
        onClose={onClose}
        returnTo={`/${locale}/opportunities/add?type=offer`}
      />
    )
  }

  const renderOpportunityCard = (typeKey: string, config: any) => {
    const Icon = config.icon
    const AccentIcon = config.accentIcon
    const canAccess = !config.requiresMembership || userRole === 'member'
    const isHovered = hoveredType === typeKey

    return (
      <motion.div
        key={typeKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Object.keys(opportunityTypeConfigs).indexOf(typeKey) * 0.1 }}
        onHoverStart={() => setHoveredType(typeKey)}
        onHoverEnd={() => setHoveredType(null)}
        className="group"
      >
        <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${config.borderColor} ${
          canAccess ? 'cursor-pointer' : 'cursor-default opacity-75'
        } h-full flex flex-col`}>
          {/* Background gradient overlay */}
          <div className={`absolute inset-0 ${config.bgColor} transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-50'
          }`} />

          {/* Popular badge */}
          {config.popular && (
            <div className="absolute top-3 right-3 z-10">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <Sparkles className="h-3 w-3 mr-1" />
                Popular
              </Badge>
            </div>
          )}

          {/* Membership required badge */}
          {config.requiresMembership && userRole === 'subscriber' && (
            <div className="absolute top-3 right-3 z-10">
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
                <Crown className="h-3 w-3 mr-1" />
                Member
              </Badge>
            </div>
          )}

          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${config.color} text-white shadow-lg`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-lg font-semibold">
                  {t(`type_selector.${typeKey}.title`, { defaultValue: typeKey.charAt(0).toUpperCase() + typeKey.slice(1) })}
                </span>
              </div>
              <motion.div
                animate={{ rotate: isHovered ? 360 : 0 }}
                transition={{ duration: 0.5 }}
              >
                <AccentIcon className={`h-5 w-5 ${config.textColor} opacity-60`} />
              </motion.div>
            </CardTitle>
          </CardHeader>

          <CardContent className="relative z-10 flex flex-col flex-grow p-6">
            <div className="flex-grow space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(`type_selector.${typeKey}.description`, {
                  defaultValue: `Create ${typeKey} opportunities for the community.`
                })}
              </p>

              {/* Examples */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('type_selector.examples', { defaultValue: 'Examples' })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {config.examples.map((example: string) => (
                    <Badge
                      key={example}
                      variant="secondary"
                      className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-800/50"
                    >
                      {t(`type_selector.${typeKey}.examples.${example}`, { defaultValue: example })}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Action button - always at bottom */}
            <div className="pt-4 mt-auto">
              {canAccess ? (
                <Button asChild className={`w-full bg-gradient-to-r ${config.color} hover:opacity-90 text-white border-0 shadow-lg`}>
                  <Link href={`/${locale}/opportunities/add?type=${typeKey}`}>
                    {t(`type_selector.${typeKey}.button`, { defaultValue: `Create ${typeKey.charAt(0).toUpperCase() + typeKey.slice(1)}` })}
                    <motion.div
                      animate={{ x: isHovered ? 5 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </motion.div>
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {t(`type_selector.${typeKey}.upgrade_button`, { defaultValue: 'Upgrade to Member' })}
                </Button>
              )}
            </div>
          </CardContent>

          {/* Hover effect overlay */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${config.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
          />
        </Card>
      </motion.div>
    )
  }

  // Mobile collapsible card renderer
  const renderMobileCollapsibleCard = (typeKey: string, config: any) => {
    const Icon = config.icon
    const AccentIcon = config.accentIcon
    const isExpanded = expandedSections.has(typeKey)
    const canAccess = !config.requiresMembership || userRole === 'member'
    const isHovered = hoveredType === typeKey

    return (
      <Collapsible key={typeKey} open={isExpanded} onOpenChange={() => toggleSection(typeKey)}>
        <Card className={`transition-all duration-200 ${config.bgColor} ${config.borderColor} border-2`}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${config.color} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold block">
                      {t(`type_selector.${typeKey}.title`, { defaultValue: typeKey.charAt(0).toUpperCase() + typeKey.slice(1) })}
                    </span>
                    {config.popular && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {tCommon('labels.popular', { defaultValue: 'Popular' })}
                      </Badge>
                    )}
                    {config.requiresMembership && (
                      <Badge variant="outline" className="text-xs mt-1 border-amber-500 text-amber-700 dark:text-amber-300">
                        <Crown className="h-3 w-3 mr-1" />
                        {tCommon('membership.title', { defaultValue: 'Premium' })}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ rotate: isHovered ? 360 : 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <AccentIcon className={`h-5 w-5 ${config.textColor} opacity-60`} />
                  </motion.div>
                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`type_selector.${typeKey}.description`, {
                    defaultValue: `Create ${typeKey} opportunities for the community.`
                  })}
                </p>

                {/* Examples */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('type_selector.examples', { defaultValue: 'Examples' })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {config.examples.map((example: string) => (
                      <Badge
                        key={example}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-800/50"
                      >
                        {t(`type_selector.${typeKey}.examples.${example}`, { defaultValue: example })}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {canAccess ? (
                    <Button asChild className={`w-full bg-gradient-to-r ${config.color} hover:opacity-90 text-white border-0 shadow-lg`}>
                      <Link href={`/${locale}/opportunities/add?type=${typeKey}`}>
                        {t(`type_selector.${typeKey}.button`, { defaultValue: `Create ${typeKey.charAt(0).toUpperCase() + typeKey.slice(1)}` })}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full"
                      variant="outline"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      {t(`type_selector.${typeKey}.upgrade_button`, { defaultValue: 'Upgrade to Member' })}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )
  }

  // Mobile grid card renderer for square layout
  const renderMobileGridCard = (typeKey: string, config: any) => {
    const Icon = config.icon
    const AccentIcon = config.accentIcon
    const canAccess = !config.requiresMembership || userRole === 'member'
    const isHovered = hoveredType === typeKey

    return (
      <motion.div
        key={typeKey}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: Object.keys(opportunityTypeConfigs).indexOf(typeKey) * 0.1 }}
        onHoverStart={() => setHoveredType(typeKey)}
        onHoverEnd={() => setHoveredType(null)}
        className="group"
      >
        <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105 ${config.borderColor} cursor-pointer h-full flex flex-col`}>
          {/* Background gradient overlay */}
          <div className={`absolute inset-0 ${config.bgColor} transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-50'
          }`} />

          {/* Popular badge */}
          {config.popular && (
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs px-1.5 py-0.5">
                <Sparkles className="h-3 w-3 mr-1" />
                {tCommon('labels.popular', { defaultValue: 'Popular' })}
              </Badge>
            </div>
          )}

          {/* Membership required badge */}
          {config.requiresMembership && userRole === 'subscriber' && (
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300 text-xs px-1.5 py-0.5">
                <Crown className="h-3 w-3 mr-1" />
                {tCommon('membership.title', { defaultValue: 'Member' })}
              </Badge>
            </div>
          )}

          <CardContent className="relative z-10 p-4 flex flex-col flex-grow">
            <div className="flex flex-col items-center text-center space-y-3 flex-grow">
              {/* Icon */}
              <div className={`p-3 rounded-xl bg-gradient-to-r ${config.color} text-white shadow-lg`}>
                <Icon className="h-6 w-6" />
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold leading-tight">
                {t(`type_selector.${typeKey}.title`, { defaultValue: typeKey.charAt(0).toUpperCase() + typeKey.slice(1) })}
              </h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed overflow-hidden">
                {t(`type_selector.${typeKey}.description`, {
                  defaultValue: `Create ${typeKey} opportunities for the community.`
                })}
              </p>
            </div>

            {/* Action button - always at bottom */}
            <div className="mt-auto pt-3">
              {canAccess ? (
                <Button asChild className={`w-full bg-gradient-to-r ${config.color} hover:opacity-90 text-white border-0 shadow-lg text-xs h-8`}>
                  <Link href={`/${locale}/opportunities/add?type=${typeKey}`}>
                    {t(`type_selector.${typeKey}.button`, { defaultValue: `Create ${typeKey.charAt(0).toUpperCase() + typeKey.slice(1)}` })}
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full text-xs h-8"
                  variant="outline"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  {t(`type_selector.${typeKey}.upgrade_button`, { defaultValue: 'Upgrade to Member' })}
                </Button>
              )}
            </div>
          </CardContent>

          {/* Hover effect overlay */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${config.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
          />
        </Card>
      </motion.div>
    )
  }

  return (
    <>
      {/* Desktop Layout */}
      <motion.div 
        className="hidden md:block fixed inset-0 z-[8000] bg-background"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        data-modal="true"
        role="dialog"
        aria-label="Select opportunity type"
      >
        {/* Full-screen header with single close button */}
        <div className="relative w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-b">
          <div className="container mx-auto px-6 py-8">
            <div className="absolute right-6 top-6">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-white/80 backdrop-blur-sm border-2"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-4xl mx-auto"
            >
              <h1 className="text-4xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {t('type_selector.title', { defaultValue: 'What would you like to create?' })}
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Choose the type of opportunity you'd like to share with the Ring community. Each type is designed for different collaboration needs.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Full-screen scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {Object.entries(opportunityTypeConfigs).map(([typeKey, config]) =>
                renderOpportunityCard(typeKey, config)
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Layout - Slide-up animation optimized for iPhone 11 Pro */}
      <motion.div 
        className="md:hidden lg:hidden fixed inset-0 z-[8000] bg-background"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        data-modal="true"
        role="dialog"
        aria-label="Select opportunity type"
      >
        {/* Mobile header - Ergonomic for iPhone 11 Pro (375x812) */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 safe-area-inset">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('type_selector.title', { defaultValue: 'Create Opportunity' })}
              </span>
            </h1>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the type of opportunity you'd like to create
          </p>
        </div>

        {/* Mobile square grid layout - Optimized for iPhone 11 Pro (375x812) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
          <div className="max-w-md mx-auto">
            {/* 2x2 Grid - Perfectly sized for iPhone 11 Pro screen */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(opportunityTypeConfigs).map(([typeKey, config]) =>
                renderMobileGridCard(typeKey, config)
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* iPad Layout - Slide-right animation with 280px left indent */}
      <motion.div
        className="hidden md:block lg:hidden fixed inset-0 z-[8000] bg-background/95 backdrop-blur-sm"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        data-modal="true"
        role="dialog"
        aria-label="Select opportunity type"
      >
        {/* Left space indent (280px for sidebar) */}
        <div className="flex h-full">
          <div className="w-[280px] shrink-0" onClick={onClose} />
          
          {/* Sliding panel */}
          <div className="flex-1 bg-background border-l h-full overflow-y-auto">
            {/* iPad header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {t('type_selector.title', { defaultValue: 'Create Opportunity' })}
                  </span>
                </h1>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="h-10 w-10 rounded-full"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Choose the type of opportunity you'd like to create
              </p>
            </div>

            {/* iPad grid layout */}
            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-4 max-w-2xl">
                {Object.entries(opportunityTypeConfigs).map(([typeKey, config]) =>
                  renderOpportunityCard(typeKey, config)
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
