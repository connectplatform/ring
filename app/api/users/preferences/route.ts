import { NextResponse, connection} from 'next/server'
import { db } from '@/lib/database'
import { auth } from '@/auth'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/locale-config'

type UserRow = Record<string, unknown> & { id: string }

export async function GET() {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db().findDocById<UserRow>('users', session.user.id)
    
    if (!result.success || !result.data) {
      return NextResponse.json({ 
        preferences: {
          locale: DEFAULT_LOCALE,
          currency: 'UAH',
          theme: 'system'
        }
      })
    }

    const userData = result.data
    const preferences = (userData.preferences as Record<string, unknown>) || {
      locale: DEFAULT_LOCALE,
      currency: 'UAH',
      theme: 'system'
    }

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
    const { locale, currency, theme } = body

    // Validate preferences
    const validLocales: readonly string[] = SUPPORTED_LOCALES
    const validCurrencies = ['UAH', 'DAAR']
    const validThemes = ['light', 'dark', 'system']

    if (locale && !validLocales.includes(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
    }

    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }

    const userResult = await db().findDocById<UserRow>('users', session.user.id)
    
    if (!userResult.success || !userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = userResult.data
    const currentPreferences = (userData.preferences as Record<string, unknown>) || {}

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
