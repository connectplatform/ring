/**
 * Find-or-create user for Ring Mailer OTP / magic-link sign-in.
 */
import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/database'
import {
  createOAuthUserFromGooglePayload,
  findUserByEmail,
  isUniqueViolation,
  normalizeAuthEmail,
  type UserRow,
} from '@/features/auth/services/user-resolve'
import { UserRolesArray } from '@/features/auth/user-role'

/**
 * Ensure a users row exists for passwordless email auth.
 * Marks emailVerified when the flow already proved inbox ownership.
 */
export async function ensureEmailAuthUser(email: string): Promise<UserRow> {
  const normalized = normalizeAuthEmail(email)
  const existing = await findUserByEmail(normalized)
  if (existing) {
    if (!existing.emailVerified) {
      await db().updateDoc('users', existing.id, {
        emailVerified: new Date(),
        isVerified: true,
        updatedAt: new Date(),
        lastLogin: new Date(),
      })
    } else {
      await db().updateDoc('users', existing.id, {
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
    }
    return existing
  }

  const userId = randomUUID()
  try {
    return await createOAuthUserFromGooglePayload({
      userId,
      email: normalized,
      name: null,
      image: null,
      emailVerified: new Date(),
      role: UserRolesArray.visitor,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findUserByEmail(normalized)
      if (raced) return raced
    }
    throw error
  }
}
