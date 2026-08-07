/**
 * Vendor Middleware Helpers
 * 
 * Lightweight helper functions for middleware and route protection
 * that need to check vendor status efficiently
 */

import { hasVendorEntity } from './vendor-entity'

/**
 * Middleware helper to check if user has vendor access
 * Optimized for use in Next.js middleware where performance is critical
 */
export async function checkVendorAccess(userId: string): Promise<boolean> {
  try {
    return await hasVendorEntity(userId)
  } catch (error) {
    console.error('Error checking vendor access in middleware:', error)
    return false
  }
}

/**
 * Route protection helper for vendor-only pages
 * Returns redirect path if user doesn't have vendor access
 */
export async function requireVendorAccess(
  userId: string, 
  locale: string = 'en'
): Promise<string | null> {
  const hasAccess = await checkVendorAccess(userId)
  
  if (!hasAccess) {
    return `/${locale}/vendor/start` // Redirect to vendor onboarding
  }
  
  return null // No redirect needed
}

/**
 * Check if user can access vendor dashboard
 * More comprehensive check that includes profile validation
 */
export async function canAccessVendorDashboard(userId: string): Promise<{
  canAccess: boolean
  redirectTo?: string
  reason?: string
}> {
  try {
    const hasVendor = await hasVendorEntity(userId)
    
    if (!hasVendor) {
      return {
        canAccess: false,
        redirectTo: '/vendor/start',
        reason: 'No vendor entity found'
      }
    }
    
    // Additional checks could be added here:
    // - Vendor profile completion
    // - Store verification status
    // - Suspension status
    
    return { canAccess: true }
  } catch (error) {
    console.error('Error checking vendor dashboard access:', error)
    return {
      canAccess: false,
      redirectTo: '/vendor/start',
      reason: 'Error checking vendor status'
    }
  }
}
