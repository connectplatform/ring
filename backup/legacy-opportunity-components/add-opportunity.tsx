'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession, SessionProvider } from 'next-auth/react'
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
import { UserRole } from '@/features/auth/types' // Import UserRole enum

/**
 * FormData interface
 * Defines the structure of the form data for adding an opportunity
 */
type FormData = {
  title: string
  description: string
  category: string
  location: string
  expirationDate: string
  budget: {
    min: number
    max: number
    currency: string
  }
  contactInfo: {
    name: string
    email: string
    phone?: string
  }
  isConfidential: boolean
}

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

/**
 * add-opportunityForm component
 * Renders a form for adding a new opportunity
 * 
 * User steps:
 * 1. User fills out the form with opportunity details
 * 2. User can add tags and required skills
 * 3. User submits the form
 * 4. If successful, user is redirected to the opportunities page
 * 5. If there's an error, an error message is displayed
 */
function AddOpportunityForm() {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [newSkill, setNewSkill] = useState('')

  const userRole = session?.user?.role as UserRole || UserRole.SUBSCRIBER // Default to SUBSCRIBER

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>()

  const isConfidentialAllowed = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN

  /**
   * Handles form submission
   * @param data - The form data
   */
  const onSubmit = async (data: FormData) => {
    if (!session?.user) {
      setError(t('mustBeLoggedIn'))
      return
    }

    if (!isConfidentialAllowed && data.isConfidential) {
      setError(
        t('error.confidentialAccess', 'Only CONFIDENTIAL or ADMIN users can set opportunities as confidential.')
      )
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const opportunityData = {
        ...data,
        addedBy: session.user.id,
        tags,
        requiredSkills,
      }

      const response = await fetch('/api/opportunities/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(opportunityData),
      })

      if (!response.ok) {
        throw new Error('Failed to add opportunity')
      }

      router.push(ROUTES.OPPORTUNITIES(DEFAULT_LOCALE))
    } catch (error) {
      console.error('Error adding opportunity:', error)
      setError(t('errorAddingOpportunity'))
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Adds a new tag to the tags list
   */
  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  /**
   * Adds a new skill to the required skills list
   */
  const handleAddSkill = () => {
    if (newSkill && !requiredSkills.includes(newSkill)) {
      setRequiredSkills([...requiredSkills, newSkill])
      setNewSkill('')
    }
  }

  /**
   * Removes a tag from the tags list
   * @param tagToRemove - The tag to be removed
   */
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  /**
   * Removes a skill from the required skills list
   * @param skillToRemove - The skill to be removed
   */
  const removeSkill = (skillToRemove: string) => {
    setRequiredSkills(requiredSkills.filter(skill => skill !== skillToRemove))
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
          <CardTitle>{t('addOpportunity')}</CardTitle>
          <CardDescription>{t('addOpportunityDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">{t('title')} *</Label>
                <Input
                  id="title"
                  {...register('title', { required: t('required') })}
                  className="mt-1"
                />
                {errors.title && (
                  <span className="text-destructive text-sm">{errors.title.message}</span>
                )}
              </div>
              <div>
                <Label htmlFor="description">{t('description')} *</Label>
                <Textarea
                  id="description"
                  {...register('description', { required: t('required') })}
                  className="mt-1"
                />
                {errors.description && (
                  <span className="text-destructive text-sm">{errors.description.message}</span>
                )}
              </div>
              {/* Confidential Offer Toggle */}
              <div>
                <Label>{t('isConfidentialOffer')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="checkbox"
                    {...register('isConfidential')}
                    disabled={!isConfidentialAllowed}
                    className="h-4 w-4"
                  />
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
              </div>
              {/* Other form fields */}
              <div>
                <Label htmlFor="category">{t('category')} *</Label>
                <Select onValueChange={(value) => setValue('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">{t('technology')}</SelectItem>
                    <SelectItem value="business">{t('business')}</SelectItem>
                    <SelectItem value="finance">{t('finance')}</SelectItem>
                    {/* Add more categories as needed */}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">{t('location')} *</Label>
                <Input
                  id="location"
                  {...register('location', { required: t('required') })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expirationDate">{t('expirationDate')} *</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  {...register('expirationDate', { required: t('required') })}
                  className="mt-1"
                />
              </div>
              {/* Budget fields */}
              <div>
                <Label>{t('budget')}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    {...register('budget.min', { valueAsNumber: true })}
                    placeholder={t('min')}
                    type="number"
                  />
                  <Input
                    {...register('budget.max', { valueAsNumber: true })}
                    placeholder={t('max')}
                    type="number"
                  />
                  <Select onValueChange={(value) => setValue('budget.currency', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('currency')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Tags */}
              <div>
                <Label>{t('tags')}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder={t('addTag')}
                  />
                  <Button type="button" onClick={handleAddTag}>{t('add')}</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {tag}
                      <Button onClick={() => removeTag(tag)} className="ml-2 text-red-500">&times;</Button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Required Skills */}
              <div>
                <Label>{t('requiredSkills')}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder={t('addSkill')}
                  />
                  <Button type="button" onClick={handleAddSkill}>{t('add')}</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {requiredSkills.map((skill) => (
                    <span key={skill} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                      {skill}
                      <Button onClick={() => removeSkill(skill)} className="ml-2 text-red-500">&times;</Button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Contact Info */}
              <div>
                <Label>{t('contactInfo')}</Label>
                <div className="space-y-2 mt-1">
                  <Input {...register('contactInfo.name')} placeholder={t('name')} />
                  <Input {...register('contactInfo.email')} placeholder={t('email')} type="email" />
                  <Input {...register('contactInfo.phone')} placeholder={t('phone')} type="tel" />
                </div>
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
                  onClick={() => router.push(ROUTES.OPPORTUNITIES(DEFAULT_LOCALE))}
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
 * add-opportunityWrapper component
 * Wraps the add-opportunityForm with SessionProvider
 */
export default function AddOpportunityWrapper() {
  return (
    <SessionProvider>
      <AddOpportunityForm />
    </SessionProvider>
  )
}

