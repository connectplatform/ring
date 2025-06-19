'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { createOpportunity, OpportunityFormState } from '@/app/actions/opportunities'
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

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

function SubmitButton() {
  const { t } = useTranslation()
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t('saving') : t('save')}
    </Button>
  )
}

function AddOpportunityFormContent() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [entities, setEntities] = useState<any[]>([])

  const [state, formAction] = useActionState<OpportunityFormState | null, FormData>(
    createOpportunity,
    null
  )

  const userRole = session?.user?.role as UserRole || UserRole.SUBSCRIBER
  const isConfidentialAllowed = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN

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
      router.push(ROUTES.LOGIN(DEFAULT_LOCALE))
    }
  }, [status, router])

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (status === 'unauthenticated') {
    return <div>{t('redirecting')}</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('addOpportunity')}</CardTitle>
          <CardDescription>{t('addOpportunityDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            {/* Hidden field for tags */}
            <input type="hidden" name="tags" value={tags.join(',')} />

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

              <div>
                <Label htmlFor="type">{t('type')} *</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">{t('offer')}</SelectItem>
                    <SelectItem value="request">{t('request')}</SelectItem>
                  </SelectContent>
                </Select>
                {state?.fieldErrors?.type && (
                  <span className="text-destructive text-sm">{state.fieldErrors.type}</span>
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
                    <SelectItem value="marketing">{t('marketing')}</SelectItem>
                    <SelectItem value="development">{t('development')}</SelectItem>
                    <SelectItem value="design">{t('design')}</SelectItem>
                  </SelectContent>
                </Select>
                {state?.fieldErrors?.category && (
                  <span className="text-destructive text-sm">{state.fieldErrors.category}</span>
                )}
              </div>

              <div>
                <Label htmlFor="entityId">{t('entity')} *</Label>
                <Select name="entityId" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectEntity')} />
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
                <Label htmlFor="budget">{t('budget')}</Label>
                <Input
                  id="budget"
                  name="budget"
                  placeholder="e.g., $5,000 - $10,000"
                  className="mt-1"
                />
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
                    const opportunitiesRoute = ROUTES.OPPORTUNITIES(DEFAULT_LOCALE)
                    router.push(opportunitiesRoute)
                  }}
                >
                  {t('cancel')}
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

export default function AddOpportunityForm() {
  return (
    <AddOpportunityFormContent />
  )
} 