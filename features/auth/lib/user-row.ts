import type {
  NotificationPreferences,
  PrivacyConsent,
  UserRole,
  UserSettings,
  Wallet,
} from '@/features/auth/types'

/** Flat `users` collection row shape (mixed snake/camel columns). */
export type UserRow = Record<string, unknown> & {
  id: string
  global_user_id?: string
  email?: string
  emailVerified?: string | Date | null
  name?: string | null
  username?: string
  role?: UserRole | string
  photoURL?: string | null
  image?: string
  wallets?: Wallet[]
  authProvider?: string
  authProviderId?: string
  isVerified?: boolean
  createdAt?: string | Date
  lastLogin?: string | Date
  account_status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'DELETED'
  bio?: string
  phoneNumber?: string
  organization?: string
  position?: string
  canPostconfidentialOpportunities?: boolean
  canViewconfidentialOpportunities?: boolean
  postedopportunities?: string[]
  savedopportunities?: string[]
  nonce?: string
  nonceExpires?: number
  notificationPreferences?: NotificationPreferences
  settings?: UserSettings
  data_sharing_consent?: PrivacyConsent['dataSharingConsent']
  anonymized_research_consent?: boolean
  contact_preferences?: PrivacyConsent['contactPreferences']
}

export type SessionRow = Record<string, unknown> & {
  id: string
  sessionToken: string
  userId: string
  expires: Date | string
}
