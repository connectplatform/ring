/**
 * Telegram Web Login OIDC (oauth.telegram.org) — Auth.js provider + claim helpers.
 *
 * Discovery: https://oauth.telegram.org/.well-known/openid-configuration
 * Soft-launch scopes: openid profile (phone / telegram:bot_access behind flags later).
 *
 * Telegram has NO userinfo_endpoint — profile claims live only in id_token.
 * Auth.js discovery still requires userinfo_endpoint (throws
 * "TODO: Authorization server did not provide a userinfo endpoint") even with
 * idToken: true. We inject a stub userinfo_endpoint via customFetch on discovery
 * so JWKS/issuer stay real; with idToken: true Auth.js never HTTP-calls UserInfo.
 *
 * Skipping discovery (type:oauth + token/userinfo URLs) defaults issuer to
 * https://authjs.dev and rejects Telegram id_token iss — do not use that path.
 *
 * Env: AUTH_TELEGRAM_ID / AUTH_TELEGRAM_SECRET (BotFather → Bot Settings → Web Login).
 * Legacy widget hash still uses ADMIN_BOT_TOKEN (or TELEGRAM_LOGIN_BOT_TOKEN).
 *
 * Telegram OIDC quirk: oauth.telegram.org rejects OAuth `state` longer than 256 chars
 * with body "state too long". Auth.js default `checks: ['pkce','state']` puts a JWE in
 * `state` (~400+ chars) — use `checks: ['pkce']` only for this provider.
 *
 * Truth lenses: telegram_login_widget_specialist, authjs_specialist
 */
import type { OIDCConfig } from 'next-auth/providers'
import { customFetch } from 'next-auth'

export const TELEGRAM_OIDC_ISSUER = 'https://oauth.telegram.org'
export const TELEGRAM_OIDC_WELL_KNOWN =
  'https://oauth.telegram.org/.well-known/openid-configuration'
export const TELEGRAM_OIDC_JWKS_URI =
  'https://oauth.telegram.org/.well-known/jwks.json'

/** Soft-launch scopes — do not request phone until product opts in. */
export const TELEGRAM_OIDC_DEFAULT_SCOPE = 'openid profile'

/** Stub only — Telegram has no UserInfo; Auth.js never fetches it when idToken: true. */
export const TELEGRAM_OIDC_USERINFO_STUB = `${TELEGRAM_OIDC_ISSUER}/userinfo`

export type TelegramIdTokenClaims = {
  iss?: string
  aud?: string | string[]
  sub?: string
  iat?: number
  exp?: number
  nbf?: number
  id?: number | string
  name?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  picture?: string
  phone_number?: string
  phone_number_verified?: boolean
  [key: string]: unknown
}

export type TelegramProfile = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  telegramId: string
  username?: string | null
  phoneNumber?: string | null
}

export function getTelegramOidcClientId(): string {
  return (
    process.env.AUTH_TELEGRAM_ID?.trim() ||
    process.env.TELEGRAM_OIDC_CLIENT_ID?.trim() ||
    ''
  )
}

export function getTelegramOidcClientSecret(): string {
  return (
    process.env.AUTH_TELEGRAM_SECRET?.trim() ||
    process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim() ||
    ''
  )
}

/** True when BotFather Web Login Client ID/Secret are configured. */
export function isTelegramOidcConfigured(): boolean {
  return Boolean(getTelegramOidcClientId() && getTelegramOidcClientSecret())
}

/**
 * Bot token for legacy Login Widget HMAC only (never for OIDC client secret).
 * Prefer TELEGRAM_LOGIN_BOT_TOKEN when the login bot differs from ADMIN_BOT.
 */
export function getTelegramLoginBotToken(): string {
  return (
    process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim() ||
    process.env.ADMIN_BOT_TOKEN?.trim() ||
    ''
  )
}

/** Normalize Telegram numeric id / OIDC sub to a stable string account id. */
export function normalizeTelegramAccountId(
  idOrSub: string | number | null | undefined,
): string {
  if (idOrSub === null || idOrSub === undefined) return ''
  return String(idOrSub).trim()
}

/**
 * Validate Telegram id_token via JWKS + iss/aud/exp.
 * Use for golden tests and any manual token path; Auth.js also validates OIDC tokens.
 * jose is loaded lazily so unit tests for claim mapping stay CJS-friendly.
 */
export async function verifyTelegramIdToken(
  idToken: string,
  options?: { audience?: string; clockToleranceSec?: number },
): Promise<TelegramIdTokenClaims> {
  const audience = options?.audience || getTelegramOidcClientId()
  if (!audience) {
    throw new Error('verifyTelegramIdToken: AUTH_TELEGRAM_ID not configured')
  }

  const { createRemoteJWKSet, jwtVerify } = await import('jose')
  const jwks = createRemoteJWKSet(new URL(TELEGRAM_OIDC_JWKS_URI))
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: TELEGRAM_OIDC_ISSUER,
    audience,
    clockTolerance: options?.clockToleranceSec ?? 60,
  })

  return payload as TelegramIdTokenClaims
}

/** Map verified id_token claims → Auth.js profile shape. */
export function mapTelegramClaimsToProfile(
  claims: TelegramIdTokenClaims | TelegramProfile,
): TelegramProfile {
  const asClaims = claims as TelegramIdTokenClaims & TelegramProfile
  const telegramId = normalizeTelegramAccountId(
    asClaims.telegramId ?? asClaims.id ?? asClaims.sub,
  )
  const name =
    (typeof asClaims.name === 'string' && asClaims.name.trim()) ||
    [asClaims.given_name, asClaims.family_name].filter(Boolean).join(' ').trim() ||
    (typeof asClaims.preferred_username === 'string'
      ? asClaims.preferred_username
      : typeof asClaims.username === 'string'
        ? asClaims.username
        : null) ||
    null

  return {
    id: telegramId,
    name,
    email: null,
    image:
      typeof asClaims.picture === 'string'
        ? asClaims.picture
        : (asClaims.image ?? null),
    telegramId,
    username:
      typeof asClaims.preferred_username === 'string'
        ? asClaims.preferred_username
        : typeof asClaims.username === 'string'
          ? asClaims.username
          : null,
    phoneNumber:
      typeof asClaims.phone_number === 'string'
        ? asClaims.phone_number
        : typeof asClaims.phoneNumber === 'string'
          ? asClaims.phoneNumber
          : null,
  }
}

export type TelegramOidcProviderOptions = {
  clientId?: string
  clientSecret?: string
  /** Override soft-launch scopes (must include openid). */
  scope?: string
  allowDangerousEmailAccountLinking?: boolean
}

/**
 * Patch Telegram OIDC discovery JSON so Auth.js accepts missing userinfo_endpoint.
 * Real JWKS/issuer/token endpoints are unchanged.
 */
export async function telegramOidcCustomFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  const response = await fetch(...args)
  const url = String(args[0] ?? '')
  if (!url.includes('/.well-known/openid-configuration')) {
    return response
  }

  let json: Record<string, unknown>
  try {
    json = (await response.clone().json()) as Record<string, unknown>
  } catch {
    return response
  }

  if (!json || typeof json !== 'object') return response
  if (!json.userinfo_endpoint) {
    json.userinfo_endpoint = TELEGRAM_OIDC_USERINFO_STUB
  }

  return new Response(JSON.stringify(json), {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Auth.js v5 Telegram Web Login OIDC provider.
 * Place only in auth.ts (server) — never in auth.config.ts (edge).
 */
export function TelegramOidcProvider(
  options: TelegramOidcProviderOptions = {},
): OIDCConfig<TelegramIdTokenClaims> {
  const clientId = options.clientId || getTelegramOidcClientId()
  const clientSecret = options.clientSecret || getTelegramOidcClientSecret()

  return {
    id: 'telegram',
    name: 'Telegram',
    type: 'oidc',
    issuer: TELEGRAM_OIDC_ISSUER,
    wellKnown: TELEGRAM_OIDC_WELL_KNOWN,
    clientId,
    clientSecret,
    authorization: {
      params: {
        scope: options.scope || TELEGRAM_OIDC_DEFAULT_SCOPE,
        response_type: 'code',
      },
    },
    client: {
      token_endpoint_auth_method: 'client_secret_basic',
    },
    // PKCE only — Auth.js JWE `state` exceeds Telegram's 256-char limit.
    checks: ['pkce'],
    // Use id_token claims; do not call UserInfo (stub exists only for discovery).
    idToken: true,
    [customFetch]: telegramOidcCustomFetch,
    allowDangerousEmailAccountLinking:
      options.allowDangerousEmailAccountLinking ?? true,
    profile(profile) {
      const mapped = mapTelegramClaimsToProfile(profile)
      return {
        id: mapped.id,
        name: mapped.name,
        email: mapped.email,
        image: mapped.image,
        telegramId: mapped.telegramId,
        username: mapped.username ?? undefined,
        phoneNumber: mapped.phoneNumber ?? undefined,
      } as {
        id: string
        name: string | null
        email: string | null
        image: string | null
        telegramId: string
        username?: string
        phoneNumber?: string
      }
    },
    style: { text: '#fff', bg: '#229ED9' },
  }
}
