import { NextRequest, NextResponse, connection} from 'next/server'
import { db } from '@/lib/database'
import { auth } from '@/auth'

type UserRow = Record<string, unknown> & { id: string }

export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Check authentication and admin role
    const session = await auth()
    if (!session?.user?.role || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    console.log('Starting user migration from Firebase to PostgreSQL')

    // Get all users from database
    const result = await db().queryDocs<UserRow>({ collection: 'users' })
    if (!result.success) {
      throw result.error || new Error('Failed to fetch users')
    }
    const snapshot = result.data ?? []
    const totalUsers = snapshot.length

    console.log(`Found ${totalUsers} users in Firebase`)

    let migrated = 0
    let errors = 0
    const results = []

    for (const doc of snapshot) {
      const userId = doc.id
      const userData = doc

      try {
        // Make automart@gmail.com a superadmin
        if (userData.email === 'automart@gmail.com') {
          console.log(`Making user ${userData.email} a superadmin`)
          userData.role = 'superadmin'
        }

        // Create user document for database
        const userDoc = {
          ...userData,
          migrated_at: new Date().toISOString()
        }

        // Save to database
        const createResult = await db().createDoc('users', userDoc, { id: userId })
        if (!createResult.success) {
          throw createResult.error || new Error('Failed to create user')
        }

        console.log(`✅ Migrated user: ${userData.email || userId}`)
        results.push({ id: userId, email: userData.email, status: 'migrated' })
        migrated++

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`❌ Error migrating user ${userData.email || userId}:`, error)
        results.push({ id: userId, email: userData.email, status: 'error', error: message })
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: totalUsers,
        migrated,
        errors
      },
      results
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 })
  }
}
