import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const dynamic = 'force-dynamic'

export default async function PlatformSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const session = await auth()

  if (!session?.user) redirect(`/${validLocale}/login`)
  if (!session.user.isSuperAdmin) redirect(`/${validLocale}/unauthorized`)

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Platform Settings (SuperAdmin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input id="projectName" placeholder="My Platform" defaultValue="Ring Platform" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDescription">Short Description</Label>
              <Input id="shortDescription" placeholder="One line blurb" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="extendedDescription">Extended Description</Label>
              <Textarea id="extendedDescription" placeholder="Detailed description shown on landing pages" rows={4} />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input type="file" accept="image/*" />
                <Button variant="outline">Upload</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="space-y-2">
                <Label htmlFor="colorPrimary">Primary</Label>
                <Input id="colorPrimary" type="color" defaultValue="#3b82f6" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorBackground">Background</Label>
                <Input id="colorBackground" type="color" defaultValue="#0b0f1a" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorForeground">Foreground</Label>
                <Input id="colorForeground" type="color" defaultValue="#e5e7eb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorAccent">Accent</Label>
                <Input id="colorAccent" type="color" defaultValue="#22c55e" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTheme">Default Theme</Label>
                <Select defaultValue="system">
                  <SelectTrigger id="defaultTheme">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Features</Label>
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
            <Label>Custom Entity Categories</Label>
            <Textarea placeholder="One per line, e.g. Startup, NGO, SME" rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline">Reset</Button>
            <Button formAction="/api/admin/whitelabel/save" formMethod="post">Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
