// Seed sample opportunities into Firestore using Firebase Admin SDK (pure JS)
// Usage: npm run seed:opportunities

import dotenv from 'dotenv'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Load environment variables from .env.local (fallback to .env)
dotenv.config({ path: '.env.local' })
dotenv.config()

function ensureEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

async function main() {
  const projectId = ensureEnv('AUTH_FIREBASE_PROJECT_ID')
  const clientEmail = ensureEnv('AUTH_FIREBASE_CLIENT_EMAIL')
  const privateKey = ensureEnv('AUTH_FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  })

  const db = getFirestore(app)
  const col = db.collection('opportunities')

  const now = new Date()
  const addDays = (d) => new Date(now.getTime() + d * 24 * 3600 * 1000)

  const samples = [
    {
      title: 'Frontend Engineer (React 19)',
      briefDescription: 'Join a product team building Ring platform modules.',
      category: 'Engineering',
      createdBy: 'system',
      organizationId: 'sample-entity-1',
      visibility: 'public',
      dateCreated: now,
      expirationDate: addDays(30),
      tags: ['react', 'nextjs', 'typescript'],
      location: 'Cherkasy',
    },
    {
      title: 'Partnership: GovTech Pilot',
      briefDescription: 'Pilot collaboration with municipal stakeholders using ConnectPlatform.',
      category: 'Partnership',
      createdBy: 'system',
      organizationId: 'sample-entity-1',
      visibility: 'subscriber',
      dateCreated: now,
      expirationDate: addDays(45),
      tags: ['govtech', 'pilot'],
      location: 'Remote',
    },
  ]

  for (const doc of samples) {
    const ref = await col.add(doc)
    console.log('Seeded opportunity:', ref.id)
  }

  console.log('Seeding complete.')
}

main().catch((e) => {
  console.error('Seeding failed:', e)
  process.exit(1)
})


