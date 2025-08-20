#!/usr/bin/env ts-node
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin.server'

async function main() {
  const db = getAdminDb()
  const auth = getAdminAuth()

  const email = process.env.SEED_SUPERADMIN_EMAIL || 'admin@myri.ng'
  const password = process.env.SEED_SUPERADMIN_PASSWORD || '12345'

  // Ensure user exists in Firebase Auth (if using email/password, you'd set via Admin SDK custom import)
  let userRecord
  try {
    userRecord = await auth.getUserByEmail(email)
  } catch {
    userRecord = await auth.createUser({ email, emailVerified: true, password, displayName: 'Super Admin' })
  }

  const userId = userRecord.uid
  await db.collection('users').doc(userId).set({
    id: userId,
    email,
    role: 'admin',
    isSuperAdmin: true,
    isVerified: true,
    createdAt: new Date(),
    lastLogin: new Date(),
  }, { merge: true })

  console.log('Seeded superadmin:', { userId, email })
}

main().catch(err => { console.error(err); process.exit(1) })
