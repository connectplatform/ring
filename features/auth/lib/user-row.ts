// Importing necessary TypeScript types for user-related fields from the local module.
// These types help define the structure of user metadata, privacy, and preferences.
import type {
  NotificationPreferences,
  PrivacyConsent,
  UserSettings,
} from '@/features/auth/types'
import type { UserRolesArray } from '@/features/auth/user-role'

// TODO: With React 19 and Next 16, migrate type imports to `import type { ... } from ...` where possible (already applied).
// TODO: Consider adding runtime zod validation for user data objects, leveraging Next.js 16 edge functions for stricter payload validation.

// The UserRow type describes a flat representation of a user document in the database.
// Column naming is a mix of snake_case (for legacy/interchange) and camelCase (for UI/app usage).
export type UserRow = Record<string, unknown> & {
  id: string // Unique user identifier, primary key
  global_user_id?: string // Optional global user cross-application identifier
  email?: string // Optional email address
  emailVerified?: string | Date | null // Nullable field, either a timestamp, string, or null; indicates email verification state
  name?: string | null // User's display name, nullable for non-profiled accounts
  username?: string // Optional unique username
  role?: UserRolesArray | string // User role(s), typed or string fallback
  photoURL?: string | null // Optional profile photo URL (nullable)
  image?: string // Deprecated/alternate image field (migrate to photoURL)
// TODO: Audit for redundant 'image' field and remove/migrate (see usage in UI components)
  nonce?: string // Token for email/passwordless flows (optional)
  nonceExpires?: number // Epoch ms when nonce expires, if present
  notificationPreferences?: NotificationPreferences // User's notification preferences
  settings?: UserSettings // Arbitrary user settings blob
  data_sharing_consent?: PrivacyConsent['dataSharingConsent'] // Value for whether user has shared data consent
  anonymized_research_consent?: boolean // Did user consent for anonymized research participation?
  contact_preferences?: PrivacyConsent['contactPreferences'] // User-specified marketing/contact preferences
  // TODO: For future-proofing, migrate to a normalized relational structure (see modular user profile RFC)
}

// STUB: Additional row types for sessions.
// TODO: Implement stricter typing and temporal validation for 'expires'.
// TODO: Prefer ISO string for date/time fields to ensure cross-environment serialization.
export type SessionRow = Record<string, unknown> & {
  id: string // Unique session identifier, primary key
  sessionToken: string // Opaque auth token for session
  userId: string // References UserRow id
  expires: Date | string // Timestamp when session expires; accept Date or ISO string
}
