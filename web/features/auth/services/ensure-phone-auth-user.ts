/**
 * Find-or-create user for passwordless phone OTP sign-in (virtual-email mailbox).
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
import { normalizeToE164 } from '@/lib/phone/e164'
import {
  isVirtualEmail,
  toVirtualEmail,
} from '@/lib/auth/virtual-email'

/**
 * Resolve existing user by E.164 phone (phone / phoneNumber) or virtual-email local-part.
 */
export async function findUserByPhone(rawPhone: string): Promise<UserRow | null> {
  const e164 = normalizeToE164(rawPhone)
  if (!e164) return null

  const byPhoneNumber = await db().queryDocs<UserRow>({
    collection: 'users',
    filters: [{ field: 'phoneNumber', operator: '==', value: e164 }],
    pagination: { limit: 5 },
  })
  if (byPhoneNumber.success && byPhoneNumber.data.length > 0) {
    return byPhoneNumber.data[0]
  }

  const byPhone = await db().queryDocs<UserRow>({
    collection: 'users',
    filters: [{ field: 'phone', operator: '==', value: e164 }],
    pagination: { limit: 5 },
  })
  if (byPhone.success && byPhone.data.length > 0) {
    return byPhone.data[0]
  }

  const virtual = toVirtualEmail(e164)
  if (virtual) {
    const byVirtual = await findUserByEmail(virtual)
    if (byVirtual) return byVirtual
  }

  return null
}

/**
 * Ensure a users row exists for phone OTP auth.
 * Creates with virtual-email when missing. Sets phoneVerifiedAt only when markVerified.
 */
export async function ensurePhoneAuthUser(
  rawPhone: string,
  opts?: { markVerified?: boolean },
): Promise<UserRow> {
  const e164 = normalizeToE164(rawPhone)
  if (!e164) throw new Error('Invalid phone for ensurePhoneAuthUser')

  const virtual = toVirtualEmail(e164)
  if (!virtual) throw new Error('Could not synthesize virtual-email for phone')

  const existing = await findUserByPhone(e164)
  if (existing) {
    const patch: Record<string, unknown> = {
      lastLogin: new Date(),
      updatedAt: new Date(),
      phone: e164,
      phoneNumber: e164,
    }
    if (opts?.markVerified) {
      patch.phoneVerifiedAt = new Date().toISOString()
    }
    // Backfill virtual flags if this was an older phone-only row
    if (!existing.email || isVirtualEmail(existing)) {
      patch.email = normalizeAuthEmail(String(existing.email || virtual))
      patch.emailKind = 'virtual_phone'
      patch.isVirtualEmail = true
    }
    await db().updateDoc('users', existing.id, patch)
    return { ...existing, ...patch } as UserRow
  }

  const userId = randomUUID()
  try {
    const created = await createOAuthUserFromGooglePayload({
      userId,
      email: virtual,
      name: null,
      image: null,
      emailVerified: null,
      role: UserRolesArray.visitor,
    })

    const nowIso = new Date().toISOString()
    const phonePatch: Record<string, unknown> = {
      phone: e164,
      phoneNumber: e164,
      emailKind: 'virtual_phone',
      isVirtualEmail: true,
      // Do not mark emailVerified for virtual mailboxes
      emailVerified: null,
      isVerified: false,
      updatedAt: new Date(),
    }
    if (opts?.markVerified) {
      phonePatch.phoneVerifiedAt = nowIso
    }

    await db().updateDoc('users', created.id, phonePatch)
    return { ...created, ...phonePatch } as UserRow
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findUserByPhone(e164)
      if (raced) return raced
      const byEmail = await findUserByEmail(virtual)
      if (byEmail) return byEmail
    }
    throw error
  }
}

/** Persist phoneVerifiedAt after successful Gateway code_valid. */
export async function markPhoneVerified(userId: string, e164: string): Promise<void> {
  const phone = normalizeToE164(e164)
  if (!phone) return
  await db().updateDoc('users', userId, {
    phone,
    phoneNumber: phone,
    phoneVerifiedAt: new Date().toISOString(),
    updatedAt: new Date(),
  })
}
