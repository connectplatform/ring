import { NextRequest, NextResponse, connection } from 'next/server'
import { db } from '@/lib/database'
import { auth } from '@/auth'
import { isSuperadmin } from '@/features/auth/user-role'

type UserRow = Record<string, unknown> & { id: string }

// API route for migrating users from Firebase to PostgreSQL
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering, connect to DB

  try {
    // Check authentication and make sure user has 'superadmin' role
    const session = await auth()
    // If not authenticated or not a superadmin, block access
    if (!session?.user?.role || !isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Log the start of the migration process
    console.log('Starting user migration from Firebase to PostgreSQL')

    // Fetch all user documents from the database (assumed Firebase)
    const result = await db().queryDocs<UserRow>({ collection: 'users' })
    if (!result.success) {
      // If error occurs while fetching users, throw to outer catch
      throw result.error || new Error('Failed to fetch users')
    }
    // Fallback empty array if no user data present
    const snapshot = result.data ?? []
    const totalUsers = snapshot.length

    console.log(`Found ${totalUsers} users in Firebase`)

    // Track migration stats
    let migrated = 0
    let errors = 0
    const results = []

    // Iterate through all user records found
    for (const doc of snapshot) {
      const userId = doc.id
      const userData = doc // User data as returned from Firebase

      try {
        // Ensure user automart@gmail.com is migrated as a superadmin
        if (userData.email === 'automart@gmail.com') {
          console.log(`Making user ${userData.email} a superadmin`)
          userData.role = 'superadmin'
        }

        // Build new user document for target DB, add migration timestamp
        const userDoc = {
          ...userData,
          migrated_at: new Date().toISOString() // ISO timestamp for auditing
        }

        // Create user document in PostgreSQL (or target DB)
        const createResult = await db().createDoc('users', userDoc, { id: userId })
        if (!createResult.success) {
          // If failed to create user, throw handled error
          throw createResult.error || new Error('Failed to create user')
        }

        // Log and count successful migration
        console.log(`✅ Migrated user: ${userData.email || userId}`)
        results.push({ id: userId, email: userData.email, status: 'migrated' })
        migrated++

      } catch (error) {
        // On error, log, save error result, and increment error counter
        const message = error instanceof Error ? error.message : String(error)
        console.error(`❌ Error migrating user ${userData.email || userId}:`, error)
        results.push({ id: userId, email: userData.email, status: 'error', error: message })
        errors++
      }
    }

    // Respond with migration summary and per-user results
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
    // Catch-all for unexpected errors in migration process
    const message = error instanceof Error ? error.message : String(error)
    console.error('Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 })
  }
}

// TODO: Consider using streaming responses for large user lists with React 19 / Next.js 16 (e.g., via async iterators or incremental rendering).
// TODO: Look into using edge runtime if performance/scalability needed for admin-only endpoint.
// TODO: If migrating many users, investigate worker queue or batching writes for resilience and efficiency.
// TODO: Consider Next.js server actions as an alternative pattern if you need tight integration with React 19 components.