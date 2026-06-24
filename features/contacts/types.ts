/**
 * Ring contact — saved Ring user within a project (address book).
 */
export interface RingContact {
  id: string
  ownerUserId: string
  contactUserId: string
  projectSlug: string
  displayName: string
  username?: string | null
  photoURL?: string | null
  walletAddress?: string | null
  notes?: string
  isFavorite?: boolean
  addedAt: string
  lastUsed?: string
}

export interface AddRingContactInput {
  contactUserId: string
  notes?: string
}

export interface PatchRingContactInput {
  notes?: string
  isFavorite?: boolean
}
