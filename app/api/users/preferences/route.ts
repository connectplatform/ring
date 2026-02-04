import { NextResponse } from 'next/server'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { auth } from '@/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await initializeDatabase()
    const db = getDatabaseService()

    const result = await db.findById('users', session.user.id)
    
    if (!result.success || !result.data?.data) {
      return NextResponse.json({ 
        preferences: {
          locale: 'uk',
          currency: 'UAH',
          theme: 'system'
        }
      })
    }

    const userData = result.data.data
    const preferences = userData.preferences || {
      locale: 'uk',
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
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { locale, currency, theme } = body

    // Validate preferences
    const validLocales = ['en', 'uk', 'ru']
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

    await initializeDatabase()
    const db = getDatabaseService()

    // Get current user data
    const userResult = await db.findById('users', session.user.id)
    
    if (!userResult.success || !userResult.data?.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = userResult.data.data
    const currentPreferences = userData.preferences || {}

    // Merge new preferences with existing ones
    const updatedPreferences = {
      ...currentPreferences,
      ...(locale && { locale }),
      ...(currency && { currency }),
      ...(theme && { theme }),
      updatedAt: new Date().toISOString()
    }

    // Update user document with new preferences
    const updateResult = await db.update('users', session.user.id, {
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

