'use client'

import React, { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { useSession } from 'next-auth/react'
import { createOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  Plus, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Users, 
  Clock, 
  Target, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { UserRole } from '@/features/auth/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import dynamic from 'next/dynamic'

// Dynamically import Developer CV form
const DeveloperCVForm = dynamic(() => import('./developer-cv-form'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-32">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
  </div>
})

interface AddOpportunityFormProps {
  opportunityType?: 'request' | 'offer' | 'partnership' | 'volunteer' | 'cv' | 'resource' | 'event'
  locale: string
}

function SubmitButton() {
  const t = useTranslations('modules.opportunities')
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t('saving', { defaultValue: 'Saving...' }) : t('save', { defaultValue: 'Save' })}
    </Button>
  )
}

// Enhanced opportunity type configurations with visual styling
const opportunityTypeConfigs = {
  request: {
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Target,
    title: 'Create Request',
    description: 'Looking for services, advice, or collaboration from the community.'
  },
  offer: {
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    icon: Users,
    title: 'Create Offer',
    description: 'Post an official opportunity from your organization.'
  },
  partnership: {
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    icon: Sparkles,
    title: 'Create Partnership',
    description: 'Seek strategic partnerships and business collaborations.'
  },
  volunteer: {
    color: 'from-red-500 to-pink-500',
    bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    icon: Users,
    title: 'Create Volunteer Opportunity',
    description: 'Post volunteer opportunities for community causes.'
  },
  mentorship: {
    color: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    icon: Users,
    title: 'Create Mentorship',
    description: 'Offer or seek mentorship opportunities.'
  },
  resource: {
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-700 dark:text-orange-300',
    icon: Target,
    title: 'Create Resource',
    description: 'Share or request resources, tools, and equipment.'
  },
  event: {
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
    icon: Calendar,
    title: 'Create Event',
    description: 'Organize events and invite community participation.'
  }
}

// Helper function to get form configuration based on opportunity type
function getFormConfig(type: string) {
  const configs = {
    request: {
      requiresEntity: false,
      showBudget: true,
      showSkills: true,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
      budgetLabel: 'Budget Available',
      titlePlaceholder: 'What do you need help with?'
    },
    offer: {
      requiresEntity: true,
      showBudget: true,
      showSkills: true,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: true,
      showApplicationDeadline: true,
      budgetLabel: 'Salary/Payment Range',
      titlePlaceholder: 'Job title or position name'
    },
    partnership: {
      requiresEntity: true,
      showBudget: false,
      showSkills: false,
      showDeadline: false,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
      budgetLabel: 'Investment Range',
      titlePlaceholder: 'Partnership opportunity title'
    },
    volunteer: {
      requiresEntity: true,
      showBudget: false,
      showSkills: true,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: true,
      budgetLabel: 'Stipend (if any)',
      titlePlaceholder: 'Volunteer opportunity title'
    },
    mentorship: {
      requiresEntity: false,
      showBudget: false,
      showSkills: true,
      showDeadline: false,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: false,
      budgetLabel: 'Fee (if any)',
      titlePlaceholder: 'Mentorship program title'
    },
    resource: {
      requiresEntity: false,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
      budgetLabel: 'Cost/Fee',
      titlePlaceholder: 'Resource or equipment name'
    },
    event: {
      requiresEntity: true,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: true,
      budgetLabel: 'Ticket Price',
      titlePlaceholder: 'Event title'
    }
  }
  return configs[type as keyof typeof configs] || configs.request
}

function AddOpportunityFormContent({ opportunityType, locale }: AddOpportunityFormProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [entities, setEntities] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // React 19 useTransition for non-blocking tag/skill updates
  const [isPending, startTransition] = useTransition()

  const [state, formAction] = useActionState<OpportunityFormState | null, FormData>(
    createOpportunity,
    null
  )

  // Handle successful submission with redirect
  React.useEffect(() => {
    if (state?.success && state?.redirectUrl) {
      // Show success state briefly before redirecting
      setIsSubmitting(false)
      router.push(state.redirectUrl)
    } else if (state?.error) {
      setIsSubmitting(false)
    }
  }, [state, router])

  const userRole = session?.user?.role as UserRole || UserRole.SUBSCRIBER
  const isConfidentialAllowed = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
  
  // Determine the opportunity type - use prop if provided, otherwise default based on role
  const currentType = opportunityType || (userRole === UserRole.MEMBER || userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN ? 'offer' : 'request')
  
  // Get form configuration based on type
  const formConfig = getFormConfig(currentType)

  // Load entities when component mounts
  React.useEffect(() => {
    const loadEntities = async () => {
      try {
        const response = await fetch('/api/entities')
        if (response.ok) {
          const data = await response.json()
          setEntities(data.entities || [])
        }
      } catch (error) {
        console.error('Error loading entities:', error)
      }
    }

    if (session?.user) {
      loadEntities()
    }
  }, [session])

  // Use effect to handle redirect on client-side only
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN(locale as any))
    }
  }, [status, router, locale])

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleAddSkill = () => {
    if (newSkill && !requiredSkills.includes(newSkill)) {
      setRequiredSkills([...requiredSkills, newSkill])
      setNewSkill('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setRequiredSkills(requiredSkills.filter(skill => skill !== skillToRemove))
  }

  if (status === 'loading') {
    return <div>{t('loading', { defaultValue: 'Loading...' })}</div>
  }

  if (status === 'unauthenticated') {
    return <div>{t('redirecting', { defaultValue: 'Redirecting...' })}</div>
  }

  // Get current type configuration
  const typeConfig = opportunityTypeConfigs[currentType as keyof typeof opportunityTypeConfigs] || opportunityTypeConfigs.request
  const TypeIcon = typeConfig.icon

  // Use specialized Developer CV form for cv type
  if (currentType === 'cv') {
    return <DeveloperCVForm locale={locale as any} />
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background with subtle movement */}
      <div className="absolute inset-0 -z-10">
        <motion.div 
          className={`absolute inset-0 ${typeConfig.bgColor}`}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-white/30 dark:from-gray-900/50 dark:via-transparent dark:to-gray-900/30" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Enhanced header with icon and gradient */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${typeConfig.color} text-white shadow-lg mb-4`}>
            <TypeIcon className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold mb-2">
            <span className={`bg-gradient-to-r ${typeConfig.color} bg-clip-text text-transparent`}>
              {typeConfig.title}
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {typeConfig.description}
          </p>
        </motion.div>

        {/* Main form card with enhanced styling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card className={`backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-2 ${typeConfig.borderColor} shadow-2xl`}>
            <CardContent className="p-8">
          <form action={formAction} className="space-y-6">
            {/* Hidden field for tags */}
            <input type="hidden" name="tags" value={tags.join(',')} />
            {/* Hidden field for required skills */}
            <input type="hidden" name="requiredSkills" value={requiredSkills.join(',')} />
            {/* Hidden field for opportunity type */}
            <input type="hidden" name="type" value={currentType} />
            {/* Hidden field for applicant count initialization */}
            <input type="hidden" name="applicantCount" value="0" />

            {/* Global error message */}
            {state?.error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {/* Essential Fields Section */}
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center space-x-2 mb-4">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${typeConfig.color}`} />
                <h3 className="text-lg font-semibold">Essential Information</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Title Field with Icon */}
                <div className="md:col-span-2">
                  <Label htmlFor="title" className="flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>{t('title')} *</span>
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    placeholder={formConfig.titlePlaceholder}
                    className="mt-2 h-12 text-lg"
                  />
                  {state?.fieldErrors?.title && (
                    <motion.span 
                      className="text-destructive text-sm flex items-center space-x-1 mt-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{state.fieldErrors.title}</span>
                    </motion.span>
                  )}
                </div>

                {/* Category Field with Icon */}
                <div>
                  <Label htmlFor="category" className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>{t('category')} *</span>
                  </Label>
                  <Select name="category" required>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder={t('selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">{t('technology')}</SelectItem>
                      <SelectItem value="business">{t('business')}</SelectItem>
                      <SelectItem value="finance">{t('finance')}</SelectItem>
                      <SelectItem value="healthcare">{t('healthcare')}</SelectItem>
                      <SelectItem value="education">{t('education')}</SelectItem>
                      <SelectItem value="other">{t('other')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {state?.fieldErrors?.category && (
                    <motion.span 
                      className="text-destructive text-sm flex items-center space-x-1 mt-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{state.fieldErrors.category}</span>
                    </motion.span>
                  )}
                </div>

                {/* Location Field with Icon */}
                <div>
                  <Label htmlFor="location" className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>{t('location')} *</span>
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    required
                    placeholder={t('locationPlaceholder')}
                    className="mt-2 h-12"
                  />
                  {state?.fieldErrors?.location && (
                    <motion.span 
                      className="text-destructive text-sm flex items-center space-x-1 mt-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{state.fieldErrors.location}</span>
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Description Field */}
              <div>
                <Label htmlFor="description" className="flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span>{t('description')} *</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  className="mt-2 resize-none"
                  placeholder="Describe your opportunity in detail..."
                />
                {state?.fieldErrors?.description && (
                  <motion.span 
                    className="text-destructive text-sm flex items-center space-x-1 mt-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>{state.fieldErrors.description}</span>
                  </motion.span>
                )}
              </div>
            </motion.div>

            {/* Entity field for organizational opportunities */}
            {formConfig.requiresEntity && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-6"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${typeConfig.color}`} />
                  <h3 className="text-lg font-semibold">Organization Details</h3>
                </div>
                <div>
                  <Label htmlFor="entityId" className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>{t('entity', { defaultValue: 'Entity' })} *</span>
                  </Label>
                  <Select name="entityId" required>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder={t('selectEntity', { defaultValue: 'Select entity' })} />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state?.fieldErrors?.entityId && (
                    <motion.span 
                      className="text-destructive text-sm flex items-center space-x-1 mt-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{state.fieldErrors.entityId}</span>
                    </motion.span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Optional Fields Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-8"
            >
              <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-12 text-left"
                  >
                    <div className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>Optional Details</span>
                      <Badge variant="secondary" className="ml-2">
                        {showOptionalFields ? 'Hide' : 'Show'}
                      </Badge>
                    </div>
                    {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 mt-6">
                  <AnimatePresence>
                    {showOptionalFields && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-6"
                      >
                        {/* Requirements Field */}
                        <div>
                          <Label htmlFor="requirements" className="flex items-center space-x-2">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{t('requirements')}</span>
                            <Badge variant="outline" className="text-xs">Optional</Badge>
                          </Label>
                          <Textarea
                            id="requirements"
                            name="requirements"
                            rows={3}
                            className="mt-2 resize-none"
                            placeholder="List any specific requirements or qualifications..."
                          />
                          {state?.fieldErrors?.requirements && (
                            <motion.span 
                              className="text-destructive text-sm flex items-center space-x-1 mt-1"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                            >
                              <AlertCircle className="h-3 w-3" />
                              <span>{state.fieldErrors.requirements}</span>
                            </motion.span>
                          )}
                        </div>

                        {/* Budget section - conditional based on opportunity type */}
                        {formConfig.showBudget && (
                          <div>
                            <Label className="flex items-center space-x-2">
                              <DollarSign className="h-4 w-4" />
                              <span>{formConfig.budgetLabel}</span>
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            </Label>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                              <Input
                                name="budgetMin"
                                type="number"
                                placeholder={t('min')}
                                className="h-12"
                              />
                              <Input
                                name="budgetMax"
                                type="number"
                                placeholder={t('max')}
                                className="h-12"
                              />
                              <Select name="budgetCurrency" defaultValue="USD">
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder={t('currency')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="GBP">GBP</SelectItem>
                                  <SelectItem value="UAH">UAH</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {state?.fieldErrors?.budget && (
                              <motion.span 
                                className="text-destructive text-sm flex items-center space-x-1 mt-1"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                              >
                                <AlertCircle className="h-3 w-3" />
                                <span>{state.fieldErrors.budget}</span>
                              </motion.span>
                            )}
                          </div>
                        )}

                        {/* Deadline fields in a grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Deadline field - conditional */}
                          {formConfig.showDeadline && (
                            <div>
                              <Label htmlFor="deadline" className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>{t('deadline')}</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </Label>
                              <Input
                                id="deadline"
                                name="deadline"
                                type="date"
                                className="mt-2 h-12"
                              />
                              {state?.fieldErrors?.deadline && (
                                <motion.span 
                                  className="text-destructive text-sm flex items-center space-x-1 mt-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{state.fieldErrors.deadline}</span>
                                </motion.span>
                              )}
                            </div>
                          )}

                          {/* Application deadline - for offers and some other types */}
                          {formConfig.showApplicationDeadline && (
                            <div>
                              <Label htmlFor="applicationDeadline" className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>{t('applicationDeadline', { defaultValue: 'Application Deadline' })}</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </Label>
                              <Input
                                id="applicationDeadline"
                                name="applicationDeadline"
                                type="date"
                                className="mt-2 h-12"
                              />
                              {state?.fieldErrors?.applicationDeadline && (
                                <motion.span 
                                  className="text-destructive text-sm flex items-center space-x-1 mt-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{state.fieldErrors.applicationDeadline}</span>
                                </motion.span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Additional options in a grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Max applicants - for certain opportunity types */}
                          {formConfig.showMaxApplicants && (
                            <div>
                              <Label htmlFor="maxApplicants" className="flex items-center space-x-2">
                                <Users className="h-4 w-4" />
                                <span>{t('maxApplicants', { defaultValue: 'Maximum Applicants' })}</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </Label>
                              <Input
                                id="maxApplicants"
                                name="maxApplicants"
                                type="number"
                                placeholder={t('maxApplicantsPlaceholder', { defaultValue: 'Leave empty for unlimited' })}
                                className="mt-2 h-12"
                              />
                              {state?.fieldErrors?.maxApplicants && (
                                <motion.span 
                                  className="text-destructive text-sm flex items-center space-x-1 mt-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{state.fieldErrors.maxApplicants}</span>
                                </motion.span>
                              )}
                            </div>
                          )}

                          {/* Priority - for offers and urgent opportunities */}
                          {formConfig.showPriority && (
                            <div>
                              <Label htmlFor="priority" className="flex items-center space-x-2">
                                <Target className="h-4 w-4" />
                                <span>{t('priority', { defaultValue: 'Priority' })}</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </Label>
                              <Select name="priority" defaultValue="normal">
                                <SelectTrigger className="mt-2 h-12">
                                  <SelectValue placeholder={t('selectPriority', { defaultValue: 'Select priority' })} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">{t('priorityLow', { defaultValue: 'Low' })}</SelectItem>
                                  <SelectItem value="normal">{t('priorityNormal', { defaultValue: 'Normal' })}</SelectItem>
                                  <SelectItem value="urgent">{t('priorityUrgent', { defaultValue: 'Urgent' })}</SelectItem>
                                </SelectContent>
                              </Select>
                              {state?.fieldErrors?.priority && (
                                <motion.span 
                                  className="text-destructive text-sm flex items-center space-x-1 mt-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{state.fieldErrors.priority}</span>
                                </motion.span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>

            {/* Enhanced Submit Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push(`/${locale}/opportunities`)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← {t('cancel', { defaultValue: 'Cancel' })}
                </Button>
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-8 py-3 h-12 bg-gradient-to-r ${typeConfig.color} hover:opacity-90 text-white border-0 shadow-lg`}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="mr-2"
                        >
                          <Sparkles className="h-4 w-4" />
                        </motion.div>
                        {t('saving', { defaultValue: 'Creating...' })}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {t('createOpportunity', { defaultValue: 'Create Opportunity' })}
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default function AddOpportunityForm({ opportunityType, locale }: AddOpportunityFormProps) {
  return (
    <AddOpportunityFormContent opportunityType={opportunityType} locale={locale} />
  )
} 