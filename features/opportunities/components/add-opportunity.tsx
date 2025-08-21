'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { X } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'

interface AddOpportunityFormProps {
  opportunityType?: 'request' | 'offer'
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

function AddOpportunityFormContent({ opportunityType, locale }: AddOpportunityFormProps) {
  const t = useTranslations('modules.opportunities')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [entities, setEntities] = useState<any[]>([])

  const [state, formAction] = useActionState<OpportunityFormState | null, FormData>(
    createOpportunity,
    null
  )

  const userRole = session?.user?.role as UserRole || UserRole.SUBSCRIBER
  const isConfidentialAllowed = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
  
  // Determine the opportunity type - use prop if provided, otherwise default based on role
  const currentType = opportunityType || (userRole === UserRole.MEMBER || userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN ? 'offer' : 'request')

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
      router.push(`/${locale}/auth/login`)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {currentType === 'request' 
              ? t('addRequest', { defaultValue: 'Create Request' })
              : t('addOffer', { defaultValue: 'Create Offer' })
            }
          </CardTitle>
          <CardDescription>
            {currentType === 'request'
              ? t('addRequestDescription', { defaultValue: 'Looking for services, advice, or collaboration from the community.' })
              : t('addOfferDescription', { defaultValue: 'Post an official opportunity from your organization.' })
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            {/* Hidden field for tags */}
            <input type="hidden" name="tags" value={tags.join(',')} />
            {/* Hidden field for required skills */}
            <input type="hidden" name="requiredSkills" value={requiredSkills.join(',')} />
            {/* Hidden field for opportunity type */}
            <input type="hidden" name="type" value={currentType} />

            {/* Global error message */}
            {state?.error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">{t('title')} *</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  className="mt-1"
                />
                {state?.fieldErrors?.title && (
                  <span className="text-destructive text-sm">{state.fieldErrors.title}</span>
                )}
              </div>

              {/* Type field is now hidden and set automatically */}

              <div>
                <Label htmlFor="description">{t('description')} *</Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  className="mt-1"
                />
                {state?.fieldErrors?.description && (
                  <span className="text-destructive text-sm">{state.fieldErrors.description}</span>
                )}
              </div>

              <div>
                <Label htmlFor="category">{t('category')} *</Label>
                <Select name="category" required>
                  <SelectTrigger>
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
                  <span className="text-destructive text-sm">{state.fieldErrors.category}</span>
                )}
              </div>

              <div>
                <Label htmlFor="location">{t('location')} *</Label>
                <Input
                  id="location"
                  name="location"
                  required
                  placeholder={t('locationPlaceholder')}
                  className="mt-1"
                />
                {state?.fieldErrors?.location && (
                  <span className="text-destructive text-sm">{state.fieldErrors.location}</span>
                )}
              </div>

              {/* Entity field only for offers */}
              {currentType === 'offer' && (
                <div>
                  <Label htmlFor="entityId">{t('entity', { defaultValue: 'Entity' })} *</Label>
                  <Select name="entityId" required>
                    <SelectTrigger>
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
                    <span className="text-destructive text-sm">{state.fieldErrors.entityId}</span>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="requirements">{t('requirements')}</Label>
                <Textarea
                  id="requirements"
                  name="requirements"
                  rows={3}
                  className="mt-1"
                />
                {state?.fieldErrors?.requirements && (
                  <span className="text-destructive text-sm">{state.fieldErrors.requirements}</span>
                )}
              </div>

              <div>
                <Label>{t('budget')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    name="budgetMin"
                    type="number"
                    placeholder={t('min')}
                    className="mt-1"
                  />
                  <Input
                    name="budgetMax"
                    type="number"
                    placeholder={t('max')}
                    className="mt-1"
                  />
                  <Select name="budgetCurrency" defaultValue="USD">
                    <SelectTrigger>
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
                  <span className="text-destructive text-sm">{state.fieldErrors.budget}</span>
                )}
              </div>

              <div>
                <Label htmlFor="deadline">{t('deadline')}</Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="date"
                  className="mt-1"
                />
                {state?.fieldErrors?.deadline && (
                  <span className="text-destructive text-sm">{state.fieldErrors.deadline}</span>
                )}
              </div>

              <div>
                <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  placeholder="contact@example.com"
                  className="mt-1"
                />
                {state?.fieldErrors?.contactEmail && (
                  <span className="text-destructive text-sm">{state.fieldErrors.contactEmail}</span>
                )}
              </div>

              {/* Required Skills section */}
              <div>
                <Label>{t('requiredSkills')}</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder={t('addSkill')}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                    />
                    <Button type="button" onClick={handleAddSkill} variant="outline">
                      {t('add')}
                    </Button>
                  </div>
                  {requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {requiredSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                          {skill}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeSkill(skill)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags section */}
              <div>
                <Label>{t('tags')}</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder={t('addTag')}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline">
                      {t('add')}
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Confidential checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isConfidential"
                  name="isConfidential"
                  value="true"
                  disabled={!isConfidentialAllowed}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isConfidential" className={!isConfidentialAllowed ? 'text-gray-400' : ''}>
                  {t('markAsConfidential')}
                </Label>
                {!isConfidentialAllowed && (
                  <a
                    href="/membership/subscription"
                    target="_blank"
                    className="underline text-sm text-blue-600 hover:text-blue-800"
                  >
                    {t('learnMoreaboutConfidential')}
                  </a>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    router.push(`/${locale}/opportunities`)
                  }}
                >
                  {t('cancel', { defaultValue: 'Cancel' })}
                </Button>
                <SubmitButton />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AddOpportunityForm({ opportunityType, locale }: AddOpportunityFormProps) {
  return (
    <AddOpportunityFormContent opportunityType={opportunityType} locale={locale} />
  )
} 