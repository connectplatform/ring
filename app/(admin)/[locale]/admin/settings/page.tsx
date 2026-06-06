import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/user-role'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { connection } from 'next/server'



export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/settings',
    robots: { index: false, follow: false },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function PlatformSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale)
  const t = await getTranslations('modules.admin.settings')
  const tAdmin = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(tAdmin)
  const session = await auth()

  if (!session?.user) redirect(ROUTES.LOGIN(validLocale))
  if (session.user.role !== UserRole.SUPERADMIN) redirect(ROUTES.UNAUTHORIZED(validLocale))

  return (
    <AdminWrapper locale={validLocale} pageContext="settings" labels={adminLabels}>
    <div className="container mx-auto px-0 py-0">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">{t('projectName')}</Label>
              <Input id="projectName" placeholder="My Platform" defaultValue="Ring Platform" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDescription">{t('shortDescription')}</Label>
              <Input id="shortDescription" placeholder="One line blurb" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="extendedDescription">{t('extendedDescription')}</Label>
              <Textarea id="extendedDescription" placeholder="Detailed description shown on landing pages" rows={4} />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <Label>{t('logo')}</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input type="file" accept="image/*" />
                <Button variant="outline">{t('upload')}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="space-y-2">
                <Label htmlFor="colorPrimary">{t('colors.primary')}</Label>
                <Input id="colorPrimary" type="color" defaultValue="#3b82f6" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorBackground">{t('colors.background')}</Label>
                <Input id="colorBackground" type="color" defaultValue="#0b0f1a" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorForeground">{t('colors.foreground')}</Label>
                <Input id="colorForeground" type="color" defaultValue="#e5e7eb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorAccent">{t('colors.accent')}</Label>
                <Input id="colorAccent" type="color" defaultValue="#22c55e" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTheme">{t('defaultTheme')}</Label>
                <Select defaultValue="system">
                  <SelectTrigger id="defaultTheme">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('theme.light')}</SelectItem>
                    <SelectItem value="dark">{t('theme.dark')}</SelectItem>
                    <SelectItem value="system">{t('theme.system')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t('features')}</Label>
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
            <Label>{t('customEntityCategories')}</Label>
            <Textarea placeholder={t('customEntityPlaceholder')} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline">{t('reset')}</Button>
            <Button formAction="/api/admin/whitelabel/save" formMethod="post">{t('save')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </AdminWrapper>
  )
}
