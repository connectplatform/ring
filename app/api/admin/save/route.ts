import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/user-role'
import { platformBrandingDataSchema } from '@/features/admin/platform-settings/types'
import {
  getPlatformBrandingData,
  upsertPlatformNamespace,
} from '@/features/admin/platform-settings/platform-settings-service'
import { invalidateNamespace } from '@/features/admin/platform-settings/platform-settings-cache'
import { invalidateInstanceConfigCache } from '@/lib/ring-config-core'

/** Legacy admin save endpoint — persists branding to platform_settings DB (not filesystem). */
export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.superadmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const primary = String(formData.get('colorPrimary') || '#3b82f6')
  const background = String(formData.get('colorBackground') || '#0b0f1a')
  const foreground = String(formData.get('colorForeground') || '#e5e7eb')
  const accent = String(formData.get('colorAccent') || '#22c55e')
  const defaultTheme = String(formData.get('defaultTheme') || 'system') as 'light' | 'dark' | 'system'

  const existing = await getPlatformBrandingData()
  const data = platformBrandingDataSchema.parse({
    ...existing,
    brand: {
      ...existing.brand,
      colors: { primary, background, foreground, accent },
    },
    theme: { default: defaultTheme },
  })

  const updatedBy = session.user.email || session.user.id
  await upsertPlatformNamespace('branding', data, {}, updatedBy)
  invalidateNamespace('branding')
  invalidateInstanceConfigCache()

  return NextResponse.redirect(new URL('/en/admin/settings', request.url))
}
