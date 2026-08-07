import {
  hasConfidentialAccess,           // Permission check for confidential entities
  hasMemberPrivileges,              // Checks if user is a member (higher privilege)
  isPlatformAdmin,                  // Checks if user is an admin (highest privilege)
  parseUserRolesArray,              // Attempts to parse user role string/ID to internal structure
  resolveSessionUserRole,           // Fallback to resolve user-role from current session info
  UserRolesArray,                   // Enum/array of all possible user roles
} from '@/features/auth/user-role'
import type { EntityVisibility } from '@/features/entities/lib/entity-visibility-filter'
import { getAllowedEntityVisibilityValues } from '@/features/entities/lib/entity-visibility-filter'

// Interface describing options used when creating a new entity (for example, driven by API request).
export interface EntityCreateOptions {
  isConfidential?: boolean      // Flag indicates entity should be created as confidential.
}

// Interface for PATCHing entity's visibility/confidential fields in update operations.
export interface EntityVisibilityPatch {
  visibility?: EntityVisibility    // New proposed visibility level
  isConfidential?: boolean         // Proposal to mark entity as confidential (on update)
}

/**
 * Checks permissions for creating a new entity according to the user's role and options.
 * 
 * Steps:
 * 1. Attempts to parse the user's role, using the helper or session fallback. 
 *    // STUB: If parseUserRolesArray is a stub, implement full user role parsing from available contexts and request sources.
 *    // TODO: Consider switching this to use a Next.js server-only function if in Next 13+/16+ to guarantee authentication from server context.
 * 2. If parsing fails, deny permission to create.
 * 3. Confidential creations explicitly require confidential access.
 * 4. If creation is *not* confidential, permit if user:
 *      - Has member privileges, 
 *      - Is a platform admin, 
 *      - Or is mapped directly as 'confidential' (enum-safety backup?).
 *
 * NOTE: Backend and frontend role logic must remain consistent, or escalation bugs may occur.
 */
export function canCreateEntity(
  role: string | null | undefined,
  options: EntityCreateOptions = {},
): boolean {
  // Try parsing the user role using enums/arrays, falling back to session if needed.
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  // COMMENT: No role found = fail closed (deny access).
  if (!parsed) return false

  // COMMENT: Creating confidential entity requires elevated access; verify user permission.
  if (options.isConfidential) {
    return hasConfidentialAccess(parsed)
  }

  // COMMENT: Allow non-confidential creation for member, admin, or explicit 'confidential' mapping.
  return (
    hasMemberPrivileges(parsed) ||
    isPlatformAdmin(parsed) ||
    parsed === UserRolesArray.confidential
  )
}

/**
 * Determines if a user may set/change the visibility or confidentiality of an entity update.
 * 
 * Steps:
 * 1. Parse or resolve the user's permissions as above.
 *    // STUB: If parseUserRolesArray or resolveSessionUserRole are stubbed, fill in session/user role resolution, including edge handling for serverless/server contexts.
 * 2. Deny if no recognizable user role.
 * 3. If next state attempts to make entity confidential (either directly or by visibility), require confidential access.
 * 4. If no visibility field is actually being changed, allow (no-ops always allowed).
 * 5. Otherwise:
 *      - Look up allowed visibility options for this user role,
 *      - If unavailable, permit (fail-safe open, but audit for over-permissiveness),
 *      - Else, allow only if new requested value is in permitted set.
 *
 * NOTE: This implicitly blocks privilege escalation in fields, but backend should double-verify!
 */
export function canSetEntityVisibility(
  role: string | null | undefined,
  nextVisibility: EntityVisibility | undefined,
  options: { isConfidential?: boolean } = {},
): boolean {
  // Resolve user roles as before; fail closed (deny) if not resolvable.
  const parsed = parseUserRolesArray(role) ?? resolveSessionUserRole(role)
  if (!parsed) return false

  // Check if intent is confidential (either directly or via specific visibility key).
  const wantsConfidential =
    options.isConfidential === true || nextVisibility === 'confidential'

  // If so, require confidential access (privilege-gated).
  if (wantsConfidential) {
    return hasConfidentialAccess(parsed)
  }

  // If patch doesn't actually change visibility, permit (no-op/unchanged).
  if (!nextVisibility) {
    return true
  }

  // Security NOTE: Fetch allowed visibilities for this user role.
  const allowed = getAllowedEntityVisibilityValues(parsed)
  // If not resolvable, fail open (permit)—be sure this is intended in case of dependency bugs.
  if (!allowed) {
    return true
  }

  // Only allow transition if permitted for the user role.
  return allowed.includes(nextVisibility)
}

/**
 * Checks a visibility/confidential patch before applying; throws a programmatic error if forbidden.
 *
 * Usage:
 * - Call before applying PATCH/PUT to an entity that would alter visibility/confidentiality.
 * - Defensive: avoids privilege drift in API/server code, as well as UI.
 *
 * Logic:
 * 1. If no relevant (visibility/confidentiality) fields are to be updated, allow/grant by default.
 * 2. Else, check if modification is legal via canSetEntityVisibility.
 * 3. If not, throw an error (expected to be handled by error boundary/server function).
 *
 * // TODO: If using with Next.js 13+ Server Components or App Router API endpoints, codemod to a server action and use server-only role resolution!
 * // STUB: Prefer bubbling error to a typed error class, if a custom error handler exists for your API pattern.
 */
export function assertEntityVisibilityPatch(
  role: string | null | undefined,
  patch: EntityVisibilityPatch,
): void {
  const { visibility, isConfidential } = patch

  // If both fields are unchanged/undefined, allow.
  if (visibility === undefined && isConfidential === undefined) {
    return
  }

  // Use permission logic from canSetEntityVisibility; throw (fail) if forbidden.
  if (!canSetEntityVisibility(role, visibility, { isConfidential })) {
    // STUB: Optionally replace with a custom forbidden/unauthorized error for standardized API error handling.
    throw new Error('Access denied. Your role cannot set this visibility level.')
  }
}

// TODO: [Next.js 13+/16+] Introduce Middleware (middleware.ts) to enforce entity permissions at the routing layer for API endpoints/pages that create or update entities.
//       Can use native Next.js Middleware for static and dynamic route protection! See: https://nextjs.org/docs/app/building-your-application/routing/middleware
// TODO: Migrate permission checks to React 19/Next 13+ server components (Server Actions) for ultimate backend safety. Wrap actions in authentication/authorization code at the server boundary.
// TODO: If any imported user-role methods (e.g., resolveSessionUserRole) become async (DB calls), codemod all permission functions here to `async/await` and update all usages for promise support.