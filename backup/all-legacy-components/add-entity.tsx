'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession, SessionProvider } from 'next-auth/react'
import { Entity } from '@/types'
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
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

/**
 * Type definition for the form data, excluding auto-generated fields
 */
type FormData = Omit<Entity, 'id' | 'dateAdded' | 'lastUpdated' | 'addedBy'> & {
  logo: FileList
}

/**
 * AddEntityFormContent component
 * Renders the form for adding a new entity
 * 
 * User steps:
 * 1. Fill in the required fields (name, type, short description, location)
 * 2. Optionally add website, contact email, and logo
 * 3. Add tags if desired
 * 4. Select visibility
 * 5. Submit the form
 * 
 * @returns {React.ReactElement} The rendered form
 */
function AddEntityFormContent() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>()

  /**
   * Handles form submission
   * @param {FormData} data - The form data to be submitted
   */
  const onSubmit = async (data: FormData) => {
    if (!session?.user) {
      setError(t('mustBeLoggedIn'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let logoUrl = ''
      if (data.logo && data.logo[0]) {
        const formData = new FormData()
        formData.append('file', data.logo[0])
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file')
        }
        const result = await uploadResponse.json()
        logoUrl = result.url
      }

      const entityData = {
        ...data,
        logo: logoUrl,
        tags,
        addedBy: session.user.id,
      }

      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entityData),
      })

      if (!response.ok) {
        throw new Error('Failed to add entity')
      }

      router.push(ROUTES.ENTITIES(DEFAULT_LOCALE))
    } catch (error) {
      console.error('Error adding entity:', error)
      setError(t('errorAddingEntity'))
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Adds a new tag to the list of tags
   */
  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  /**
   * Removes a tag from the list of tags
   * @param {string} tagToRemove - The tag to be removed
   */
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (status === 'unauthenticated') {
    router.push(ROUTES.LOGIN(DEFAULT_LOCALE))
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('addEntity')}</CardTitle>
          <CardDescription>{t('addEntityDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t('name')} *</Label>
                <Input
                  id="name"
                  {...register('name', { required: t('required') })}
                  className="mt-1"
                />
                {errors.name && (
                  <span className="text-destructive text-sm">{errors.name.message}</span>
                )}
              </div>

              <div>
                <Label htmlFor="type">{t('type')} *</Label>
                <Controller
                  name="type"
                  control={control}
                  rules={{ required: t('required') }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
                  )}
                />
                {errors.type && (
                  <span className="text-destructive text-sm">{errors.type.message}</span>
                )}
              </div>

              <div>
                <Label htmlFor="shortDescription">{t('entity.shortDescription')} *</Label>
                <Textarea
                  id="shortDescription"
                  {...register('shortDescription', { required: t('required') })}
                  className="mt-1"
                />
                {errors.shortDescription && (
                  <span className="text-destructive text-sm">{errors.shortDescription.message}</span>
                )}
              </div>

              <div>
                <Label htmlFor="location">{t('location')} *</Label>
                <Input
                  id="location"
                  {...register('location', { required: t('required') })}
                  className="mt-1"
                />
                {errors.location && (
                  <span className="text-destructive text-sm">{errors.location.message}</span>
                )}
              </div>

              <div>
                <Label htmlFor="website">{t('website')}</Label>
                <Input
                  id="website"
                  type="url"
                  {...register('website')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="contactEmail">{t('entity.contactEmail')}</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...register('contactEmail')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="logo">{t('entity.logo')}</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  {...register('logo')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>{t('tags')}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder={t('addTag')}
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="outline"
                  >
                    {t('add')}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-primary/10 text-primary px-2 py-1 rounded-md flex items-center gap-2"
                    >
                      {tag}
                      <Button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-primary hover:text-primary/80"
                        aria-label={t('remove', { tag: tag })}
                      >
                        ×
                      </Button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="visibility">{t('entity.visibility')} *</Label>
                <Controller
                  name="visibility"
                  control={control}
                  rules={{ required: t('required') }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectVisibility')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('public')}</SelectItem>
                        <SelectItem value="member">{t('membersOnly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * AddEntityForm component
 * Wraps the AddEntityFormContent with SessionProvider
 * 
 * @returns {React.ReactElement} The wrapped AddEntityFormContent
 */
export default function AddEntityForm() {
  return (
    <SessionProvider>
      <AddEntityFormContent />
    </SessionProvider>
  )
}

