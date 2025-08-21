'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthUser, UserRole } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'

/**
 * Auth status navigation types
 */
type AuthAction = 'login' | 'register' | 'verify' | 'reset-password' | 'kyc'
type AuthStatus = string

/**
 * Auth hook return interface
 */
interface UseAuthReturn {
  user: AuthUser | null
  role: UserRole | null
  loading: boolean
  hasRole: (requiredRole: UserRole) => boolean
  isAuthenticated: boolean
  navigateToAuthStatus: (action: AuthAction, status: AuthStatus, options?: {
    email?: string
    requestId?: string
    returnTo?: string
  }) => void
  getKycStatus: () => 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | null
  refreshSession: () => Promise<void>
}

/**
 * Role hierarchy for access control
 */
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const

/**
 * Auth hook with type-safe role checking and status page integration
 * 
 * Provides user state, loading status, role validation, and auth flow navigation.
 * Works with Auth.js v5, React 19/Next 15, and unified auth status pages.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, hasRole, navigateToAuthStatus, getKycStatus } = useAuth()
 *   
 *   // Check user permissions
 *   if (!hasRole(UserRole.MEMBER)) return <AccessDenied />
 *   
 *   // Navigate to KYC flow
 *   const handleKyc = () => {
 *     const status = getKycStatus()
 *     if (status === 'not_started') {
 *       navigateToAuthStatus('kyc', 'not_started', { 
 *         returnTo: '/profile' 
 *       })
 *     }
 *   }
 * }
 * ```
 * 
 * @returns Auth state with helper methods
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Loading state
  const loading = status === 'loading'
  
  // Authentication state
  const isAuthenticated = status === 'authenticated' && !!session?.user
  
  // Extract user role from session
  const role = (session?.user as any)?.role as UserRole || null
  
  // Map Auth.js session to AuthUser type
  const user: AuthUser | null = isAuthenticated && session?.user ? {
    id: session.user.id || '',
    email: session.user.email || '',
    emailVerified: (session.user as any).emailVerified || null,
    name: session.user.name || null,
    role: role || UserRole.SUBSCRIBER,
    photoURL: session.user.image || null,
    wallets: [], // Will be populated from server/database
    authProvider: (session.user as any).provider || 'credentials',
    authProviderId: session.user.id || '',
    isVerified: (session.user as any).isVerified || false,
    createdAt: new Date((session.user as any).createdAt || Date.now()),
    lastLogin: new Date((session.user as any).lastLogin || Date.now()),
    bio: (session.user as any).bio || '',
    canPostconfidentialOpportunities: role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[UserRole.CONFIDENTIAL] : false,
    canViewconfidentialOpportunities: role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[UserRole.CONFIDENTIAL] : false,
    postedopportunities: (session.user as any).postedopportunities || [],
    savedopportunities: (session.user as any).savedopportunities || [],
    notificationPreferences: {
      email: (session.user as any).notificationPreferences?.email ?? true,
      inApp: (session.user as any).notificationPreferences?.inApp ?? true,
      sms: (session.user as any).notificationPreferences?.sms ?? false,
    },
    settings: {
      language: (session.user as any).settings?.language || 'en',
      theme: (session.user as any).settings?.theme || 'light',
      notifications: (session.user as any).settings?.notifications ?? true,
      notificationPreferences: {
        email: (session.user as any).settings?.notificationPreferences?.email ?? true,
        inApp: (session.user as any).settings?.notificationPreferences?.inApp ?? true,
        sms: (session.user as any).settings?.notificationPreferences?.sms ?? false,
      },
    },
    nonce: (session.user as any).nonce,
    nonceExpires: (session.user as any).nonceExpires,
    kycVerification: (session.user as any).kycVerification,
    pendingUpgradeRequest: (session.user as any).pendingUpgradeRequest,
  } : null

  /**
   * Check if user has required role or higher
   */
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!isAuthenticated || !role) return false
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole]
  }

  /**
   * Navigate to auth status page
   */
  const navigateToAuthStatus = (
    action: AuthAction,
    status: AuthStatus,
    options?: {
      email?: string
      requestId?: string
      returnTo?: string
    }
  ) => {
    // Extract locale from current pathname
    const locale = pathname.split('/')[1] as Locale || 'en'
    
    // Build URL with query parameters
    const searchParams = new URLSearchParams()
    if (options?.email) searchParams.set('email', options.email)
    if (options?.requestId) searchParams.set('requestId', options.requestId)
    if (options?.returnTo) searchParams.set('returnTo', options.returnTo)
    
    const statusUrl = `/${locale}/auth/${action}/${status}`
    const finalUrl = searchParams.toString() 
      ? `${statusUrl}?${searchParams.toString()}`
      : statusUrl
    
    router.push(finalUrl)
  }

  /**
   * Get user's KYC verification status
   */
  const getKycStatus = (): 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | null => {
    if (!user?.kycVerification) return 'not_started'
    
    const kyc = user.kycVerification
    
    // Check if expired
    if (kyc.expiresAt && new Date(kyc.expiresAt) < new Date()) {
      return 'expired'
    }
    
    // Return current status
    switch (kyc.status) {
      case 'pending':
        return 'pending'
      case 'under_review':
        return 'under_review'
      case 'approved':
        return 'approved'
      case 'rejected':
        return 'rejected'
      default:
        return 'not_started'
    }
  }

  /**
   * Refresh session data from server
   */
  const refreshSession = async (): Promise<void> => {
    try {
      await update()
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  return {
    user,
    role,
    loading,
    hasRole,
    isAuthenticated,
    navigateToAuthStatus,
    getKycStatus,
    refreshSession,
  }
}

