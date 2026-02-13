#!/usr/bin/env node
/**
 * Firebase to PostgreSQL Migration Script (JavaScript)
 * Migrates all data from Firebase Firestore to PostgreSQL
 */

const admin = require('firebase-admin');
const { Pool } = require('pg');

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
];

// Initialize Firebase (it should already be initialized in the app, but check)
let firestore;
try {
  firestore = admin.firestore();
  console.log('✅ Using existing Firebase Admin initialization');
} catch (error) {
  console.log('⚠️  Initializing Firebase Admin...');
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
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  firestore = admin.firestore();
}

// Initialize PostgreSQL
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ring_platform',
  user: process.env.DB_USER || 'ring_user',
  password: process.env.DB_PASSWORD || 'ring_password_123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Transform Firebase Timestamp to ISO string
 */
function transformValue(value) {
  if (!value) return value;
  
  // Handle Firebase Timestamp
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  
  // Handle Firestore Timestamp object
  if (value && typeof value === 'object' && '_seconds' in value) {
    return new Date(value._seconds * 1000).toISOString();
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => transformValue(item));
  }
  
  // Handle nested objects
  if (value && typeof value === 'object') {
    const transformed = {};
    for (const [key, val] of Object.entries(value)) {
      transformed[key] = transformValue(val);
    }
    return transformed;
  }
  
  return value;
}

/**
 * Transform Firebase document data
 */
function transformFirebaseData(data) {
  const transformed = {};
  for (const [key, value] of Object.entries(data)) {
    transformed[key] = transformValue(value);
  }
  return transformed;
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName) {
  console.log(`\n📦 Migrating collection: ${collectionName}`);
  const startTime = Date.now();
  
  let totalDocs = 0;
  let migrated = 0;
  let errors = 0;

  try {
    // Get all documents from Firebase
    const snapshot = await firestore.collection(collectionName).get();
    totalDocs = snapshot.size;
    
    console.log(`  Found ${totalDocs} documents in Firebase`);
    
    if (totalDocs === 0) {
      console.log(`  ⚠️  Collection is empty, skipping...`);
      return { collection: collectionName, totalDocs, migrated, errors, duration: Date.now() - startTime };
    }

    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const doc of snapshot.docs) {
        try {
          const data = doc.data();
          const id = doc.id;
          
          // Transform Firebase data
          const transformedData = transformFirebaseData(data);
          
          // Upsert into PostgreSQL
          await client.query(
            `INSERT INTO ${collectionName} (id, data, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE
             SET data = EXCLUDED.data, updated_at = NOW()`,
            [id, JSON.stringify(transformedData)]
          );
          
          migrated++;
          
          if (migrated % 50 === 0) {
            console.log(`  ✓ Migrated ${migrated}/${totalDocs} documents...`);
          }
          
        } catch (docError) {
          console.error(`  ❌ Error migrating document ${doc.id}:`, docError.message);
          errors++;
        }
      }
      
      await client.query('COMMIT');
      console.log(`  ✅ Successfully migrated ${migrated} documents`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(`  ❌ Error migrating collection ${collectionName}:`, error.message);
    errors++;
  }
  
  return { 
    collection: collectionName, 
    totalDocs, 
    migrated, 
    errors, 
    duration: Date.now() - startTime 
  };
}

/**
 * Main migration
 */
async function main() {
  console.log('\''\n='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\'');
  console.log('\''🚀 Firebase to PostgreSQL Migration'\'');
  console.log('\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\'');
  
  const allStats = [];
  
  for (const collection of COLLECTIONS) {
    const stats = await migrateCollection(collection);
    allStats.push(stats);
  }
  
  // Summary
  console.log('\''\n='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\'');
  console.log('\''📊 Migration Summary'\'');
  console.log('\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''='\''\'');
  
  let totalDocs = 0, totalMigrated = 0, totalErrors = 0;
  
  allStats.forEach(stats => {
    console.log(`${stats.collection.padEnd(25)} ${stats.totalDocs.toString().padStart(6)} ${stats.migrated.toString().padStart(9)} ${stats.errors.toString().padStart(7)} ${(stats.duration / 1000).toFixed(1)}s`);
    totalDocs += stats.totalDocs;
    totalMigrated += stats.migrated;
    totalErrors += stats.errors;
  });
  
  console.log('\''\n✅ Migration complete!'\'');
  console.log(`📈 Total: ${totalMigrated}/${totalDocs} documents (${((totalMigrated/totalDocs)*100).toFixed(1)}% success)`);
  
  await pgPool.end();
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\''❌ Fatal error:'\'', error);
  process.exit(1);
});
EOFMIGRATE
cat /tmp/migrate.ts'"

