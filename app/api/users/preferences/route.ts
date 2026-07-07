import { NextResponse, connection} from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/database'
import { auth } from '@/auth'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/locale-config'
import { getDefaultTheme, getDefaultStoreCurrencySymbol } from '@/lib/ring-config-core'

type UserRow = Record<string, unknown> & { id: string }

// ---------------------------------------------------------------------------
// Preferences schema with Zod preprocess — validates incoming request body
// and safely parses DB-stored preferences without type assertions.
// ---------------------------------------------------------------------------

const preferencesSchema = z.object({
  locale: z
    .string()
    .refine(
      (val) => (SUPPORTED_LOCALES as readonly string[]).includes(val),
      { message: `Invalid locale. Supported: ${SUPPORTED_LOCALES.join(', ')}` },
    )
    .optional(),
  currency: z.enum(['UAH', 'DAAR']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
})

type UserPreferences = z.infer<typeof preferencesSchema>

/** Normalize raw POST body — extract only known preference keys, reject non-objects. */
function normalizePreferencesBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const body = raw as Record<string, unknown>
  return {
    locale: body.locale,
    currency: body.currency,
    theme: body.theme,
  }
}

const preferencesInputSchema = z.preprocess(normalizePreferencesBody, preferencesSchema)

export async function GET() {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db().findDocById<UserRow>('users', session.user.id)
    
    const defaultPreferences: UserPreferences = {
      locale: DEFAULT_LOCALE,
      currency: getDefaultStoreCurrencySymbol() as UserPreferences['currency'],
      theme: getDefaultTheme() as UserPreferences['theme'],
    }

    if (!result.success || !result.data) {
      return NextResponse.json({ preferences: defaultPreferences })
    }

    const userData = result.data
    const parsedPrefs = preferencesSchema.safeParse(userData.preferences)
    const preferences: UserPreferences = parsedPrefs.success ? parsedPrefs.data : defaultPreferences

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = preferencesInputSchema.safeParse(body)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid preferences' },
        { status: 400 },
      )
    }

    const { locale, currency, theme } = parsed.data

    const userResult = await db().findDocById<UserRow>('users', session.user.id)
    
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = userResult.data
    const currentParsed = preferencesSchema.safeParse(userData.preferences)
    const currentPreferences: UserPreferences = currentParsed.success ? currentParsed.data : {}

    const updatedPreferences = {
      ...currentPreferences,
      ...(locale && { locale }),
      ...(currency && { currency }),
      ...(theme && { theme }),
      updatedAt: new Date().toISOString()
    }

    const updateResult = await db().updateDoc('users', session.user.id, {
      ...userData,
      preferences: updatedPreferences,
      updated_at: new Date()
    })

    if (!updateResult.success) {
      throw new Error('Failed to update preferences')
    }

    console.log(`✅ Updated preferences for user ${session.user.id}:`, updatedPreferences)

    return NextResponse.json({ 
      success: true, 
      preferences: updatedPreferences 
    })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
