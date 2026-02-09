import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { UserRole } from '@/features/auth/user-role'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { connection } from 'next/server'


export default async function PlatformSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await loadTranslations(validLocale)
  const session = await auth()

  if (!session?.user) redirect(`/${validLocale}/login`)
  if (session.user.role !== UserRole.SUPERADMIN) redirect(`/${validLocale}/unauthorized`)

  return (
    <AdminWrapper locale={validLocale} pageContext="settings">
    <div className="container mx-auto px-0 py-0">
      <Card>
        <CardHeader>
          <CardTitle>{t.modules.admin.settings.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">{t.modules.admin.settings.projectName}</Label>
              <Input id="projectName" placeholder="My Platform" defaultValue="Ring Platform" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDescription">{t.modules.admin.settings.shortDescription}</Label>
              <Input id="shortDescription" placeholder="One line blurb" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="extendedDescription">{t.modules.admin.settings.extendedDescription}</Label>
              <Textarea id="extendedDescription" placeholder="Detailed description shown on landing pages" rows={4} />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <Label>{t.modules.admin.settings.logo}</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input type="file" accept="image/*" />
                <Button variant="outline">{t.modules.admin.settings.upload}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="space-y-2">
                <Label htmlFor="colorPrimary">{t.modules.admin.settings.colors.primary}</Label>
                <Input id="colorPrimary" type="color" defaultValue="#3b82f6" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorBackground">{t.modules.admin.settings.colors.background}</Label>
                <Input id="colorBackground" type="color" defaultValue="#0b0f1a" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorForeground">{t.modules.admin.settings.colors.foreground}</Label>
                <Input id="colorForeground" type="color" defaultValue="#e5e7eb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorAccent">{t.modules.admin.settings.colors.accent}</Label>
                <Input id="colorAccent" type="color" defaultValue="#22c55e" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTheme">{t.modules.admin.settings.defaultTheme}</Label>
                <Select defaultValue="system">
                  <SelectTrigger id="defaultTheme">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t.modules.admin.settings.theme.light}</SelectItem>
                    <SelectItem value="dark">{t.modules.admin.settings.theme.dark}</SelectItem>
                    <SelectItem value="system">{t.modules.admin.settings.theme.system}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t.modules.admin.settings.features}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['news','opportunities','entities','messaging','admin'].map(k => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked />
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t.modules.admin.settings.customEntityCategories}</Label>
            <Textarea placeholder={t.modules.admin.settings.customEntityPlaceholder} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline">{t.modules.admin.settings.reset}</Button>
            <Button formAction="/api/admin/whitelabel/save" formMethod="post">{t.modules.admin.settings.save}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </AdminWrapper>
  )
}
