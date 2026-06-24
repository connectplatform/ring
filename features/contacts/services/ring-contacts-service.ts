/**
 * Ring Contacts Service — per-project Ring user address book
 */

import { cache } from 'react'
import type { Wallet } from '@/features/auth/types'
import { UserRole, parseUserRole } from '@/features/auth/user-role'
import { ensureWallets } from '@/features/wallet/services/ensure-wallet'
import { selectDefaultWallet } from '@/features/wallet/services/utils'
import { getNativeChain } from '@/lib/ring-config-chain'
import { db } from '@/lib/database'
import type { AddRingContactInput, PatchRingContactInput, RingContact } from '../types'

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

type UserProfileRow = {
  name?: string | null
  username?: string | null
  photoURL?: string | null
  role?: string
  wallets?: Wallet[]
}

function mapRingContactRow(row: RingContactRow & { id: string }): RingContact {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId ?? row.owner_user_id ?? '',
    contactUserId: row.contactUserId ?? row.contact_user_id ?? '',
    projectSlug: row.projectSlug ?? row.project_slug ?? '',
    displayName: row.displayName ?? row.display_name ?? '',
    username: row.username ?? null,
    photoURL: row.photoURL ?? row.photo_url ?? null,
    walletAddress: row.walletAddress ?? row.wallet_address ?? null,
    notes: row.notes,
    isFavorite: row.isFavorite ?? row.is_favorite ?? false,
    addedAt: row.addedAt ?? row.added_at ?? new Date().toISOString(),
    lastUsed: row.lastUsed ?? row.last_used,
  }
}

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

class RingContactsServiceImpl {
  constructor(private projectSlug: string) {}

  private async loadUserProfile(userId: string): Promise<UserProfileRow & { id: string }> {
    const result = await db().findDocById<UserProfileRow>('users', userId)
    if (!result.success || !result.data) {
      throw new Error('User not found')
    }
    return result.data
  }

  private async getOwnedContact(
    ownerUserId: string,
    contactId: string,
  ): Promise<RingContact | null> {
    const result = await db().findDocById<RingContactRow>('ring_contacts', contactId)
    if (!result.success || !result.data) return null
    const mapped = mapRingContactRow(result.data)
    if (mapped.ownerUserId !== ownerUserId || mapped.projectSlug !== this.projectSlug) {
      return null
    }
    return mapped
  }

  async addContact(ownerUserId: string, input: AddRingContactInput): Promise<RingContact> {
    const { contactUserId, notes } = input

    if (ownerUserId === contactUserId) {
      throw new Error('Cannot add yourself as a contact')
    }

    const profile = await this.loadUserProfile(contactUserId)
    const displayName =
      (profile.name as string | undefined) ||
      (profile.username as string | undefined) ||
      contactUserId
    const wallet = selectDefaultWallet(profile.wallets)

    const existingResult = await db().queryDocs<RingContactRow>({
      collection: 'ring_contacts',
      filters: [
        { field: 'owner_user_id', operator: '==', value: ownerUserId },
        { field: 'project_slug', operator: '==', value: this.projectSlug },
        { field: 'contact_user_id', operator: '==', value: contactUserId },
      ],
      pagination: { limit: 1 },
    })

    const existingRow =
      existingResult.success && existingResult.data.length > 0
        ? mapRingContactRow(existingResult.data[0])
        : null

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

    const createResult = await db().createDoc(
      'ring_contacts',
      toRingContactDbRow(ownerUserId, this.projectSlug, {
        ...snapshot,
        notes,
      }),
    )
    if (!createResult.success || !createResult.data) {
      throw new Error(`Failed to add contact: ${createResult.error?.message ?? 'unknown'}`)
    }
    return mapRingContactRow(createResult.data)
  }

  async listContacts(ownerUserId: string): Promise<RingContact[]> {
    const result = await db().queryDocs<RingContactRow>({
      collection: 'ring_contacts',
      filters: [
        { field: 'owner_user_id', operator: '==', value: ownerUserId },
        { field: 'project_slug', operator: '==', value: this.projectSlug },
      ],
      orderBy: [
        { field: 'is_favorite', direction: 'desc' },
        { field: 'display_name', direction: 'asc' },
      ],
    })

    if (!result.success) {
      throw new Error(`Failed to list contacts: ${result.error?.message ?? 'unknown'}`)
    }

    return result.data.map((row) => mapRingContactRow(row))
  }

  async removeContact(ownerUserId: string, contactId: string): Promise<void> {
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) {
      throw new Error('Contact not found')
    }

    const result = await db().deleteDoc('ring_contacts', contactId)
    if (!result.success) {
      throw new Error(`Failed to remove contact: ${result.error?.message ?? 'unknown'}`)
    }
  }

  async patchContact(
    ownerUserId: string,
    contactId: string,
    patch: PatchRingContactInput,
  ): Promise<RingContact> {
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) {
      throw new Error('Contact not found')
    }

    const updateResult = await db().updateDoc('ring_contacts', contactId, {
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.isFavorite !== undefined ? { is_favorite: patch.isFavorite } : {}),
    })

    if (!updateResult.success || !updateResult.data) {
      throw new Error(`Failed to update contact: ${updateResult.error?.message ?? 'unknown'}`)
    }

    return mapRingContactRow(updateResult.data)
  }

  async touchLastUsed(ownerUserId: string, contactId: string): Promise<void> {
    const owned = await this.getOwnedContact(ownerUserId, contactId)
    if (!owned) return

    await db().updateDoc('ring_contacts', contactId, {
      last_used: new Date().toISOString(),
    })
  }

  /**
   * Resolve on-chain recipient address; auto-ensures wallet for contact user when absent.
   */
  async resolveRecipientWallet(contactUserId: string): Promise<string> {
    const profile = await this.loadUserProfile(contactUserId)
    const nativeChain = getNativeChain()
    let wallet = selectDefaultWallet(profile.wallets, nativeChain)

    if (!wallet) {
      const role = parseUserRole(profile.role) ?? UserRole.subscriber
      wallet = (await ensureWallets({ id: contactUserId, role })).native
    }

    return wallet.address
  }
}

export const createRingContactsService = cache(
  (projectSlug: string): RingContactsServiceImpl => new RingContactsServiceImpl(projectSlug),
)

export const getCurrentRingContactsService = cache((): RingContactsServiceImpl => {
  const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring_platform'
  return createRingContactsService(projectSlug)
})

export type { RingContactsServiceImpl }
