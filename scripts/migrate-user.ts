#!/usr/bin/env tsx
/**
 * Migrate specific user from Firebase to PostgreSQL
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import pkg from 'pg'
const { Pool } = pkg

// Initialize Firebase Admin
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

const firestore = getFirestore(app)

// Initialize PostgreSQL connection
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ring_platform',
  user: process.env.DB_USER || 'ring_user',
  password: process.env.DB_PASSWORD || 'ring_password_123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

async function migrateAllUsers() {
  console.log('Starting migration of all users from Firebase to PostgreSQL')

  try {
    // Get all users from Firebase
    const snapshot = await firestore.collection('users').get()
    const totalUsers = snapshot.size

    console.log(`Found ${totalUsers} users in Firebase`)

    let migrated = 0
    let errors = 0

    for (const doc of snapshot.docs) {
      const userId = doc.id
      const userData = doc.data()

      try {
        // Make automart@gmail.com a superadmin
        if (userData.email === 'automart@gmail.com') {
          console.log(`Making user ${userData.email} a superadmin`)
          userData.role = 'superadmin'
        }

        // Insert into PostgreSQL
        const query = `
          INSERT INTO users (id, data, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
        `

        await pgPool.query(query, [userId, JSON.stringify(userData)])
        console.log(`✅ Migrated user: ${userData.email || userId}`)
        migrated++

      } catch (error) {
        console.error(`❌ Error migrating user ${userData.email || userId}:`, error)
        errors++
      }
    }

    console.log(`\nMigration Summary:`)
    console.log(`Total users in Firebase: ${totalUsers}`)
    console.log(`Successfully migrated: ${migrated}`)
    console.log(`Errors: ${errors}`)

    return { success: true, migrated, errors }

  } catch (error) {
    console.error('Error during migration:', error)
    return { success: false, migrated: 0, errors: 1 }
  }
}

async function main() {
  console.log('Firebase to PostgreSQL User Migration Script')
  console.log('=============================================')

  const result = await migrateAllUsers()

  if (result.success) {
    console.log('✅ Migration completed successfully')
    console.log(`Migrated ${result.migrated} users with ${result.errors} errors`)
  } else {
    console.log('❌ Migration failed')
  }

  await pgPool.end()
  process.exit(result.success ? 0 : 1)
}

main().catch(console.error)
