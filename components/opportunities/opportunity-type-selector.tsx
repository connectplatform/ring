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

interface OpportunityTypeSelectorProps {
  onClose: () => void
  userRole: 'member' | 'subscriber'
  locale: Locale
}

// Enhanced opportunity type configurations with modern design
const opportunityTypeConfigs = {
  request: {
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    accentIcon: Target,
    popular: true,
    examples: ['freelancer', 'service', 'advice']
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
  },
  partnership: {
    icon: Handshake,
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    accentIcon: Sparkles,
    requiresMembership: true,
    examples: ['strategic', 'joint_venture', 'collaboration']
  },
  volunteer: {
    icon: Heart,
    color: 'from-red-500 to-pink-500',
    bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    accentIcon: Heart,
    requiresMembership: true,
    examples: ['community', 'nonprofit', 'social']
  },
  mentorship: {
    icon: Users,
    color: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    accentIcon: Users,
    requiresMembership: true,
    examples: ['career', 'skill', 'business']
  },
  resource: {
    icon: Share2,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-700 dark:text-orange-300',
    accentIcon: Share2,
    requiresMembership: true,
    examples: ['equipment', 'workspace', 'tools']
  },
  event: {
    icon: Calendar,
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
    accentIcon: Calendar,
    requiresMembership: true,
    examples: ['conference', 'workshop', 'networking']
  }
}

export function OpportunityTypeSelector({ onClose, userRole, locale }: OpportunityTypeSelectorProps) {
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  
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
  
  return (
    <div className="fixed inset-0 z-50 bg-background">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {Object.entries(opportunityTypeConfigs).map(([typeKey, config]) => 
              renderOpportunityCard(typeKey, config)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
