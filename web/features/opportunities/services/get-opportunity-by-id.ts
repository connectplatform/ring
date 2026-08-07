/**
 * Get Opportunity By ID Service
 *
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation cached for performance using React's cache().
 *
 * Service functions in this file fetch a single opportunity by ID,
 * perform access checks, serialize opportunity data, and manage errors
 * in a way compatible with React Server Components.
 */

// Import React 19 cache API for server-side memoization
import { cache } from 'react'
// Types for opportunity domain objects
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
// User roles and role assertion utilities
import { UserRolesArray } from '@/features/auth/user-role'
import { assertKnownUserRole } from '@/features/auth/user-role'
// Opportunity visibility logic
import { canViewOpportunity } from '@/features/opportunities/lib/opportunity-visibility-filter'
// Authentication utility (presumed SSR-safe)
import { auth } from '@/auth'
// Database service accessor
import { db } from '@/lib/database'
// Utility functions to map DB responses to domain types
import {
  mapDbDocumentToOpportunity,
  mapDbRowToSerializedOpportunity,
} from '@/features/opportunities/lib/opportunity-db-mapper'

// -------------------------------
// Error classes for explicit error handling
// -------------------------------

// Thrown if an opportunity could not be found by its ID in the database
export class OpportunityNotFoundError extends Error {
  constructor(id: string) {
    super(`Opportunity not found`)
    this.name = 'OpportunityNotFoundError'
  }
}

// Thrown if a user lacks authorization to access an opportunity
export class OpportunityAccessDeniedError extends Error {
  constructor(reason: string) {
    super(`Access denied: ${reason}`)
    this.name = 'OpportunityAccessDeniedError'
  }
}

// -------------------------------
// Main service: Opportunity fetching by ID, with RBAC and caching
// -------------------------------

// TODO: Use React 19's new cache API for deduped async server fetches
// TODO: Consider Next.js Route Handlers and partial pre-rendering for low-latency public reads

/**
 * Fetches an Opportunity by its ID with full user context and access checks.
 * This function is server-only, uses cache() for deduplication, and throws well-defined errors.
 */
export const getOpportunityById = cache(async (id: string): Promise<Opportunity | null> => {
  // Authenticate the user session from the request context
  const session = await auth()
  if (!session || !session.user) {
    // Block access if the user is not authenticated
    throw new OpportunityAccessDeniedError('Authentication required')
  }

  // Type-check the user's role for stricter access checks
  const userRole = assertKnownUserRole(session.user.role) as UserRolesArray

  // Query the database for the opportunity document
  const result = await db().findDocById<Record<string, unknown>>('opportunities', id)

  if (!result.success || !result.data) {
    // DB did not find this opportunity, but opts to return null (not throwing)
    return null
  }

  // Convert the raw DB data to a typed Opportunity object
  const opportunity = mapDbDocumentToOpportunity(result.data)

  // RBAC: Check whether the user can view this opportunity, else throw access-denied
  if (!canViewOpportunity(opportunity, { userRole, userId: session.user.id })) {
    throw new OpportunityAccessDeniedError(
      'Insufficient role to view this opportunity',
    )
  }

  // Opportunity passes all checks, return it
  return opportunity
  // NOTE: Uncaught exceptions will propagate to route/error boundary.
})
// NOTE: No try/catch block is needed unless there's a desire to mask internal exceptions with generic errors (which can hide valuable debugging info in dev).
// TODO: Can leverage RSC error boundaries for user-facing rendering instead of masking errors here.

/**
 * Fetches a serialized (safe-to-send-to-client) Opportunity by ID.
 * Calls getOpportunityById for access checks first.
 */
export const getSerializedOpportunityById = cache(async (id: string): Promise<SerializedOpportunity | null> => {
  // Fetch Opportunity (with RBAC); may throw or return null if not found/authorized
  const opportunity = await getOpportunityById(id)
  if (!opportunity) {
    return null
  }
  // Map DB/domain object to a flat, serialized variant for API/json transport
  return mapDbRowToSerializedOpportunity(
    id,
    opportunity as unknown as Record<string, unknown>,
  )
  // NOTE: Exceptions propagate; error handling should be done at the API/controller layer.
})

// -------------------------------
// Unrestricted opportunity fetch for internal calls (no session required)
// -------------------------------

// TODO: Replace or restrict getOpportunity to avoid leaking confidential data
// TODO: Consider returning a version for public-only/non-confidential items with RFC: cache tags for more flexible SWR
/**
 * Fetches an Opportunity by ID with *no* user access checks.
 * Confidential opportunities are hidden (null).
 * Intended for internal/server use (should NOT be exposed to clients directly).
 */
export const getOpportunity = cache(async (opportunityId: string): Promise<Opportunity | null> => {
  // MOCK CODE, TODO: Implement more robust error handling and logging for internal monitoring
  // Step 1: Query for the opportunity in DB
  const result = await db().findDocById<Record<string, unknown>>('opportunities', opportunityId)

  // Step 2: If result found, process data
  if (result.success && result.data) {
    const opportunity = mapDbDocumentToOpportunity(result.data)
    // Do not return confidential opportunities in this context (anonymous/public/SSR?)
    if (opportunity.isConfidential) {
      return null
    }
    return opportunity
  }

  // Path: Not found or database error; silent null
  return null
})
