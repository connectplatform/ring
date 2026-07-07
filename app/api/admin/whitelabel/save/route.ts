import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import { platformBrandingDataSchema } from '@/features/admin/platform-settings/types'
import {
  getPlatformBrandingData,
  upsertPlatformNamespace,
} from '@/features/admin/platform-settings/platform-settings-service'
import { invalidateNamespace } from '@/features/admin/platform-settings/platform-settings-cache'
import { invalidateInstanceConfigCache } from '@/lib/ring-config-core'

export async function POST(request: NextRequest) {
  // Ensure database connection is established.
  await connection()

  // Authenticate the user session.
  const session = await auth()
  // If user is not authenticated or not a superadmin, reject request.
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse form data sent with the request.
  const formData = await request.formData()
  // Extract color fields and provide default fallbacks.
  const primary = String(formData.get('colorPrimary') || '#3b82f6')
  const background = String(formData.get('colorBackground') || '#0b0f1a')
  const foreground = String(formData.get('colorForeground') || '#e5e7eb')
  const accent = String(formData.get('colorAccent') || '#22c55e')
  // Validate default theme; restricts value to one of 'light', 'dark', or 'system'.
  const defaultTheme = String(formData.get('defaultTheme') || 'system') as 'light' | 'dark' | 'system'

  // Retrieve current platform branding data.
  const existing = await getPlatformBrandingData()
  // Compose and validate updated branding data, merging with existing.
  const data = platformBrandingDataSchema.parse({
    ...existing,
    brand: {
      ...existing.brand,
      colors: { primary, background, foreground, accent },
    },
    theme: { default: defaultTheme },
  })

  // Identify the user who made the update, prioritizing email over id.
  const updatedBy = session.user.email || session.user.id
  // Update the platform namespace with new branding info.
  await upsertPlatformNamespace('branding', data, {}, updatedBy)

  // Invalidate cache for branding and instance config to ensure new data is used.
  invalidateNamespace('branding')
  invalidateInstanceConfigCache()

  // TODO: Consider using Next.js 16 `cookies()` and `headers()` helpers to simplify locale and referer extraction when available.

  // Attempt to determine locale from the request path (e.g., '/en/admin/...').
  const localeMatch = request.nextUrl.pathname.match(/^\/([a-z]{2})\//)
  const locale = localeMatch?.[1] || 'en'

  // Extract the 'referer' header to determine where user came from.
  const referer = request.headers.get('referer')
  // If the referer is an admin settings route in one of the recognized locales, use that locale for redirection.
  const redirectLocale = referer?.match(/\/(en|uk|ru)\/admin\/settings/)?.[1] || locale

  // Redirect user back to admin settings page with correct locale.
  return NextResponse.redirect(new URL(`/${redirectLocale}/admin/settings`, request.url))
}
