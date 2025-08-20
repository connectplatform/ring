// BetterAuth type extensions for Ring project
import type { UserRole } from '@/features/auth/types'
import type { Wallet } from '@/features/auth/types'

declare module "better-auth" {
  interface User {
    // Ring-specific user properties
    role: UserRole
    wallets?: Wallet[]
    isSuperAdmin?: boolean
    isVerified?: boolean
    username?: string
    authProvider?: string
    authProviderId?: string
    lastLogin?: Date
    metadata?: Record<string, any>
    preferences?: {
      notifications?: {
        email?: boolean
        push?: boolean
        sms?: boolean
      }
      privacy?: {
        showEmail?: boolean
        showProfile?: boolean
      }
      locale?: string
      theme?: string
    }
  }

  interface Session {
    // Ring-specific session properties
    user: User
    expiresAt?: Date
  }
}
