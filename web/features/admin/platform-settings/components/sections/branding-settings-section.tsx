'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PlatformBrandingData } from '@/features/admin/platform-settings/types'
import type { PlatformSettingsActionState } from '@/app/_actions/platform-settings'
import { useState } from 'react'

const FEATURE_KEYS = ['news', 'opportunities', 'entities', 'messaging', 'admin'] as const

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? '…' : label}
    </Button>
  )
}

type BrandingSettingsSectionProps = {
  initial: PlatformBrandingData
  updateAction: (
    prev: PlatformSettingsActionState | null,
    formData: FormData,
  ) => Promise<PlatformSettingsActionState>
}

export function BrandingSettingsSection({ initial, updateAction }: BrandingSettingsSectionProps) {
  const t = useTranslations('modules.admin.settings.sections.branding')
  const tBase = useTranslations('modules.admin.settings')
  const [state, formAction] = useActionState(updateAction, null)
  const [defaultTheme, setDefaultTheme] = useState(initial.theme.default)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {state && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{tBase('projectName')}</Label>
              <Input id="name" name="name" defaultValue={initial.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDescription">{tBase('shortDescription')}</Label>
              <Input
                id="shortDescription"
                name="shortDescription"
                defaultValue={initial.shortDescription || ''}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="extendedDescription">{tBase('extendedDescription')}</Label>
              <Textarea
                id="extendedDescription"
                name="extendedDescription"
                rows={3}
                defaultValue={initial.extendedDescription || ''}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="colorPrimary">{tBase('colors.primary')}</Label>
              <Input
                id="colorPrimary"
                name="colorPrimary"
                type="color"
                defaultValue={initial.brand.colors.primary}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="colorBackground">{tBase('colors.background')}</Label>
              <Input
                id="colorBackground"
                name="colorBackground"
                type="color"
                defaultValue={initial.brand.colors.background}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="colorForeground">{tBase('colors.foreground')}</Label>
              <Input
                id="colorForeground"
                name="colorForeground"
                type="color"
                defaultValue={initial.brand.colors.foreground}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="colorAccent">{tBase('colors.accent')}</Label>
              <Input
                id="colorAccent"
                name="colorAccent"
                type="color"
                defaultValue={initial.brand.colors.accent}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTheme">{tBase('defaultTheme')}</Label>
              <Select value={defaultTheme} onValueChange={(v) => setDefaultTheme(v as typeof defaultTheme)}>
                <SelectTrigger id="defaultTheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{tBase('theme.light')}</SelectItem>
                  <SelectItem value="dark">{tBase('theme.dark')}</SelectItem>
                  <SelectItem value="system">{tBase('theme.system')}</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="defaultTheme" value={defaultTheme} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{tBase('features')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    name={`feature_${key}`}
                    value="on"
                    defaultChecked={initial.features[key] ?? true}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customEntityCategories">{tBase('customEntityCategories')}</Label>
            <Textarea
              id="customEntityCategories"
              name="customEntityCategories"
              rows={3}
              placeholder={tBase('customEntityPlaceholder')}
              defaultValue={(initial.customEntityCategories || []).join('\n')}
            />
          </div>

          <div className="flex justify-end pt-2">
            <SaveButton label={tBase('save')} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
