/**
 * Ring Contacts Service — per-project Ring user address book
 * Provides CRUD operations and utility functions for managing Ring contacts per project.
 *
 * React 19: request memoization via `cache` from 'react' (React.cache).
 */

import { cache } from 'react'
import type { Wallet } from '@/features/auth/types'
import { UserRolesArray, parseUserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { selectDefaultWallet } from '@/features/wallet/services/utils'
import { getNativeChain, NativeChain } from '@/lib/ring-config-chain'
import { db } from '@/lib/database'
import type { AddRingContactInput, PatchRingContactInput, RingContact } from '../types'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

// Row types representing the DB structure, supporting both camelCase and snake_case for backward compat.
type RingContactRow = {
  id?: string
  owner_user_id?: string
  ownerUserId?: string
  contact_user_id?: string
  contactUserId?: string
  project_slug?: string
  projectSlug?: string
  display_name?: string
  displayName?: string
  username?: string | null
  photo_url?: string | null
  photoURL?: string | null
  wallet_address?: string | null
  walletAddress?: string | null
  notes?: string
  is_favorite?: boolean
  isFavorite?: boolean
  added_at?: string
  addedAt?: string
  last_used?: string
  lastUsed?: string
}

// Represents a row from the 'users' collection/profile resolution.
type UserProfileRow = {
  name?: string | null
  username?: string | null
  photoURL?: string | null
  role?: UserRolesArray
  wallets?: Wallet[]
}

/**
 * Map a database row to a RingContact, supporting both camel_case and camelCase for robust migration.
 * Will fallback to sensible defaults for required fields.
 *
 * @param row - Raw DB row (either casing)
 * @returns - Mapped RingContact domain object
 */
function mapRingContactRow(row: RingContactRow & { id: string }): RingContact {
  // Map fields, falling back in order: camelCase -> snake_case -> default/empty values for required props.
  // This logic ensures no unmapped shape errors in cases of field/casing drift.
  return {
    id: row.id,
    ownerUserId: row.ownerUserId ?? row.owner_user_id ?? '', // fallback to blank for safety
    contactUserId: row.contactUserId ?? row.contact_user_id ?? '',
    projectSlug: row.projectSlug ?? row.project_slug ?? '',
    displayName: row.displayName ?? row.display_name ?? '',
    username: row.username ?? null,
    photoURL: row.photoURL ?? row.photo_url ?? null,
    walletAddress: row.walletAddress ?? row.wallet_address ?? null,
    notes: row.notes,
    isFavorite: row.isFavorite ?? row.is_favorite ?? false,
    addedAt: row.addedAt ?? row.added_at ?? new Date().toISOString(), // fallback to now if missing
    lastUsed: row.lastUsed ?? row.last_used,
  }
}

/**
 * Converts a RingContact domain object to the DB-expected snake_case row.
 * Used when creating/updating documents.
 * 
 * @param ownerUserId - user's id
 * @param projectSlug - current project identifier
 * @param fields - domain-level data (camelCase)
 * @returns - snake_case row formatted for DB
 */
function toRingContactDbRow(
  ownerUserId: string,
  projectSlug: string,
  fields: {
    contactUserId: string
    displayName: string
    username?: string | null
    photoURL?: string | null
    walletAddress?: string | null
    notes?: string
    isFavorite?: boolean
    addedAt?: string
    lastUsed?: string
  },
): Record<string, unknown> {
  // Always output pure snake_case to mirror DB structure.
  return {
    owner_user_id: ownerUserId,
    project_slug: projectSlug,
    contact_user_id: fields.contactUserId,
    display_name: fields.displayName,
    username: fields.username ?? null,
    photo_url: fields.photoURL ?? null,
    wallet_address: fields.walletAddress ?? null,
    notes: fields.notes,
    is_favorite: fields.isFavorite ?? false,
    added_at: fields.addedAt ?? new Date().toISOString(),
    last_used: fields.lastUsed,
  }
}

/**
 * Main service implementation for per-project contacts CRUD and utilities.
 * Use per projectSlug.
 */
export class RingContactsServiceImpl {
  constructor(private projectSlug: string) {}

  /**
   * Loads a user profile by userId.
   * Throws an error if not found.
   *
   * @param userId - target user ID to resolve
   * @returns User profile row (with id field)
   */
  private async loadUserProfile(userId: string): Promise<UserProfileRow & { id: string }> {
    const result = await db().findDocById<UserProfileRow>('users', userId)
    if (!result.success || !result.data) {
      throw new Error('User not found')
    }
    return result.data
  }

  /**
   * Fetch a contact by its id, ensures ownership and correct project.
   * @returns contact mapped as RingContact — or null if ownership/project fails.
   */
  private async getOwnedContact(
    ownerUserId: string,
    contactId: string,
  ): Promise<RingContact | null> {
    // Lookup the contact by its DB id.
    const result = await db().findDocById<RingContactRow>('ring_contacts', contactId)
    if (!result.success || !result.data) return null
    const mapped = mapRingContactRow(result.data)
    // Validate both ownership and project boundaries before returning
    if (mapped.ownerUserId !== ownerUserId || mapped.projectSlug !== this.projectSlug) {
      return null
    }
    return mapped
  }

  /**
   * Add a new contact record (owner <-> contact), or update if one exists.
   * - Throws if trying to add yourself as a contact.
   * - Takes a fresh snapshot of the contact profile.
   *
   * @param ownerUserId - user who is adding a contact
   * @param input - contact creation payload
   * @returns RingContact that is newly created or updated
   */
  async addContact(ownerUserId: string, input: AddRingContactInput): Promise<RingContact> {
    const { contactUserId, notes } = input

    // Prevent users from adding themselves.
    if (ownerUserId === contactUserId) {
      throw new Error('Cannot add yourself as a contact')
    }

    // Load the profile for the targeted contact user (throws if missing)
    const profile = await this.loadUserProfile(contactUserId)

    // Establish the appropriate contact displayName (prefer name, fallback to username/userId)
    const displayName =
      (profile.name as string | undefined) ||
      (profile.username as string | undefined) ||
      contactUserId

    // Get the user's default wallet on the platform native chain
    const wallet = selectDefaultWallet(profile.wallets, getNativeChain())

    // Check for any pre-existing contact entry (owner, project, contact composite key)
    const existingResult = await db().queryDocs<RingContactRow>({
      collection: 'ring_contacts',
      filters: [
        { field: 'owner_user_id', operator: '==', value: ownerUserId },
        { field: 'project_slug', operator: '==', value: this.projectSlug },
        { field: 'contact_user_id', operator: '==', value: contactUserId },
      ],
      pagination: { limit: 1 },
    })

    // Map to domain or null (if not found)
    const existingRow =
      existingResult.success && existingResult.data.length > 0
        ? mapRingContactRow(existingResult.data[0])
        : null

    // Snapshot all relevant fields for this contact
    const snapshot = {
      contactUserId,
      displayName,
      username: profile.username ?? null,
      photoURL: profile.photoURL ?? null,
      walletAddress: wallet?.address ?? null,
      notes: notes ?? existingRow?.notes,
      lastUsed: new Date().toISOString(),
    }

    if (existingRow) {
      // UPDATE: Patch contact snapshot, retain addedAt and isFavorite
      const updateResult = await db().updateDoc(
        'ring_contacts',
        existingRow.id,
        toRingContactDbRow(ownerUserId, this.projectSlug, {
          ...snapshot,
          addedAt: existingRow.addedAt,
          isFavorite: existingRow.isFavorite,
        }),
      )
      if (!updateResult.success || !updateResult.data) {
        throw new Error(`Failed to update contact: ${updateResult.error?.message ?? 'unknown'}`)
      }
      return mapRingContactRow(updateResult.data)
    }

    // CREATE: Insert fresh contact document.
    const createResult = await db().createDoc(
      'ring_contacts',
      toRingContactDbRow(ownerUserId, this.projectSlug, {
        ...snapshot,
        notes, // explicit override, may differ from snapshot ? (for intent)
      }),
    )
    if (!createResult.success || !createResult.data) {
      throw new Error(`Failed to add contact: ${createResult.error?.message ?? 'unknown'}`)
    }
    return mapRingContactRow(createResult.data)
  }

  /**
   * Lists all contacts for the given owner and project.
   * Ordered descending by favorite status, then ascending display name.
   * Throws on DB query failure.
   *
   * @param ownerUserId - user whose contacts are to be listed
   * @returns full list of owned contacts as RingContact[]
   */
  async listContacts(ownerUserId: string): Promise<RingContact[]> {
    // Query all "owned" contacts for the current project with sensible sorting.
    const result = await db().queryDocs<RingContactRow>({
      collection: 'ring_contacts',
      filters: [
        { field: 'owner_user_id', operator: '==', value: ownerUserId },
        { field: 'project_slug', operator: '==', value: this.projectSlug },
      ],
      orderBy: [
        { field: 'is_favorite', direction: 'desc' }, // true comes before false
        { field: 'display_name', direction: 'asc' },
      ],
    })

    if (!result.success) {
      throw new Error(`Failed to list contacts: ${result.error?.message ?? 'unknown'}`)
    }
    // Map result rows to domain shape
    return result.data.map((row) => mapRingContactRow(row))
  }

  /**
   * Removes/deletes a contact only if it belongs to the owner in the active project.
   * Throws if contact is not owned or not found.
   *
   * @param ownerUserId - user requesting the removal
   * @param contactId - id of the contact to be removed
   */
  async removeContact(ownerUserId: string, contactId: string): Promise<void> {
    // Validate ownership and project before deletion
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) {
      throw new Error('Contact not found')
    }

    // Delete the contact document
    const result = await db().deleteDoc('ring_contacts', contactId)
    if (!result.success) {
      throw new Error(`Failed to remove contact: ${result.error?.message ?? 'unknown'}`)
    }
  }

  /**
   * Patch only the notes and/or favorite flag for a contact.
   * Throws if not found or not owned.
   *
   * @param ownerUserId - must own the contact
   * @param contactId - contact doc ID
   * @param patch - partial patch (notes, isFavorite)
   * @returns patched RingContact shape
   */
  async patchContact(
    ownerUserId: string,
    contactId: string,
    patch: PatchRingContactInput,
  ): Promise<RingContact> {
    // Ownership enforcement.
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) {
      throw new Error('Contact not found')
    }

    // Accept only patchable fields.
    const updateResult = await db().updateDoc('ring_contacts', contactId, {
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.isFavorite !== undefined ? { is_favorite: patch.isFavorite } : {}),
    })

    if (!updateResult.success || !updateResult.data) {
      throw new Error(`Failed to update contact: ${updateResult.error?.message ?? 'unknown'}`)
    }

    return mapRingContactRow(updateResult.data)
  }

  /**
   * Update the last_used timestamp for a contact, only if it is owned.
   * This is a silent no-op if not found or not owned.
   *
   * @param ownerUserId - only if owner
   * @param contactId
   */
  async touchLastUsed(ownerUserId: string, contactId: string): Promise<void> {
    // Skip (silent) if not owned
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) return

    // Write last_used timestamp (ISO format)
    await db().updateDoc('ring_contacts', contactId, {
      last_used: new Date().toISOString(),
    })
  }

  /**
   * Find and return the native-chain wallet address for a contact user.
   * Provisions via WalletConductor when missing.
   */
  async resolveRecipientWallet(contactUserId: string): Promise<string> {
    const profile = await this.loadUserProfile(contactUserId)
    const nativeChain: NativeChain = getNativeChain()

    const existing = selectDefaultWallet(profile.wallets, nativeChain)
    if (existing?.address) {
      return existing.address
    }

    const role =
      parseUserRolesArray(profile.role) ??
      (resolveSessionUserRole(profile.role) as UserRolesArray | null) ??
      UserRolesArray.subscriber

    const ensured = await WalletConductor.ensureNativeWallet({
      id: contactUserId,
      role,
    })
    if (!ensured.ok || !ensured.native?.address) {
      throw new Error(ensured.error || 'Wallet not found')
    }
    return ensured.native.address
  }
}

/** Per-project RingContactsService — React 19 `cache` request memoization. */
export const createRingContactsService = cache(
  (projectSlug: string): RingContactsServiceImpl => new RingContactsServiceImpl(projectSlug),
)

/** Current project singleton for this request. */
export const getCurrentRingContactsService = cache((): RingContactsServiceImpl => {
  const projectSlug =
    getSystemConfigSnapshot().clone.name ??
    process.env.NEXT_PUBLIC_PROJECT_SLUG ??
    'ring'
  return createRingContactsService(projectSlug)
})
