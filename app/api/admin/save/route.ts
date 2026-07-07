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

/**
 * Legacy admin save endpoint — persists branding to platform_settings DB (not filesystem).
 * Accepts POST requests with branding form data, validates, saves, and redirects.
 */
export async function POST(request: NextRequest) {
  // Ensure DB connection is established before continuing
  await connection()
  
  // Authenticate user session
  const session = await auth()
  // Only superadmins are allowed to update branding.
  if (!session?.user || !isSuperadmin(session.user.role)) {
    // Unauthorized access returns 401 error.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse form data from the POST request
  const formData = await request.formData()
  // Extract color and theme values with safe defaults in case fields are missing
  // TODO: Add validation for color hex format (could use Zod schema or custom)
  const primary = String(formData.get('colorPrimary') || '#3b82f6')
  const background = String(formData.get('colorBackground') || '#0b0f1a')
  const foreground = String(formData.get('colorForeground') || '#e5e7eb')
  const accent = String(formData.get('colorAccent') || '#22c55e')
  // Only allow 'light', 'dark', or 'system' for defaultTheme
  const defaultTheme = String(formData.get('defaultTheme') || 'system') as 'light' | 'dark' | 'system'

  // Fetch current platform branding configuration
  const existing = await getPlatformBrandingData()
  // Compose new branding data, merging new fields over existing ones
  // Validate and shape data using the branding schema
  const data = platformBrandingDataSchema.parse({
    ...existing,
    brand: {
      ...existing.brand,
      colors: { primary, background, foreground, accent },
    },
    theme: { default: defaultTheme },
  })

  // Determine user identity for audit trail
  // TODO: Consider stronger guarantee that email or id exists
  const updatedBy = session.user.email || session.user.id

  // Upsert (insert or update) the branding configuration in DB
  await upsertPlatformNamespace('branding', data, {}, updatedBy)

  // Invalidate branding cache so changes propagate immediately
  invalidateNamespace('branding')
  invalidateInstanceConfigCache()

  // Redirect to the admin settings page after save
  // TODO: Consider using NextResponse.json for SPA POST navigation in Next.js 13+ apps
  return NextResponse.redirect(new URL('/admin/settings', request.url))
}
