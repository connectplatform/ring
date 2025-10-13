import { NextRequest, NextResponse } from 'next/server'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth()
    if (!session?.user?.role || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    console.log('Starting user migration from Firebase to PostgreSQL')

    // Initialize Firebase Admin (reuse existing initialization if available)
    let firestore
    try {
      // Try to get existing app
      const admin = await import('firebase-admin')
      firestore = admin.firestore()
    } catch {
      // Initialize new app
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.AUTH_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: (process.env.AUTH_FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        client_email: process.env.AUTH_FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      }

      const app = initializeApp({
        credential: cert(serviceAccount as any)
      })
      firestore = getFirestore(app)
    }

    // Initialize database
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      return NextResponse.json({ error: 'Database initialization failed' }, { status: 500 })
    }

    const dbService = getDatabaseService()

    // Get all users from Firebase
    const snapshot = await firestore.collection('users').get()
    const totalUsers = snapshot.size

    console.log(`Found ${totalUsers} users in Firebase`)

    let migrated = 0
    let errors = 0
    const results = []

    for (const doc of snapshot.docs) {
      const userId = doc.id
      const userData = doc.data()

      try {
        // Make automart@gmail.com a superadmin
        if (userData.email === 'automart@gmail.com') {
          console.log(`Making user ${userData.email} a superadmin`)
          userData.role = 'superadmin'
        }

        // Create user document for database
        const userDoc = {
          id: userId,
          ...userData,
          migrated_at: new Date().toISOString()
        }

        // Save to database
        await dbService.create('users', userDoc)

        console.log(`✅ Migrated user: ${userData.email || userId}`)
        results.push({ id: userId, email: userData.email, status: 'migrated' })
        migrated++

      } catch (error) {
        console.error(`❌ Error migrating user ${userData.email || userId}:`, error)
        results.push({ id: userId, email: userData.email, status: 'error', error: error.message })
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
    console.error('Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
