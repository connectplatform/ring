'use client'

import React, { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useSession } from 'next-auth/react'
import { createOpportunity, updateOpportunity, OpportunityFormState } from '@/app/_actions/opportunities'
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
import { hasConfidentialAccess, hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'

// Dynamically import Developer CV form
const DeveloperCVForm = dynamic(() => import('./developer-cv-form'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-32">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
  </div>
})

interface AddOpportunityFormProps {
  opportunityType?:
    | 'request'
    | 'offer'
    | 'partnership'
    | 'volunteer'
    | 'cv'
    | 'resource'
    | 'event'
    | 'ring_customization'
    | 'program'
    | 'scheduled_services'
    | 'collective_order'
    | 'bounty'
    | 'tender'
    | 'asset_rental'
    | 'job'
    | 'mentorship'
  initialOpportunity?: SerializedOpportunity
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

import { getOpportunityFormTypePreset } from '@/features/opportunities/lib/opportunity-type-presets'
import {
  OpportunityFormShell,
  OpportunityFormSection,
} from '@/components/opportunities/opportunity-form-shell'
import { davinciCtaPrimary } from '@/lib/ui/davinci'
import { getClientMainCurrency, getClientOpportunityBudgetCurrencies, getClientNativeTokenSymbol } from '@/lib/ring-config-client'
import type { SerializedOpportunity } from '@/features/opportunities/types'

function toDateInputValue(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
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
    },
    offer: {
      requiresEntity: true,
      showBudget: true,
      showSkills: true,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
    partnership: {
      requiresEntity: true,
      showBudget: false,
      showSkills: false,
      showDeadline: false,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
    },
    volunteer: {
      requiresEntity: true,
      showBudget: false,
      showSkills: true,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
    mentorship: {
      requiresEntity: false,
      showBudget: false,
      showSkills: true,
      showDeadline: false,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: false,
    },
    resource: {
      requiresEntity: false,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
    },
    event: {
      requiresEntity: true,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
    ring_customization: {
      requiresEntity: true,
      showBudget: true,
      showSkills: true,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
    },
    // Institution program / investment (cloned from offer; CRM ingest on create)
    program: {
      requiresEntity: true,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: false,
      showApplicationDeadline: true,
    },
    scheduled_services: {
      requiresEntity: false,
      showBudget: false,
      showSkills: true,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
    collective_order: {
      requiresEntity: true,
      showBudget: false,
      showSkills: false,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: false,
      showApplicationDeadline: false,
    },
    bounty: {
      requiresEntity: false,
      showBudget: false,
      showSkills: true,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
    tender: {
      requiresEntity: true,
      showBudget: true,
      showSkills: false,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: false,
      showApplicationDeadline: true,
    },
    asset_rental: {
      requiresEntity: true,
      showBudget: false,
      showSkills: false,
      showDeadline: true,
      showPriority: false,
      showMaxApplicants: false,
      showApplicationDeadline: false,
    },
    job: {
      requiresEntity: true,
      showBudget: true,
      showSkills: true,
      showDeadline: true,
      showPriority: true,
      showMaxApplicants: true,
      showApplicationDeadline: true,
    },
  }
  return configs[type as keyof typeof configs] || configs.request
}

function AddOpportunityFormContent({ opportunityType, initialOpportunity }: AddOpportunityFormProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session, status } = useSession()
  const router = useRouter()
  const isEdit = Boolean(initialOpportunity)
  const [tags, setTags] = useState<string[]>(initialOpportunity?.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    initialOpportunity?.requiredSkills ?? [],
  )
  const [newSkill, setNewSkill] = useState('')
  const [entities, setEntities] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const locale = useLocale() as Locale
  // React 19 useTransition for non-blocking tag/skill updates
  const [isPending, startTransition] = useTransition()

  const [state, formAction] = useActionState<OpportunityFormState | null, FormData>(
    (prevState: OpportunityFormState, formData: FormData) =>
      isEdit
        ? updateOpportunity(prevState, formData, locale)
        : createOpportunity(prevState, formData, locale),
    null,
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

  const userRole = resolveSessionUserRole(session?.user?.role)
  const isConfidentialAllowed = hasConfidentialAccess(userRole)

  const currentType =
    opportunityType ||
    initialOpportunity?.type ||
    (hasMemberPrivileges(userRole) || isConfidentialAllowed ? 'offer' : 'request')

  const formConfig = getFormConfig(currentType)
  const budgetCurrencies = getClientOpportunityBudgetCurrencies()
  const defaultBudgetCurrency =
    initialOpportunity?.budget?.currency || getClientMainCurrency()
  const initialEntityId =
    initialOpportunity?.contactInfo?.linkedEntity || initialOpportunity?.organizationId || ''
  const initialDescription =
    initialOpportunity?.fullDescription || initialOpportunity?.briefDescription || ''
  const initialContactEmail = initialOpportunity?.contactInfo?.contactAccount || ''

  // Load entities when component mounts — user id only (avoid session object churn)
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

    if (session?.user?.id) {
      void loadEntities()
    }
  }, [session?.user?.id])

  // Phase F / Part A: protected route — never router.push(LOGIN) on unauthenticated flash.
  // SessionAuthGuard + SSR SessionProvider hydrate own the gate.

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
    return <div>{t('redirecting', { defaultValue: 'Session required…' })}</div>
  }

  const typeConfig = getOpportunityFormTypePreset(currentType) ?? getOpportunityFormTypePreset('request')!
  const TypeIcon = typeConfig.icon

  // Use specialized Developer CV form for cv type (create only)
  if (currentType === 'cv' && !isEdit) {
    return <DeveloperCVForm locale={locale} />
  }

  return (
    <OpportunityFormShell
      icon={TypeIcon}
      title={
        isEdit
          ? t('form.editTitle', { defaultValue: 'Edit opportunity' })
          : t(`types.${currentType}.title`)
      }
      description={
        isEdit
          ? t('form.editDescription', {
              defaultValue: 'Update your listing details and save changes.',
            })
          : t(`types.${currentType}.description`)
      }
    >
      <form action={formAction} className="space-y-6">
        {isEdit && initialOpportunity && (
          <input type="hidden" name="opportunityId" value={initialOpportunity.id} />
        )}
        <input type="hidden" name="tags" value={tags.join(',')} />
        <input type="hidden" name="requiredSkills" value={requiredSkills.join(',')} />
        <input type="hidden" name="type" value={currentType} />
        <input type="hidden" name="applicantCount" value="0" />

        {state?.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[var(--davinci-beam)]" />
                <span>{t('title')} *</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={initialOpportunity?.title}
                placeholder={t(`form.titlePlaceholders.${currentType}`)}
                className="mt-2"
              />
              {state?.fieldErrors?.title && (
                <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="category" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--davinci-beam)]" />
                <span>{t('category')} *</span>
              </Label>
              <Select name="category" required defaultValue={initialOpportunity?.category}>
                <SelectTrigger className="mt-2">
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
                <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {state.fieldErrors.category}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--davinci-beam)]" />
                <span>{t('location')} *</span>
              </Label>
              <Input
                id="location"
                name="location"
                required
                defaultValue={initialOpportunity?.location}
                placeholder={t('locationPlaceholder')}
                className="mt-2"
              />
              {state?.fieldErrors?.location && (
                <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {state.fieldErrors.location}
                </p>
              )}
            </div>

            {currentType === 'program' && (
              <>
                <div>
                  <Label htmlFor="programSubtype" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--davinci-beam)]" />
                    <span>{t('form.programSubtype', { defaultValue: 'Subtype' })} *</span>
                  </Label>
                  <Select name="programSubtype" required defaultValue="program">
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={t('form.selectProgramSubtype', { defaultValue: 'Program or investment' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="program">{t('form.subtypeProgram', { defaultValue: 'Program' })}</SelectItem>
                      <SelectItem value="investment">{t('form.subtypeInvestment', { defaultValue: 'Investment' })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="instrument" className="flex items-center gap-2">
                    <span>{t('form.instrument', { defaultValue: 'Instrument' })}</span>
                  </Label>
                  <Select name="instrument" defaultValue="other">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grant">Grant</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="eligibility">{t('form.eligibility', { defaultValue: 'Eligibility' })}</Label>
                  <Input id="eligibility" name="eligibility" className="mt-2" placeholder="Who can apply…" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="applicationUrl">{t('form.applicationUrl', { defaultValue: 'Application URL' })}</Label>
                  <Input id="applicationUrl" name="applicationUrl" type="url" className="mt-2" placeholder="https://" />
                </div>
                <input type="hidden" name="geography" value="" />
              </>
            )}

            {currentType === 'collective_order' && (
              <>
                <div className="md:col-span-2 rounded-md border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                  {t('form.collectiveJarPayoutNote', {
                    nativeToken: getClientNativeTokenSymbol(),
                  })}
                </div>
                <div>
                  <Label htmlFor="slotCount">{t('form.slotCount')}</Label>
                  <Input id="slotCount" name="slotCount" type="number" min={2} defaultValue={10} className="mt-2" required />
                </div>
                <div>
                  <Label htmlFor="slotPrice">{t('form.slotPrice')}</Label>
                  <Input id="slotPrice" name="slotPrice" type="number" min={0.01} step="0.01" className="mt-2" required />
                </div>
                <div>
                  <Label htmlFor="slotCurrency">{t('form.slotCurrency')}</Label>
                  <Input id="slotCurrency" name="slotCurrency" defaultValue="USD" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="productSku">{t('form.productSku')}</Label>
                  <Input id="productSku" name="productSku" className="mt-2" />
                </div>
              </>
            )}

            {currentType === 'scheduled_services' && (
              <>
                <div>
                  <Label htmlFor="serviceCategory">{t('form.serviceCategory')}</Label>
                  <Input id="serviceCategory" name="serviceCategory" className="mt-2" placeholder="tutorship, consulting…" />
                </div>
                <div>
                  <Label htmlFor="durationMinutes">{t('form.durationMinutes')}</Label>
                  <Input id="durationMinutes" name="durationMinutes" type="number" min={15} defaultValue={60} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="pricePerSlot">{t('form.pricePerSlot')}</Label>
                  <Input id="pricePerSlot" name="pricePerSlot" type="number" min={0} step="0.01" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="bookingMode">{t('form.bookingMode')}</Label>
                  <Select name="bookingMode" defaultValue="interest" disabled>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interest">{t('form.bookingInterest')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="bookingMode" value="interest" />
                  <p className="mt-1 text-xs text-muted-foreground">{t('form.bookingHoldDeferred')}</p>
                </div>
              </>
            )}

            {currentType === 'bounty' && (
              <>
                <div>
                  <Label htmlFor="prizeAmount">{t('form.prizeAmount')}</Label>
                  <Input id="prizeAmount" name="prizeAmount" type="number" min={0} step="0.01" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="maxWinners">{t('form.maxWinners')}</Label>
                  <Input id="maxWinners" name="maxWinners" type="number" min={1} defaultValue={1} className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="acceptanceCriteria">{t('form.acceptanceCriteria')}</Label>
                  <Textarea id="acceptanceCriteria" name="acceptanceCriteria" rows={2} className="mt-2" />
                </div>
              </>
            )}

            {currentType === 'tender' && (
              <>
                <div>
                  <Label htmlFor="budgetCap">{t('form.budgetCap')}</Label>
                  <Input id="budgetCap" name="budgetCap" type="number" min={0} step="0.01" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="responseDeadline">{t('form.responseDeadline')}</Label>
                  <Input id="responseDeadline" name="responseDeadline" type="date" className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="evaluationNotes">{t('form.evaluationNotes')}</Label>
                  <Textarea id="evaluationNotes" name="evaluationNotes" rows={2} className="mt-2" />
                </div>
              </>
            )}

            {currentType === 'asset_rental' && (
              <>
                <div>
                  <Label htmlFor="assetKind">{t('form.assetKind')}</Label>
                  <Input id="assetKind" name="assetKind" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="unitsAvailable">{t('form.unitsAvailable')}</Label>
                  <Input id="unitsAvailable" name="unitsAvailable" type="number" min={1} defaultValue={1} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="pricePerPeriod">{t('form.pricePerPeriod')}</Label>
                  <Input id="pricePerPeriod" name="pricePerPeriod" type="number" min={0} step="0.01" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="periodUnit">{t('form.periodUnit')}</Label>
                  <Select name="periodUnit" defaultValue="day">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">{t('form.periodHour')}</SelectItem>
                      <SelectItem value="day">{t('form.periodDay')}</SelectItem>
                      <SelectItem value="week">{t('form.periodWeek')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {currentType === 'job' && (
              <>
                <div>
                  <Label htmlFor="employmentType">{t('form.employmentType')}</Label>
                  <Select name="employmentType" defaultValue="full_time">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">{t('form.fullTime')}</SelectItem>
                      <SelectItem value="part_time">{t('form.partTime')}</SelectItem>
                      <SelectItem value="contract">{t('form.contract')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="remotePolicy">{t('form.remotePolicy')}</Label>
                  <Input id="remotePolicy" name="remotePolicy" className="mt-2" placeholder="remote / hybrid / onsite" />
                </div>
                <div>
                  <Label htmlFor="salaryMin">{t('form.salaryMin')}</Label>
                  <Input id="salaryMin" name="salaryMin" type="number" min={0} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="salaryMax">{t('form.salaryMax')}</Label>
                  <Input id="salaryMax" name="salaryMax" type="number" min={0} className="mt-2" />
                </div>
              </>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[var(--davinci-beam)]" />
              <span>{t('description')} *</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={4}
              className="mt-2 resize-none"
              defaultValue={initialDescription}
              placeholder={t('form.descriptionPlaceholder')}
            />
            {state?.fieldErrors?.description && (
              <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                {state.fieldErrors.description}
              </p>
            )}
          </div>
        </div>

        {formConfig.requiresEntity && (
          <OpportunityFormSection title={t('organizationDetails')} icon={Users}>
            <div>
              <Label htmlFor="entityId" className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--davinci-beam)]" />
                <span>{t('entity', { defaultValue: 'Entity' })} *</span>
              </Label>
              <Select name="entityId" required defaultValue={initialEntityId || undefined}>
                <SelectTrigger className="mt-2">
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
                <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {state.fieldErrors.entityId}
                </p>
              )}
            </div>
          </OpportunityFormSection>
        )}

        <Collapsible
          open={showOptionalFields || isEdit}
          onOpenChange={setShowOptionalFields}
        >
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>{t('form.optionalDetails')}</span>
                <Badge variant="secondary" className="ml-2">
                  {showOptionalFields ? t('form.hide') : t('form.show')}
                </Badge>
              </div>
              {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-6">
                        {/* Requirements Field */}
                        <div>
                          <Label htmlFor="requirements" className="flex items-center space-x-2">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{t('requirements')}</span>
                            <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                          </Label>
                          <Textarea
                            id="requirements"
                            name="requirements"
                            rows={3}
                            className="mt-2 resize-none"
                            placeholder={t('form.requirementsPlaceholder')}
                          />
                          {state?.fieldErrors?.requirements && (
                            <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {state.fieldErrors.requirements}
                            </p>
                          )}
                        </div>

                        {/* Budget section - conditional based on opportunity type */}
                        {formConfig.showBudget && (
                          <div>
                            <Label className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span>{t(`form.budgetLabels.${currentType}`)}</span>
                              <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                            </Label>
                            <div className="mt-2 grid grid-cols-3 gap-3">
                              <Input
                                name="budgetMin"
                                type="number"
                                placeholder={t('min')}
                                defaultValue={initialOpportunity?.budget?.min ?? ''}
                              />
                              <Input
                                name="budgetMax"
                                type="number"
                                placeholder={t('max')}
                                defaultValue={initialOpportunity?.budget?.max ?? ''}
                              />
                              <Select name="budgetCurrency" defaultValue={defaultBudgetCurrency}>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('currency')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {budgetCurrencies.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                      {c.label}
                                    </SelectItem>
                                  ))}
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
                                <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                              </Label>
                              <Input
                                id="deadline"
                                name="deadline"
                                type="date"
                                className="mt-2 h-12"
                                defaultValue={toDateInputValue(initialOpportunity?.expirationDate)}
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
                                <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                              </Label>
                              <Input
                                id="applicationDeadline"
                                name="applicationDeadline"
                                type="date"
                                className="mt-2 h-12"
                                defaultValue={toDateInputValue(initialOpportunity?.applicationDeadline)}
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
                                <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                              </Label>
                              <Input
                                id="maxApplicants"
                                name="maxApplicants"
                                type="number"
                                placeholder={t('maxApplicantsPlaceholder', { defaultValue: 'Leave empty for unlimited' })}
                                className="mt-2 h-12"
                                defaultValue={initialOpportunity?.maxApplicants ?? ''}
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
                                <Badge variant="outline" className="text-xs">{t('form.optional')}</Badge>
                              </Label>
                              <Select
                                name="priority"
                                defaultValue={initialOpportunity?.priority || 'normal'}
                              >
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
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center justify-between border-t border-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)] pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              router.push(
                isEdit && initialOpportunity
                  ? ROUTES.OPPORTUNITY(initialOpportunity.id, locale)
                  : ROUTES.OPPORTUNITIES(locale),
              )
            }
            className="text-muted-foreground hover:text-foreground"
          >
            ← {t('cancel', { defaultValue: 'Cancel' })}
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(davinciCtaPrimary, 'px-6')}
          >
            {isSubmitting ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                {t('saving', { defaultValue: isEdit ? 'Saving...' : 'Creating...' })}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isEdit
                  ? t('form.saveChanges', { defaultValue: 'Save changes' })
                  : t('createOpportunity', { defaultValue: 'Create Opportunity' })}
              </>
            )}
          </Button>
        </div>
      </form>
    </OpportunityFormShell>
  )
}

export default function AddOpportunityForm({
  opportunityType,
  initialOpportunity,
}: AddOpportunityFormProps) {
  return (
    <AddOpportunityFormContent
      opportunityType={opportunityType}
      initialOpportunity={initialOpportunity}
    />
  )
}