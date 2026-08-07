import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'
import {
  platformAIDataSchema,
  platformAISecretsSchema,
  platformBrandingDataSchema,
  PLATFORM_SETTING_NAMESPACES,
  type PlatformSettingsNamespace,
} from '@/features/admin/platform-settings/types'
import {
  getPlatformAISettingsView,
  getPlatformBrandingData,
  upsertPlatformNamespace,
} from '@/features/admin/platform-settings/platform-settings-service'
import { invalidateNamespace } from '@/features/admin/platform-settings/platform-settings-cache'
import { invalidateInstanceConfigCache } from '@/lib/ring-config-core'

// Parse a value to PlatformSettingsNamespace or return null if invalid
function parseNamespace(value: string | null): PlatformSettingsNamespace | null {
  if (!value) return null
  return PLATFORM_SETTING_NAMESPACES.includes(value as PlatformSettingsNamespace)
    ? (value as PlatformSettingsNamespace)
    : null
}

// Handler for GET requests to platform-settings API
export async function GET(request: NextRequest) {
  await connection() // Ensure DB connection is established for the request

  // Authenticate and check superadmin access
  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Extract and validate namespace from query params
  const namespace = parseNamespace(request.nextUrl.searchParams.get('namespace'))
  if (!namespace) {
    return NextResponse.json({ error: 'Invalid or missing namespace' }, { status: 400 })
  }

  // If accessing AI platform settings, respond with current AI config
  if (namespace === 'ai') {
    const data = await getPlatformAISettingsView()
    return NextResponse.json({ success: true, namespace, data })
  }

  // Otherwise, respond with branding data
  const data = await getPlatformBrandingData()
  return NextResponse.json({ success: true, namespace, data })
}

// Handler for PUT requests to update platform-settings
export async function PUT(request: NextRequest) {
  await connection() // Ensure DB connection is established for the request

  // Authenticate and check superadmin access
  const session = await auth()
  if (!session?.user || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get request body and parse namespace
  const body = await request.json()
  const namespace = parseNamespace(body?.namespace)
  if (!namespace) {
    return NextResponse.json({ error: 'Invalid or missing namespace' }, { status: 400 })
  }

  // Identify who is updating the settings
  const updatedBy = session.user.email || session.user.id

  // AI namespace: validate and update AI settings and related secrets
  if (namespace === 'ai') {
    // Validate AI data from body using schema
    const data = platformAIDataSchema.parse(body.data || {})
    // Validate secrets from body using schema
    const secrets = platformAISecretsSchema.parse(body.secrets || {})
    await upsertPlatformNamespace('ai', data, secrets, updatedBy) // Update DB
    invalidateNamespace('ai') // Invalidate cache for AI settings
    const view = await getPlatformAISettingsView() // Fetch updated AI view
    return NextResponse.json({ success: true, namespace, data: view })
  }

  // Branding namespace: validate and update branding settings
  const data = platformBrandingDataSchema.parse(body.data || {})
  await upsertPlatformNamespace('branding', data, {}, updatedBy) // Update DB
  invalidateNamespace('branding') // Invalidate branding cache
  invalidateInstanceConfigCache() // Invalidate broader instance config cache
  return NextResponse.json({ success: true, namespace, data })
}

// TODO: Consider using Next.js 16 built-in middleware for authentication and authorization if suitable.
// TODO: If server actions are available in this Next.js version for API mutators, refactor PUT/GET into server actions for more idiomatic approach.
// TODO: Consider using NextResponse.redirect for error handling in cases where the frontend expects navigation instead of json responses.