// TODO: move all core role logic (values/types) to user-role and DRY up the logic
// TODO: Consider migrating to modern cookie management (e.g. cookies from 'next/headers' in Next.js 16+ for server), and context-aware storage with React 19 server/client separation.

import {
  ALL_USER_ROLES,
  ALL_USER_ROLES_SET,
  UserRolesArray,
} from "../auth/user-role"

// Defines roles that are allowed for OAuth "intent" (signup, etc).
// Using 'as const' and 'satisfies' for improved type safety.
export const OAUTH_INTENT_ALLOWED_ROLES = [
  UserRolesArray.visitor,
  UserRolesArray.subscriber,
  UserRolesArray.member,
] as const satisfies readonly UserRolesArray[]

// Type helper: an OAuthIntentRole is one of the allowed roles above.
export type OAuthIntentRole = (typeof OAUTH_INTENT_ALLOWED_ROLES)[number]

// Name for the intent cookie in browser/client/server
export const OAUTH_INTENT_COOKIE_NAME = "ring_oauth_role_intent"

// Cookie expiration: 10 minutes (in seconds)
export const OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS = 10 * 60

// Sets for fast membership lookup when parsing roles
export const OAUTH_INTENT_ALLOWED_ROLES_SET: ReadonlySet<OAuthIntentRole> = new Set(OAUTH_INTENT_ALLOWED_ROLES)

/**
 * Parse a user role string as a valid enum value (case-sensitive).
 * Returns `UserRolesArray` value if valid, else `undefined`.
 * @param role - The role string to parse
 */
export function parseOAuthIntentRoleValue(
  role: unknown /* string | undefined | null | unknown */
): UserRolesArray | undefined {
  // Only strings are accepted. If not a string, return undefined immediately.
  if (typeof role !== "string") return undefined

  // Remove leading/trailing whitespace.
  const trimmed = role.trim()
  
  // Check against set of valid role enum values.
  return ALL_USER_ROLES_SET.has(trimmed as UserRolesArray)
    ? (trimmed as UserRolesArray)
    : undefined
}

/**
 * Resolve any role input to a valid intent role.
 * Falls back to 'visitor' (safe default) if not in allowed role list.
 * @param role - User-provided or inferred role
 * @returns OAuthIntentRole (always a value from OAUTH_INTENT_ALLOWED_ROLES)
 */
export function resolveOAuthIntentRole(
  role: unknown /* string | undefined | null | unknown */
): OAuthIntentRole {
  // Parse value with strict matching (no case normalization).
  const parsed = parseOAuthIntentRoleValue(role)
  // If parsed value exists and is an allowed intent role, use it.
  // Else fallback to UserRolesArray.visitor.
  return parsed && OAUTH_INTENT_ALLOWED_ROLES_SET.has(parsed as OAuthIntentRole)
    ? (parsed as OAuthIntentRole)
    : UserRolesArray.visitor
}

/**
 * Builds options for cookie serialization in backend frameworks or libraries.
 * Used to ensure consistent cookie params.
 * @returns {object} Cookie options (recommended for Next.js 16+ edge/server cookie APIs).
 */
// TODO: In Next.js 16+, prefer using import { cookies } from "next/headers" in server components/middleware for cookie management.
export function getOAuthIntentCookieOptions() {
  return {
    httpOnly: false,                            // Not HTTP-only, accessible from JS.
    maxAge: OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS, // Max-Age in seconds.
    path: "/",                                  // Cookie scope.
    sameSite: "lax" as const,                   // Prevent 3rd party CSRF.
    secure: process.env.NODE_ENV === "production", // Only use Secure in prod.
  }
}

/**
 * Set the OAuth intent role cookie on the client/browser.
 * This is a client-only utility: only runs when window/document are defined.
 * If called server-side in SSR, does nothing.
 * @param role - Candidate value for cookie, resolved to a valid OAuthIntentRole.
 * @returns The final role value (guaranteed valid).
 */
// TODO: In Next.js 16+/React 19 use server-only or client-only boundaries for cookie operations; prefer 'cookies' API on server.
export function setOAuthIntentCookieClient(
  role: unknown /* string | undefined | null | unknown */
): OAuthIntentRole {
  const resolvedRole = resolveOAuthIntentRole(role)
  // Only set cookie if we are in a browser environment.
  if (typeof document !== "undefined") {
    // Use Secure if on an https page.
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    // Set cookie string with correct options for security.
    document.cookie =
      `${OAUTH_INTENT_COOKIE_NAME}=${encodeURIComponent(resolvedRole)}; ` +
      `Max-Age=${OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
  }
  return resolvedRole
}

/**
 * Clear the OAuth intent cookie from the client/browser.
 * Sets Max-Age=0 to delete cookie for all paths.
 * Does nothing on SSR/server.
 */
export function clearOAuthIntentCookieClient() {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie =
    `${OAUTH_INTENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
  // Setting cookie with Max-Age=0 instructs browser to delete it.
}
