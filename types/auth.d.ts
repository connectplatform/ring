import { UserRole, Wallet, NotificationPreferences, UserSettings, KYCVerification, RoleUpgradeRequest } from '@/features/auth/types'

declare module 'better-auth/types' {
  interface User {
    id: string
    email: string
    emailVerified: Date | null // Changed to match AuthUser interface  
    name: string
    createdAt: Date
    updatedAt: Date
    image?: string
    // Ring-specific custom fields - all properties from AuthUser interface
    role: UserRole
    wallets: Wallet[]
    isSuperAdmin: boolean
    isVerified: boolean
    username?: string
    authProvider: string
    authProviderId: string
    lastLogin: Date
    bio?: string
    canPostconfidentialOpportunities: boolean
    canViewconfidentialOpportunities: boolean
    postedopportunities: string[]
    savedopportunities: string[]
    nonce?: string
    nonceExpires?: number
    notificationPreferences: NotificationPreferences
    settings: UserSettings
    kycVerification?: KYCVerification
    pendingUpgradeRequest?: RoleUpgradeRequest
    photoURL?: string
  }

  interface Session {
    user: User
    id: string
    createdAt: Date
    updatedAt: Date
    expiresAt: Date
    token: string
    ipAddress?: string
    userAgent?: string
  }
}

// Also declare for the client
declare module 'better-auth/client' {
  interface User {
    id: string
    email: string
    emailVerified: Date | null // Changed to match AuthUser interface
    name: string
    createdAt: Date
    updatedAt: Date
    image?: string
    // Ring-specific custom fields - all properties from AuthUser interface
    role: UserRole
    wallets: Wallet[]
    isSuperAdmin: boolean
    isVerified: boolean
    username?: string
    authProvider: string
    authProviderId: string
    lastLogin: Date
    bio?: string
    canPostconfidentialOpportunities: boolean
    canViewconfidentialOpportunities: boolean
    postedopportunities: string[]
    savedopportunities: string[]
    nonce?: string
    nonceExpires?: number
    notificationPreferences: NotificationPreferences
    settings: UserSettings
    kycVerification?: KYCVerification
    pendingUpgradeRequest?: RoleUpgradeRequest
    photoURL?: string
  }
}

export {}