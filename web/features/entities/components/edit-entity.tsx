'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import type { SerializedEntity } from '@/features/entities/types'
import { updateEntity, type EntityFormState } from '@/app/_actions/entities'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { entityTypeConfigs } from '@/components/entities/entity-type-icons'
import { resolveEntityType } from '@/lib/entities/legacy-entity-type-map'

function SubmitButton() {
  const t = useTranslations('modules.entities')
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t('saving') : t('saveChanges', { defaultValue: 'Save changes' })}
    </Button>
  )
}

export default function EditEntityForm({
  entity,
  locale,
}: {
  entity: SerializedEntity
  locale: Locale
}) {
  const t = useTranslations('modules.entities')
  const [tags, setTags] = useState<string[]>(entity.tags ?? [])
  const [newTag, setNewTag] = useState('')

  const [state, formAction] = useActionState<EntityFormState | null, FormData>(
    (prev, formData) => updateEntity(prev, formData, locale),
    null,
  )

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const sortedEntityTypes = [...entityTypeConfigs].sort((a, b) =>
    t(`types.${a.id}`).localeCompare(t(`types.${b.id}`))
  )
  const resolvedType = resolveEntityType(entity.type)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('editEntity', { defaultValue: 'Edit entity' })}</CardTitle>
        <CardDescription>{entity.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="entityId" value={entity.id} />
          <input type="hidden" name="tags" value={tags.join(',')} />

          {state?.error && (
            <Alert variant="destructive">
              <AlertTitle>{t('error', { defaultValue: 'Error' })}</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('name')} *</Label>
              <Input id="name" name="name" required defaultValue={entity.name} className="mt-1" />
              {state?.fieldErrors?.name && (
                <span className="text-destructive text-sm">{state.fieldErrors.name}</span>
              )}
            </div>

            <div>
              <Label htmlFor="type">{t('type')} *</Label>
              <Select name="type" defaultValue={resolvedType} required>
                <SelectTrigger>
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
            </div>

            <div>
              <Label htmlFor="shortDescription">{t('shortDescription')} *</Label>
              <Textarea
                id="shortDescription"
                name="shortDescription"
                required
                rows={3}
                className="mt-1"
                defaultValue={entity.shortDescription}
              />
            </div>

            <div>
              <Label htmlFor="fullDescription">{t('fullDescription')}</Label>
              <Textarea
                id="fullDescription"
                name="fullDescription"
                rows={5}
                className="mt-1"
                defaultValue={entity.fullDescription ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="location">{t('location')} *</Label>
              <Input
                id="location"
                name="location"
                required
                className="mt-1"
                defaultValue={entity.location}
              />
            </div>

            <div>
              <Label htmlFor="website">{t('website')}</Label>
              <Input
                id="website"
                name="website"
                type="url"
                className="mt-1"
                defaultValue={entity.website ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="mt-1"
                defaultValue={entity.contactEmail ?? ''}
              />
            </div>

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
                          onClick={() => setTags(tags.filter((item) => item !== tag))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isConfidential"
                name="isConfidential"
                value="true"
                defaultChecked={entity.isConfidential}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isConfidential">{t('markAsConfidential')}</Label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href={ROUTES.MY_ENTITIES(locale)}>{t('cancel')}</Link>
              </Button>
              <SubmitButton />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
