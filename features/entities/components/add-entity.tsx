'use client'

import React, { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import type { Locale } from '@/i18n/shared'
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Sparkles, X } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { entityTypeConfigs } from '@/components/entities/entity-type-icons'

const DEFAULT_LOCALE = 'en' as const

function SubmitButton() {
  const t = useTranslations('modules.entities')
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="min-w-[9rem] shadow-sm">
      {pending ? (
        t('saving')
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          {t('save')}
        </>
      )}
    </Button>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm mt-1.5">{message}</p>
}

/** DaVinci glass brief — title + lead only (vendor-start / davinci-ui-pattern). */
function EntityOnboardingBrief() {
  const t = useTranslations('modules.entities.addEntity.onboarding')

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex items-start gap-4 rounded-2xl border border-border/50 bg-gradient-to-br from-primary/5 via-background/80 to-background p-6 backdrop-blur-sm lg:p-8"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/75 shadow-md">
        <Building2 className="h-7 w-7 text-primary-foreground" />
      </div>
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent lg:text-2xl">
          {t('title')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground lg:text-[15px]">{t('lead')}</p>
      </div>
    </motion.div>
  )
}

function AddEntityFormContent({ locale }: { locale: Locale } = { locale: DEFAULT_LOCALE }) {
  const t = useTranslations('modules.entities')
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  const [state, formAction] = useActionState<EntityFormState | null, FormData>(
    (prevState: EntityFormState | null, formData: FormData) =>
      createEntity(prevState, formData, locale),
    null
  )

  const sortedEntityTypes = [...entityTypeConfigs].sort((a, b) =>
    t(`types.${a.id}`).localeCompare(t(`types.${b.id}`))
  )

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN(locale))
    }
  }, [status, router, locale])

  if (status === 'loading') {
    return <div className="px-4 py-8 text-muted-foreground">{t('loading')}</div>
  }

  if (status === 'unauthenticated') {
    return <div className="px-4 py-8 text-muted-foreground">{t('redirecting')}</div>
  }

  if (session?.user?.role === UserRole.subscriber) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4 text-center">
        <Alert>
          <AlertTitle>{t('upgradeToMemberToCreateEntities')}</AlertTitle>
          <AlertDescription>{t('subscriberUpgradeMessage')}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => router.push(ROUTES.MEMBERSHIP(locale))}>
            {t('upgradeToBeMember')}
          </Button>
          <Button variant="outline" onClick={() => router.push(ROUTES.ENTITIES(locale))}>
            {t('backToEntities')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:max-w-4xl lg:px-8 lg:py-8">
      <EntityOnboardingBrief />

      <motion.form
        action={formAction}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        <input type="hidden" name="tags" value={tags.join(',')} />

        {state?.error && (
          <Alert variant="destructive">
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              {t('name')} <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required className="h-11" />
            <FieldError message={state?.fieldErrors?.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">
              {t('type')} <span className="text-destructive">*</span>
            </Label>
            <Select name="type" required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('selectType')} />
              </SelectTrigger>
              <SelectContent className="max-h-[min(24rem,70vh)]">
                {sortedEntityTypes.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {t(`types.${config.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={state?.fieldErrors?.type} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortDescription" className="text-sm font-medium">
            {t('shortDescription')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="shortDescription"
            name="shortDescription"
            required
            rows={3}
            className="min-h-[5.5rem] resize-y"
          />
          <FieldError message={state?.fieldErrors?.shortDescription} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullDescription" className="text-sm font-medium">
            {t('fullDescription')}
          </Label>
          <Textarea
            id="fullDescription"
            name="fullDescription"
            rows={5}
            className="min-h-[8rem] resize-y"
          />
          <FieldError message={state?.fieldErrors?.fullDescription} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8">
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium">
              {t('location')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location"
              name="location"
              required
              placeholder={t('locationPlaceholder')}
              className="h-11"
            />
            <FieldError message={state?.fieldErrors?.location} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="text-sm font-medium">
              {t('website')}
            </Label>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://"
              className="h-11"
            />
            <FieldError message={state?.fieldErrors?.website} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium">
              {t('contactEmail')}
            </Label>
            <Input id="contactEmail" name="contactEmail" type="email" className="h-11" />
            <FieldError message={state?.fieldErrors?.contactEmail} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-sm font-medium">
              {t('logo')}
            </Label>
            <Input id="logo" name="logo" type="file" accept="image/*" className="h-11 pt-2" />
            <FieldError message={state?.fieldErrors?.logo} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('tags')}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t('addTag')}
              className="h-11"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <Button type="button" onClick={handleAddTag} variant="outline" className="shrink-0 h-11">
              {t('add')}
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8 lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="visibility" className="text-sm font-medium">
              {t('entity.visibility')} <span className="text-destructive">*</span>
            </Label>
            <Select name="visibility" defaultValue="public" required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('selectVisibility')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('public')}</SelectItem>
                <SelectItem value="member">{t('membersOnly')}</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={state?.fieldErrors?.visibility} />
          </div>

          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="isConfidential"
              name="isConfidential"
              value="true"
              className="rounded border-border"
            />
            <Label htmlFor="isConfidential" className="text-sm font-medium cursor-pointer">
              {t('markAsConfidential')}
            </Label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(ROUTES.ENTITIES(locale))}
          >
            {t('cancel')}
          </Button>
          <SubmitButton />
        </div>
      </motion.form>
    </div>
  )
}

export default function AddEntityForm({ locale }: { locale: Locale } = { locale: DEFAULT_LOCALE }) {
  return <AddEntityFormContent locale={locale} />
}
