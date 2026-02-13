#!/usr/bin/env tsx
/**
 * Firebase to PostgreSQL Migration Script
 * 
 * Migrates all data from Firebase Firestore to PostgreSQL
 * Handles all collections with proper data transformation
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

// Collections to migrate
const COLLECTIONS = [
  'users',
  'entities',
  'opportunities',
  'messages',
  'conversations',
  'notifications',
  'wallet_transactions',
  'nft_listings',
  'news',
  'store_products',
  'store_orders',
  'comments',
  'likes',
  'reviews'
]

interface MigrationStats {
  collection: string
  totalDocs: number
  migrated: number
  errors: number
  skipped: number
  duration: number
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName: string): Promise<MigrationStats> {
  console.log(`\n📦 Migrating collection: ${collectionName}`)
  const startTime = Date.now()
  
  const stats: MigrationStats = {
    collection: collectionName,
    totalDocs: 0,
    migrated: 0,
    errors: 0,
    skipped: 0,
    duration: 0
  }

  try {
    // Get all documents from Firebase
    const snapshot = await firestore.collection(collectionName).get()
    stats.totalDocs = snapshot.size
    
    console.log(`  Found ${stats.totalDocs} documents in Firebase`)
    
    if (stats.totalDocs === 0) {
      console.log(`  ⚠️  Collection is empty, skipping...`)
      stats.duration = Date.now() - startTime
      return stats
    }

    // Prepare batch insert
    const client = await pgPool.connect()
    
    try {
      await client.query('BEGIN')
      
      for (const doc of snapshot.docs) {
        try {
          const data = doc.data()
          const id = doc.id
          
          // Transform Firebase timestamps to PostgreSQL timestamps
          const transformedData = transformFirebaseData(data)
          
          // Check if record exists
          const checkQuery = `SELECT id FROM ${collectionName} WHERE id = $1`
          const existing = await client.query(checkQuery, [id])
          
          if (existing.rows.length > 0) {
            // Update existing record
            const updateQuery = `
              UPDATE ${collectionName} 
              SET data = $1, updated_at = NOW()
              WHERE id = $2
            `
            await client.query(updateQuery, [JSON.stringify(transformedData), id])
            stats.migrated++
          } else {
            // Insert new record
            const insertQuery = `
              INSERT INTO ${collectionName} (id, data, created_at, updated_at)
              VALUES ($1, $2, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE
              SET data = EXCLUDED.data, updated_at = NOW()
            `
            await client.query(insertQuery, [id, JSON.stringify(transformedData)])
            stats.migrated++
          }
          
          // Progress indicator
          if (stats.migrated % 100 === 0) {
            console.log(`  ✓ Migrated ${stats.migrated}/${stats.totalDocs} documents...`)
          }
          
        } catch (docError) {
          console.error(`  ❌ Error migrating document ${doc.id}:`, docError)
          stats.errors++
        }
      }
      
      await client.query('COMMIT')
      console.log(`  ✅ Successfully migrated ${stats.migrated} documents`)
      
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error(`  ❌ Error migrating collection ${collectionName}:`, error)
    stats.errors++
  }
  
  stats.duration = Date.now() - startTime
  return stats
}

/**
 * Transform Firebase data to PostgreSQL format
 */
function transformFirebaseData(data: any): any {
  const transformed: any = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      // Firebase Timestamp
      transformed[key] = value.toDate().toISOString()
    } else if (value && typeof value === 'object' && '_seconds' in value) {
      // Firestore Timestamp object
      const seconds = Number(value._seconds)
      transformed[key] = new Date(seconds * 1000).toISOString()
    } else if (Array.isArray(value)) {
      // Handle arrays
      transformed[key] = value.map(item => 
        typeof item === 'object' ? transformFirebaseData(item) : item
      )
    } else if (value && typeof value === 'object') {
      // Handle nested objects
      transformed[key] = transformFirebaseData(value)
    } else {
      // Primitive values
      transformed[key] = value
    }
  }
  
  return transformed
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Firebase to PostgreSQL Migration')
  console.log('=' .repeat(60))
  
  const allStats: MigrationStats[] = []
  
  for (const collection of COLLECTIONS) {
    const stats = await migrateCollection(collection)
    allStats.push(stats)
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary')
  console.log('='.repeat(60))
  
  let totalDocs = 0
  let totalMigrated = 0
  let totalErrors = 0
  let totalDuration = 0
  
  console.log('\nCollection                    Total   Migrated  Errors   Duration')
  console.log('-'.repeat(70))
  
  for (const stats of allStats) {
    console.log(
      `${stats.collection.padEnd(28)} ${stats.totalDocs.toString().padStart(6)} ` +
      `${stats.migrated.toString().padStart(9)} ${stats.errors.toString().padStart(7)} ` +
      `${(stats.duration / 1000).toFixed(1)}s`
    )
    
    totalDocs += stats.totalDocs
    totalMigrated += stats.migrated
    totalErrors += stats.errors
    totalDuration += stats.duration
  }
  
  console.log('-'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(28)} ${totalDocs.toString().padStart(6)} ` +
    `${totalMigrated.toString().padStart(9)} ${totalErrors.toString().padStart(7)} ` +
    `${(totalDuration / 1000).toFixed(1)}s`
  )
  
  console.log('\n' + '='.repeat(60))
  
  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!')
  } else {
    console.log(`⚠️  Migration completed with ${totalErrors} errors`)
  }
  
  console.log(`📈 Success rate: ${((totalMigrated / totalDocs) * 100).toFixed(1)}%`)
  
  // Cleanup
  await pgPool.end()
  process.exit(totalErrors > 0 ? 1 : 0)
}

// Run migration
main().catch(error => {
  console.error('❌ Fatal migration error:', error)
  process.exit(1)
})

