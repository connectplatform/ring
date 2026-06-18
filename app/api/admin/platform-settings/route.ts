import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/user-role'
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

function parseNamespace(value: string | null): PlatformSettingsNamespace | null {
  if (!value) return null
  return PLATFORM_SETTING_NAMESPACES.includes(value as PlatformSettingsNamespace)
    ? (value as PlatformSettingsNamespace)
    : null
}

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.superadmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const namespace = parseNamespace(request.nextUrl.searchParams.get('namespace'))
  if (!namespace) {
    return NextResponse.json({ error: 'Invalid or missing namespace' }, { status: 400 })
  }

  if (namespace === 'ai') {
    const data = await getPlatformAISettingsView()
    return NextResponse.json({ success: true, namespace, data })
  }

  const data = await getPlatformBrandingData()
  return NextResponse.json({ success: true, namespace, data })
}

export async function PUT(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || session.user.role !== UserRole.superadmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const namespace = parseNamespace(body?.namespace)
  if (!namespace) {
    return NextResponse.json({ error: 'Invalid or missing namespace' }, { status: 400 })
  }

  const updatedBy = session.user.email || session.user.id

  if (namespace === 'ai') {
    const data = platformAIDataSchema.parse(body.data || {})
    const secrets = platformAISecretsSchema.parse(body.secrets || {})
    await upsertPlatformNamespace('ai', data, secrets, updatedBy)
    invalidateNamespace('ai')
    const view = await getPlatformAISettingsView()
    return NextResponse.json({ success: true, namespace, data: view })
  }

  const data = platformBrandingDataSchema.parse(body.data || {})
  await upsertPlatformNamespace('branding', data, {}, updatedBy)
  invalidateNamespace('branding')
  invalidateInstanceConfigCache()
  return NextResponse.json({ success: true, namespace, data })
}
