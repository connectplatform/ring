'use client'

import React, { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { createEntity, EntityFormState } from '@/app/_actions/entities'
import { Button } from '@/components/ui/button'
import { UserRole } from '@/features/auth/types'
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

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

function SubmitButton() {
  const t = useTranslations('modules.entities')
  const { pending } = useFormStatus()
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t('saving') : t('save')}
    </Button>
  )
}

function AddEntityFormContent() {
  const t = useTranslations('modules.entities')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const locale = DEFAULT_LOCALE

  const [state, formAction] = useActionState<EntityFormState | null, FormData>(
    createEntity,
    null
  )

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  // Use effect to handle redirect on client-side only
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN(DEFAULT_LOCALE))
    }
  }, [status, router])

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (status === 'unauthenticated') {
    return <div>{t('redirecting')}</div>
  }
  
  // Check if user is a subscriber (needs to upgrade)
  if (session?.user?.role === UserRole.SUBSCRIBER) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('addMyEntity')}</CardTitle>
            <CardDescription>Upgrade to Member to Create Entities</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              As a subscriber, you can view entities but need to upgrade to member status to create your own.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => router.push(ROUTES.MEMBERSHIP(locale))}>
                Upgrade to Member
              </Button>
              <Button variant="outline" onClick={() => router.push(ROUTES.ENTITIES(locale))}>
                Back to Entities
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('addMyEntity')}</CardTitle>
          <CardDescription>{t('addEntityDescription')}</CardDescription>
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
                <Label htmlFor="name">{t('name')} *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  className="mt-1"
                />
                {state?.fieldErrors?.name && (
                  <span className="text-destructive text-sm">{state.fieldErrors.name}</span>
                )}
              </div>

              <div>
                <Label htmlFor="type">{t('type')} *</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="softwareDevelopment">{t('categories.softwareDevelopment')}</SelectItem>
                    <SelectItem value="manufacturing">{t('categories.manufacturing')}</SelectItem>
                    <SelectItem value="technologyCenter">{t('categories.technologyCenter')}</SelectItem>
                    <SelectItem value="other">{t('categories.other')}</SelectItem>
                  </SelectContent>
                </Select>
                {state?.fieldErrors?.type && (
                  <span className="text-destructive text-sm">{state.fieldErrors.type}</span>
                )}
              </div>

              <div>
                <Label htmlFor="shortDescription">{t('shortDescription')} *</Label>
                <Textarea
                  id="shortDescription"
                  name="shortDescription"
                  required
                  rows={3}
                  className="mt-1"
                />
                {state?.fieldErrors?.shortDescription && (
                  <span className="text-destructive text-sm">{state.fieldErrors.shortDescription}</span>
                )}
              </div>

              <div>
                <Label htmlFor="fullDescription">{t('fullDescription')}</Label>
                <Textarea
                  id="fullDescription"
                  name="fullDescription"
                  rows={5}
                  className="mt-1"
                />
                {state?.fieldErrors?.fullDescription && (
                  <span className="text-destructive text-sm">{state.fieldErrors.fullDescription}</span>
                )}
              </div>

              <div>
                <Label htmlFor="location">{t('location')} *</Label>
                <Input
                  id="location"
                  name="location"
                  required
                  className="mt-1"
                />
                {state?.fieldErrors?.location && (
                  <span className="text-destructive text-sm">{state.fieldErrors.location}</span>
                )}
              </div>

              <div>
                <Label htmlFor="website">{t('website')}</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://"
                  className="mt-1"
                />
                {state?.fieldErrors?.website && (
                  <span className="text-destructive text-sm">{state.fieldErrors.website}</span>
                )}
              </div>

              <div>
                <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  className="mt-1"
                />
                {state?.fieldErrors?.contactEmail && (
                  <span className="text-destructive text-sm">{state.fieldErrors.contactEmail}</span>
                )}
              </div>

              <div>
                <Label htmlFor="logo">{t('logo')}</Label>
                <Input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="mt-1"
                />
                {state?.fieldErrors?.logo && (
                  <span className="text-destructive text-sm">{state.fieldErrors.logo}</span>
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

              {/* Visibility field */}
              <div>
                <Label htmlFor="visibility">{t('entity.visibility')} *</Label>
                <Select name="visibility" defaultValue="public" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectVisibility')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('public')}</SelectItem>
                    <SelectItem value="member">{t('membersOnly')}</SelectItem>
                  </SelectContent>
                </Select>
                {state?.fieldErrors?.visibility && (
                  <span className="text-destructive text-sm">{state.fieldErrors.visibility}</span>
                )}
              </div>

              {/* Confidential checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isConfidential"
                  name="isConfidential"
                  value="true"
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isConfidential">{t('markAsConfidential')}</Label>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const entitiesRoute = ROUTES.ENTITIES(DEFAULT_LOCALE)
                    router.push(entitiesRoute)
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

export default function AddEntityForm() {
  return (
    <AddEntityFormContent />
  )
} 