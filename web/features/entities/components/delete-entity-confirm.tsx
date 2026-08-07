'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import type { SerializedEntity } from '@/features/entities/types'
import { deleteEntity, type EntityFormState } from '@/app/_actions/entities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

function DeleteButton() {
  const t = useTranslations('modules.entities')
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? t('deleting', { defaultValue: 'Deleting…' }) : t('deleteEntity')}
    </Button>
  )
}

export default function DeleteEntityConfirm({
  entity,
  locale,
}: {
  entity: SerializedEntity
  locale: Locale
}) {
  const t = useTranslations('modules.entities')

  const [state, formAction] = useActionState<EntityFormState | null, FormData>(
    (prev, formData) => deleteEntity(prev, formData, locale),
    null,
  )

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{t('deleteEntityTitle', { defaultValue: 'Delete entity' })}</CardTitle>
        <CardDescription>
          {t('deleteEntityDescription', {
            defaultValue: 'This permanently removes "{name}" from Ring.',
            name: entity.name,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="entityId" value={entity.id} />
          <input type="hidden" name="confirmDelete" value="true" />

          {state?.error && (
            <Alert variant="destructive">
              <AlertTitle>{t('error', { defaultValue: 'Error' })}</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmDeleteCheckbox"
              required
              className="rounded border-gray-300"
            />
            <Label htmlFor="confirmDeleteCheckbox">
              {t('deleteConfirmCheckbox', {
                defaultValue: 'I understand this cannot be undone',
              })}
            </Label>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <Button type="button" variant="outline" asChild>
              <Link href={ROUTES.ENTITY(entity.id, locale)}>{t('cancel')}</Link>
            </Button>
            <DeleteButton />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
