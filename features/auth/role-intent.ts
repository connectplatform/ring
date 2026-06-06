export const USER_ROLE_VALUES = [
  "VISITOR",
  "SUBSCRIBER",
  "MEMBER",
  "CONFIDENTIAL",
  "ADMIN",
  "SUPERADMIN",
] as const

export type UserRoleValue = (typeof USER_ROLE_VALUES)[number]

export const DEFAULT_USER_ROLE = "SUBSCRIBER" as const satisfies UserRoleValue

export const OAUTH_INTENT_ALLOWED_ROLES = [
  "VISITOR",
  "SUBSCRIBER",
  "MEMBER",
] as const satisfies readonly UserRoleValue[]

export type OAuthIntentRole = (typeof OAUTH_INTENT_ALLOWED_ROLES)[number]

export const OAUTH_INTENT_COOKIE_NAME = "ring_oauth_role_intent"
export const OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS = 10 * 60

const USER_ROLE_SET = new Set<UserRoleValue>(USER_ROLE_VALUES)
const OAUTH_INTENT_ROLE_SET = new Set<OAuthIntentRole>(OAUTH_INTENT_ALLOWED_ROLES)

export function normalizeUserRole(role: unknown): UserRoleValue | undefined {
  if (typeof role !== "string") return undefined

  const normalized = role.trim().toUpperCase()
  if (!USER_ROLE_SET.has(normalized as UserRoleValue)) return undefined

  return normalized as UserRoleValue
}

export function resolveOAuthIntentRole(role: unknown): OAuthIntentRole {
  const normalized = normalizeUserRole(role)
  if (normalized && OAUTH_INTENT_ROLE_SET.has(normalized as OAuthIntentRole))
    return normalized as OAuthIntentRole

  return DEFAULT_USER_ROLE
}

export function getOAuthIntentCookieOptions() {
  return {
    httpOnly: false,
    maxAge: OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

export function setOAuthIntentCookieClient(role: unknown): OAuthIntentRole {
  const resolvedRole = resolveOAuthIntentRole(role)

  if (typeof document !== "undefined") {
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie =
      `${OAUTH_INTENT_COOKIE_NAME}=${encodeURIComponent(resolvedRole)}; ` +
      `Max-Age=${OAUTH_INTENT_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
  }

  return resolvedRole
}

export function clearOAuthIntentCookieClient() {
  if (typeof document === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie =
    `${OAUTH_INTENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
}
