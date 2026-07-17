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
  /**
   * Live (or snapshotted) KYC/admin verification badge from the contact user.
   * Prefer enriching from `users.isVerified` at list/read time so badges stay current.
   */
  isVerified?: boolean
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
