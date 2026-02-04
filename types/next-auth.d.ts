import NextAuth from "next-auth"
import 'next-auth'
import 'next-auth/jwt'
import { UserRole, UserSettings, Wallet, AuthUser, ExtendedProfile } from "@/features/auth/types"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      username?: string
      image?: string | null
      photoURL?: string | null
      role: UserRole
      isVerified: boolean
      needsOnboarding?: boolean
      provider?: string
      settings?: UserSettings
      wallets?: Wallet[]
      notificationPreferences?: {
        email: boolean
        inApp: boolean
        sms?: boolean
      }
    }
    accessToken?: string
    refreshToken?: string
    needsOnboarding?: boolean
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User {
    id: string
    email: string
    name?: string | null
    username?: string
    image?: string | null
    photoURL?: string | null
    role?: UserRole
    isVerified?: boolean
    createdAt?: Date
    lastLogin?: Date
    needsOnboarding?: boolean
    provider?: string
    wallets?: Wallet[]
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    userId?: string
    username?: string
    role?: UserRole
    accessToken?: string
    refreshToken?: string
    wallets?: Wallet[]
    authProvider?: string
    authProviderId?: string
    isVerified?: boolean
    createdAt?: Date
    lastLogin?: Date
    provider?: string
    needsOnboarding?: boolean
    photoURL?: string
  }
}

