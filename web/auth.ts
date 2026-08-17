import NextAuth from "next-auth"
import type { Session } from "next-auth"
import { getAuthAdapter } from "@/lib/auth-adapter-singleton"
import { db } from "@/lib/database"
import authConfig from "./auth.config"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import {
  normalizeWalletStorageId,
  verifyWalletNonceSignature,
} from "@/features/wallet/services/verify-wallet-signature"
import { consumeMagicToken, consumeOtpCode } from "@/features/auth/services/email-login-tokens"
import { ensureEmailAuthUser } from "@/features/auth/services/ensure-email-auth-user"
import {
  bumpPhoneChallengeAttempt,
  expirePhoneChallengeIfMaxAttempts,
  getOpenPhoneChallenge,
  markPhoneChallengeUsed,
} from "@/features/auth/services/phone-login-tokens"
import { verifyPhoneOtpCode } from "@/features/auth/services/phone-otp-delivery"
import {
  ensurePhoneAuthUser,
  markPhoneVerified,
} from "@/features/auth/services/ensure-phone-auth-user"
import { normalizeToE164 } from "@/lib/phone/e164"
import { isVirtualEmail } from "@/lib/auth/virtual-email"
import { verifyPassword } from "@/lib/auth/email-tokens"
import { isRingMailerConfigured } from "@/lib/mailer"
import { OAuth2Client } from 'google-auth-library'
import { generateInternalJWT } from "@/lib/auth/generate-jwt"
import { randomUUID } from "node:crypto"
import { UserRolesArray, resolvePersistedUserRole, resolveSessionUserRole } from "@/features/auth/user-role"
import { WalletConductor } from "@/features/wallet/conductor/wallet-conductor"
import { userMigrationService } from "@/features/auth/services/user-migration"
import { shouldSkipDatabaseConnect } from "@/lib/build-cache/phase-detector"
import {
  getGoogleIdTokenAudiences,
  getGoogleOAuthClientId,
} from "@/lib/auth/google-oauth-client"
import { getMcpActor } from "@/lib/auth/mcp-actor-context"
import {
  createOAuthUserFromGooglePayload,
  ensureGoogleAccountLinked,
  findUserByEmail,
  normalizeAuthEmail,
  resolveCanonicalUser,
  resolveOrCreateTelegramUser,
} from "@/features/auth/services/user-resolve"
import {
  isAccountLoginAllowed,
  normalizeAccountStatus,
} from "@/features/auth/lib/account-status"
import { getUserAccountStatus } from "@/features/auth/services/user-account-status"
import {
  applyUserRowToJwt,
  accountStatusFromJwt,
  suspensionReasonFromJwt,
} from "@/lib/auth/session-user-status"
import {
  isTelegramOidcConfigured,
  mapTelegramClaimsToProfile,
  normalizeTelegramAccountId,
  TelegramOidcProvider,
  type TelegramIdTokenClaims,
} from "@/lib/auth/telegram-oidc"
import {
  getTelegramMiniAppBotToken,
  isTelegramMiniAppAuthDateFresh,
  verifyTelegramMiniAppInitData,
} from "@/lib/auth/telegram-miniapp-initdata"
import {
  authCallbackUrlCookieName,
  authCsrfTokenCookieName,
  authSessionTokenCookieName,
} from "@/lib/auth/auth-cookie-names"

// Auth.js v5 + Next.js 16: handlers live at app/api/auth/[...nextauth]/route.ts;
// mutations that need UI state go through Server Actions + useActionState.

const googleOAuthClientId = getGoogleOAuthClientId() // Fetch Google OAuth client ID from env/config

// Initialize Google Auth client for server-side ID token verification
const googleAuthClient = new OAuth2Client(googleOAuthClientId)

// Utility for conditional logging during dev/testing
const shouldLogAuth = () => {
  // Never log during build or in production (unless overridden).
  if (process.env.npm_lifecycle_event === 'build' || process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.DB_DEBUG === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.DB_DEBUG !== 'false');
};

// Convenience wrapper for logs that only output if shouldLogAuth is true.
const authLog = (...args: any[]) => {
  if (shouldLogAuth()) {
    console.log(...args);
  }
};

// Helper to distinguish if current sign in context is Google One Tap.
function isGoogleOneTapSignIn(
  account: { provider?: string } | null | undefined,
  user: { id?: string | null }
): boolean {
  return account?.provider === 'google-one-tap' || user.id === 'gis-jwt-pending'
}

/**
 * Main NextAuth configuration object.
 * Configures adapter selection, session, providers, and all callbacks/events.
 */

// Get singleton auth adapter (may be null during build)
const authAdapter = getAuthAdapter()

// Backend mode selection for adapter targeting / diagnostics
import { shouldUseFirebaseForDatabase } from './lib/database/backend-mode-config'
const useFirebase = shouldUseFirebaseForDatabase()
const usePostgreSQL = !useFirebase

// Feature toggling for providers requiring backend persistence
const hasAdapter = !!authAdapter
const ringMailerReady = isRingMailerConfigured()

if (!shouldSkipDatabaseConnect() && !ringMailerReady) {
  console.info(
    "Ring Mailer: SMTP_* (or EMAIL_MODE=ethereal) not set. Email OTP / magic-link sign-in will fail until configured.",
  )
}

const nextAuthApp = NextAuth({
  ...authConfig, // Bring in custom user config
  // Attach DB adapter if present (PostgreSQL or Firebase based on env mode)
  ...(hasAdapter && { adapter: authAdapter }),
  session: { 
    strategy: "jwt", // JWT improves edge support and resilience
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // 24 hours, session token will refresh if accessed
  },
  trustHost: true, // Next.js deployment best practice for Vercel/self-hosted
  // Secure cookies only on real HTTPS (or AUTH_USE_SECURE_COOKIES=true).
  // `npm run start` sets NODE_ENV=production but local AUTH_URL is often http://localhost —
  // Firefox will not send `__Secure-` / Secure cookies over HTTP → /api/* 401 + client NetworkError.
  ...(() => {
    const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
    const useSecureCookies =
      process.env.AUTH_USE_SECURE_COOKIES === 'true'
        ? true
        : process.env.AUTH_USE_SECURE_COOKIES === 'false'
          ? false
          : process.env.NODE_ENV === 'production' && authUrl.startsWith('https://')
    return {
      useSecureCookies,
      cookies: {
        sessionToken: {
          name: authSessionTokenCookieName(useSecureCookies),
          options: {
            httpOnly: true,
            sameSite: 'lax' as const,
            path: '/',
            secure: useSecureCookies,
          },
        },
        callbackUrl: {
          name: authCallbackUrlCookieName(useSecureCookies),
          options: {
            sameSite: 'lax' as const,
            path: '/',
            secure: useSecureCookies,
          },
        },
        csrfToken: {
          name: authCsrfTokenCookieName(useSecureCookies),
          options: {
            httpOnly: true,
            sameSite: 'lax' as const,
            path: '/',
            secure: useSecureCookies,
          },
        },
      },
    }
  })(),
  providers: [
    // Ring Mailer — OTP one-time code (own SMTP via lib/mailer)
    CredentialsProvider({
      id: 'email-otp',
      name: 'Email OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        const email = normalizeAuthEmail(String(credentials?.email || ''))
        const code = String(credentials?.code || '').trim()
        if (!email || !code) return null
        try {
          const consumed = await consumeOtpCode({ email, code })
          if (!consumed) return null
          const user = await ensureEmailAuthUser(consumed.email)
          return {
            id: user.id,
            email: normalizeAuthEmail(String(user.email || consumed.email)),
            name: user.name ? String(user.name) : null,
            image: user.image ? String(user.image) : null,
            emailVerified: new Date(),
            role: (user.role as UserRolesArray) || UserRolesArray.visitor,
          }
        } catch (error) {
          authLog('email-otp authorize failed', error)
          return null
        }
      },
    }),

    // Phone OTP — Telegram Gateway (virtual-email Auth.js identity)
    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Code', type: 'text' },
        challengeId: { label: 'Challenge', type: 'text' },
      },
      async authorize(credentials) {
        const phone = normalizeToE164(String(credentials?.phone || ''))
        const code = String(credentials?.code || '').trim()
        const challengeId = String(credentials?.challengeId || '').trim()
        if (!phone || !code || !challengeId) return null
        try {
          const challenge = await getOpenPhoneChallenge({ phone, challengeId })
          if (!challenge) return null

          if (await expirePhoneChallengeIfMaxAttempts(challenge.id)) {
            return null
          }

          const verified = await verifyPhoneOtpCode({
            requestId: challenge.request_id,
            code,
            channel: challenge.channel,
          })
          if (verified.ok === false) {
            // WhatsApp verify already bumps attempt_count (self-issued hash path).
            // Telegram Gateway tracks attempts remotely — bump locally for TG only.
            if (challenge.channel !== 'whatsapp') {
              await bumpPhoneChallengeAttempt(challenge.id)
            }
            await expirePhoneChallengeIfMaxAttempts(challenge.id)
            return null
          }

          await markPhoneChallengeUsed(challenge.id)
          const user = await ensurePhoneAuthUser(phone, { markVerified: true })
          await markPhoneVerified(user.id, phone)

          const virtual = isVirtualEmail(user)
          return {
            id: user.id,
            email: normalizeAuthEmail(String(user.email || '')),
            name: user.name ? String(user.name) : null,
            image: user.image ? String(user.image) : null,
            // Omit emailVerified for virtual mailboxes — Auth.js rejects null on User
            ...(virtual ? {} : { emailVerified: new Date() }),
            role: (user.role as UserRolesArray) || UserRolesArray.visitor,
            phoneNumber: phone,
            phoneVerifiedAt: new Date().toISOString(),
            isVirtualEmail: virtual,
          }
        } catch (error) {
          authLog('phone-otp authorize failed', error)
          return null
        }
      },
    }),

    // Ring Mailer — magic link / email verify (token consumed here; never on GET)
    CredentialsProvider({
      id: 'email-magic',
      name: 'Email Magic Link',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        const token = String(credentials?.token || '').trim()
        if (!token) return null
        try {
          const consumed = await consumeMagicToken({
            rawToken: token,
            flowTypes: ['magic_link', 'email_verify'],
          })
          if (!consumed) return null
          const user = await ensureEmailAuthUser(consumed.email)
          return {
            id: user.id,
            email: normalizeAuthEmail(String(user.email || consumed.email)),
            name: user.name ? String(user.name) : null,
            image: user.image ? String(user.image) : null,
            emailVerified: new Date(),
            role: (user.role as UserRolesArray) || UserRolesArray.visitor,
          }
        } catch (error) {
          authLog('email-magic authorize failed', error)
          return null
        }
      },
    }),

    // Email + password (after register / reset via Ring Mailer)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = normalizeAuthEmail(String(credentials?.email || ''))
        const password = String(credentials?.password || '')
        if (!email || !password) return null
        try {
          const user = await findUserByEmail(email)
          if (!user) return null
          const hash =
            (user as { passwordHash?: string }).passwordHash ||
            (user as { password_hash?: string }).password_hash
          if (!hash || typeof hash !== 'string') return null
          const ok = await verifyPassword(password, hash)
          if (!ok) return null
          return {
            id: user.id,
            email: normalizeAuthEmail(String(user.email || email)),
            name: user.name ? String(user.name) : null,
            image: user.image ? String(user.image) : null,
            role: (user.role as UserRolesArray) || UserRolesArray.visitor,
          }
        } catch (error) {
          authLog('credentials authorize failed', error)
          return null
        }
      },
    }),

    // Standard Google OAuth provider (interactive consent flow, for full user experience)
    GoogleProvider({
      allowDangerousEmailAccountLinking: true, // Allow linking same email across providers
      authorization: { params: { response_type: "code" } }, // Explicit grant params
      checks: ["pkce", "state"], // Recommended for modern OAuth security
      wellKnown: "https://accounts.google.com/.well-known/openid-configuration",
    }),

    // Google One Tap "credentials" provider for GIS JWT-encoded credentials
    CredentialsProvider({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: {
        credential: { type: 'text' },
      },
      // Only validates structure, actual JWT verification happens later in signIn callback
      async authorize(credentials) {
        // Authorize method for Google One Tap
        if (!credentials?.credential) {
          authLog('🟡 No GIS JWT credential provided')
          return null
        }
        authLog('🟡 GIS JWT provider - passing credential for server verification')
        authLog('🟡 JWT length:', (credentials.credential as string).length)
        // GIS JWT rides in `email` until signIn verifies it (CredentialsProvider field limit).
        return {
          id: 'gis-jwt-pending',
          email: credentials.credential as string, // Store JWT credential here for signIn callback
          name: 'GIS User',
          image: null,
          role: UserRolesArray.subscriber as UserRolesArray, // Assign a default role for session
        }
      },
    }),

    // Apple OAuth provider for Apple SSO
    AppleProvider({
      allowDangerousEmailAccountLinking: true,
    }),

    // Telegram Web Login OIDC (oauth.telegram.org) — only when BotFather Client ID/Secret set
    ...(isTelegramOidcConfigured()
      ? [
          TelegramOidcProvider({
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    // Telegram Mini App initData (WebAppData HMAC) — signIn('telegram-miniapp', { initData })
    CredentialsProvider({
      id: "telegram-miniapp",
      name: "Telegram Mini App",
      credentials: {
        initData: { label: "Telegram initData", type: "text" },
      },
      async authorize(credentials) {
        const initData = String(credentials?.initData || "").trim()
        if (!initData) return null

        const botToken = getTelegramMiniAppBotToken()
        if (!botToken) {
          authLog("telegram-miniapp: bot token missing")
          return null
        }

        const parsed = verifyTelegramMiniAppInitData(initData, botToken)
        if (!parsed?.user?.id) {
          authLog("telegram-miniapp: initData HMAC failed")
          return null
        }
        if (!isTelegramMiniAppAuthDateFresh(parsed.authDate)) {
          authLog("telegram-miniapp: auth_date stale")
          return null
        }

        const telegramId = normalizeTelegramAccountId(parsed.user.id)
        if (!telegramId) return null

        const displayName = [parsed.user.first_name, parsed.user.last_name]
          .filter(Boolean)
          .join(" ")
          .trim()

        try {
          const resolved = await resolveOrCreateTelegramUser({
            telegramId,
            name: displayName || parsed.user.username || `Telegram ${telegramId}`,
            image: parsed.user.photo_url || null,
            username: parsed.user.username || null,
          })

          return {
            id: resolved.userId,
            email: normalizeAuthEmail(
              (resolved.userRow.email as string | undefined) || "",
            ) || "",
            name:
              (resolved.userRow.name as string | null | undefined) ||
              displayName ||
              null,
            image:
              (resolved.userRow.image as string | null | undefined) ||
              parsed.user.photo_url ||
              null,
            role:
              (resolved.userRow.role as UserRolesArray) ||
              UserRolesArray.subscriber,
            telegramId,
          } as any
        } catch (error) {
          console.error("telegram-miniapp authorize failed:", error)
          return null
        }
      },
    }),

    // Crypto Wallet authentication via EVM signature (MetaMask, WalletConnect, etc)
    CredentialsProvider({
      id: "crypto-wallet",
      name: "Crypto Wallet",
      credentials: {
        walletAddress: { label: "Wallet Address", type: "text" },
        signedNonce: { label: "Signed Nonce", type: "text" },
      },
      async authorize(credentials) {
        // Validate the presence of required wallet credentials
        if (!credentials?.walletAddress || !credentials?.signedNonce) return null
        const walletAddress = String(credentials.walletAddress)
        const signedNonce = String(credentials.signedNonce)
        try {
          // Normalize wallet storage id for DB operations
          const storageId = normalizeWalletStorageId(walletAddress)

          // Read user by wallet from DB (db() routes Firebase or PostgreSQL)
          const userResult = await db().readDoc<Record<string, unknown>>('users', storageId)
          if (!userResult.success) {
            if (userResult.metadata?.operation === 'initialize') authLog("Crypto wallet auth: database init failed", userResult.error)
            return null
          }
          const userData = userResult.data ?? null

          // Validate nonce existence and expiry
          const nonce = userData?.nonce
          if (!nonce || typeof nonce !== "string") return null
          const nonceExpires = userData?.nonceExpires
          if (typeof nonceExpires === "number" && nonceExpires < Date.now()) return null

          // Verify wallet signature using nonce
          const valid = await verifyWalletNonceSignature({
            walletAddress,
            nonce,
            signature: signedNonce,
          })
          if (!valid) return null

          // On success, clear nonce/nonceExpires and stamp lastLogin
          await db().updateDoc('users', storageId, {
            nonce: null,
            nonceExpires: null,
            lastLogin: new Date(),
          })

          // Create auth session object for downstream use
          const now = new Date()
          return {
            id: storageId,
            email: String(userData?.email || ""),
            name: (userData?.name as string | null) || null,
            image: (userData?.photoURL as string | null) || (userData?.image as string | null) || null,
            role: (userData?.role as UserRolesArray) || UserRolesArray.subscriber as UserRolesArray,
            isVerified: !!userData?.isVerified,
            createdAt: (userData?.createdAt as Date) || now,
            lastLogin: now,
          }
        } catch (error) {
          console.error("Crypto wallet auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // JWT callback: enrich JWT with user data and custom claims
    async jwt({ token, user, account, trigger, session }) {
      // Log important JWT events only if allowed
      if (process.env.NODE_ENV === 'development' || process.env.AUTH_DEBUG === 'true') {
        if (trigger === 'update' || (user && account)) {
          authLog('JWT callback:', { trigger, hasUser: !!user, userId: user?.id })
        }
      }

      const sessionPatch = session as {
        accountStatusRefresh?: boolean
        photoURL?: string | null
        image?: string | null
        avatarThumb?: string | null
      } | undefined

      // Accept client photo patches (e.g. after avatar upload) before optional DB rehydrate
      let clientPhotoPatch: string | null = null
      if (trigger === 'update' && sessionPatch) {
        clientPhotoPatch =
          sessionPatch.avatarThumb ||
          sessionPatch.photoURL ||
          sessionPatch.image ||
          null
        if (clientPhotoPatch) {
          token.photoURL = clientPhotoPatch
        }
        if (
          typeof (session as { needsOnboarding?: boolean } | undefined)?.needsOnboarding ===
          'boolean'
        ) {
          token.needsOnboarding = (session as { needsOnboarding: boolean }).needsOnboarding
        }
      }

      // Decide if we need to fetch/update fresh user data from DB. This keeps JWT stateless but up-to-date.
      // Any session update() rehydrates photo/profile fields so chrome matches /profile after upload.
      const needsUserData =
        trigger === 'update' ||
        (user && account) ||
        (user && !token.name) ||
        (token.userId && !token.role)

      if (needsUserData) {
        if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
          authLog('Fetching fresh user data for userId:', token.userId || user?.id)
        }
        try {
          const userId = (token.userId as string) || user?.id
          if (userId) {
            if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
              authLog('Looking up user via BackendSelector db():', userId)
            }
            const result = await db().readDoc<import('@/features/auth/lib/user-row').UserRow>('users', userId)
            if (!result.success) {
              if (result.metadata?.operation === 'initialize') {
                authLog('Database initialization failed in JWT callback:', result.error)
              }
              return token
            }
            if (result.data) {
              const userData = result.data
              if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
                authLog('Found user data for JWT:', { name: userData?.name, email: userData?.email, role: userData?.role })
              }
              applyUserRowToJwt(token, userData)
              // Prefer client patch when present so a race after upload does not wipe with stale DB
              if (clientPhotoPatch) {
                token.photoURL = clientPhotoPatch
              }
            } else {
              authLog('User document not found for ID:', userId)
              const repairEmail = normalizeAuthEmail(
                (token.email as string | undefined) || user?.email || undefined
              )
              if (repairEmail) {
                const canonical = await findUserByEmail(repairEmail)
                if (canonical) {
                  authLog('JWT repair: remapping userId to canonical email match:', canonical.id)
                  token.userId = canonical.id
                  applyUserRowToJwt(token, canonical)
                  if (clientPhotoPatch) {
                    token.photoURL = clientPhotoPatch
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data in JWT callback:', error)
        }
      }

      // If new/user present, always hydrate JWT with live info
      if (user) {
        token.userId = user.id
        token.role = resolvePersistedUserRole(
          token.role || (user as any).role || UserRolesArray.subscriber,
        )
        token.isVerified = (user as any).isVerified ?? false
        token.username = (user as any).username
        token.phoneNumber = (user as any).phoneNumber
        token.phoneVerifiedAt = (user as any).phoneVerifiedAt
        token.isVirtualEmail = (user as any).isVirtualEmail
        token.bio = (user as any).bio
        token.organization = (user as any).organization
        token.position = (user as any).position
        token.photoURL = user.image || (user as any).photoURL
        if (account) {
          // For new connection, generate internal WS-auth JWT in accessToken field.
          try {
            const internalJWT = await generateInternalJWT(
              user.id,
              user.email || undefined,
              resolvePersistedUserRole((user as any).role || (token.role as string))
            )
            token.accessToken = internalJWT
          } catch (error) {
            console.error('Failed to generate internal JWT:', error)
            // Fallback to provider's OAuth token if generation failed
            token.accessToken = account.access_token
          }
          token.refreshToken = account.refresh_token
          token.provider = account.provider
          if (account.provider === 'telegram') {
            const fromUser = (user as { telegramId?: string }).telegramId
            const fromAccount = account.providerAccountId
            token.telegramId = normalizeTelegramAccountId(fromUser || fromAccount)
          }
        }
        // Shared vitals gate: email magic/OTP + crypto-wallet/wagmi
        const { userNeedsVitalsOnboarding, isVitalsGatedProvider } = await import(
          '@/features/auth/lib/vitals-onboarding'
        )
        if (
          account?.provider &&
          userNeedsVitalsOnboarding(
            {
              name: user.name,
              email: user.email,
              image: user.image,
              photoURL: (user as { photoURL?: string | null }).photoURL,
            },
            account.provider,
          )
        ) {
          token.needsOnboarding = true
        } else if (account?.provider && isVitalsGatedProvider(account.provider)) {
          token.needsOnboarding = false
        }
      }

      // Recompute vitals gate on session.update using JWT provider + token profile fields
      if (trigger === 'update' && token.provider) {
        const { userNeedsVitalsOnboarding: needsVitals } = await import(
          '@/features/auth/lib/vitals-onboarding'
        )
        token.needsOnboarding = needsVitals(
          {
            name: token.name as string | undefined,
            email: token.email as string | undefined,
            photoURL: token.photoURL as string | undefined,
          },
          token.provider as string,
        )
      }

      // Authenticated JWTs must never carry visitor (guest-only label).
      token.role = token.userId
        ? resolvePersistedUserRole(token.role)
        : resolveSessionUserRole(token.role)

      // Legacy cookies: bootstrap accountStatus so undefined does not re-trigger DB reads forever.
      if (token.userId && token.accountStatus === undefined) {
        token.accountStatus = 'ACTIVE'
      }

      // If accessToken is missing (e.g., from a previous session), attempt regeneration
      if (!token.accessToken && token.userId) {
        try {
          const internalJWT = await generateInternalJWT(
            token.userId as string,
            token.email as string || undefined,
            token.role as string
          )
          token.accessToken = internalJWT
        } catch (error) {
          console.error('Failed to regenerate internal JWT:', error)
        }
      }

      return token
    },

    // Session callback - attaches all custom/user claims to outgoing session object
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.role = resolvePersistedUserRole(token.role)
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string

        // Attach status/suspension reasons if set
        ;(session.user as { accountStatus?: string }).accountStatus =
          accountStatusFromJwt(token)
        ;(session.user as { suspensionReason?: string }).suspensionReason =
          suspensionReasonFromJwt(token)
        // Add custom user fields persisted in DB
        ;(session.user as any).username = token.username as string
        ;(session.user as any).phoneNumber = token.phoneNumber as string
        ;(session.user as any).phoneVerifiedAt = token.phoneVerifiedAt as string | undefined
        ;(session.user as any).isVirtualEmail = token.isVirtualEmail as boolean | undefined
        ;(session.user as any).bio = token.bio as string
        ;(session.user as any).organization = token.organization as string
        ;(session.user as any).position = token.position as string
        // Hydrate chrome image + photoURL from JWT (avatarThumb preferred via applyUserRowToJwt)
        if (token.photoURL) {
          session.user.image = token.photoURL as string
          session.user.photoURL = token.photoURL as string
        }
        if (token.telegramId) {
          ;(session.user as { telegramId?: string }).telegramId =
            token.telegramId as string
        }
        // Expose JWTs/tokens for use in websocket, API calls
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }

      return session
    },

    // Custom signIn callback – handles advanced flows, validation, and Google One Tap verification
    async signIn({ user, account, profile }) {
      try {
        console.log('SignIn callback triggered:', {
          provider: account?.provider,
          userId: user.id,
          email: user.email,
          hasAdapter: hasAdapter,
          usePostgreSQL
        })
        // Special handling for Google One Tap tokens
        if (isGoogleOneTapSignIn(account, user)) {
          console.log('🔵 Google One Tap detected in signIn callback - verifying JWT token')
          // The credentials JWT comes in as user.email (due to next-auth credentials provider pattern)
          const credential = user.email
          if (!credential || credential.length < 100) { // JWT is 1000+ chars typically
            console.error('🔵 No valid credential found in user.email')
            return false
          }
          try {
            // Verify received GIS JWT using Google public key
            console.log('🔵 Verifying Google ID token in signIn callback...')
            console.log('🔵 Token length:', credential.length)
            const ticket = await googleAuthClient.verifyIdToken({
              idToken: credential,
              audience: getGoogleIdTokenAudiences(),
            })
            const payload = ticket.getPayload()
            console.log('🔵 Google ID token verified successfully in signIn callback')
            console.log('🔵 Payload:', {
              sub: payload?.sub,
              email: payload?.email,
              name: payload?.name,
              email_verified: payload?.email_verified
            })
            if (!payload?.sub || !payload.email) {
              console.error('🔵 Missing sub or email in verified token')
              return false
            }
            const googleSub = payload.sub
            // Normalize/ensure canonical email format
            const email = normalizeAuthEmail(payload.email)
            const emailVerified = payload.email_verified ? new Date() : null
            // Find or create canonical user for this email
            const resolved = await resolveCanonicalUser({ email })
            if (resolved.userRow) {
              user.id = resolved.canonicalId
              console.log('🔵 One Tap reusing canonical user:', user.id)
            } else {
              // No user found → create new
              user.id = randomUUID()
              await createOAuthUserFromGooglePayload({
                userId: user.id,
                email,
                name: payload.name,
                image: payload.picture,
                emailVerified,
              })
              console.log('🔵 One Tap created new canonical user:', user.id)
            }
            // Ensure this Google account is linked with our user record (OAuth/one-tap duality)
            await ensureGoogleAccountLinked({
              userId: user.id,
              providerAccountId: googleSub,
              idToken: credential,
            })
            user.email = email
            user.name = payload.name || ''
            user.image = payload.picture || null
            ;(user as any).emailVerified = emailVerified
            ;(user as any).role = (resolved.userRow?.role as UserRolesArray) || UserRolesArray.subscriber as UserRolesArray
            console.log('🔵 Updated user object with canonical Google data:', {
              id: user.id,
              email: user.email,
              name: user.name,
              googleSub,
            })
          } catch (error) {
            // JWT or token verification failed
            console.error('🔵 Google token verification failed in signIn callback:', error)
            console.error('🔵 Error details:', (error as any).message)
            return false
          }
        }

        // Telegram OIDC — resolve by telegram id / accounts; sync communication.telegramId
        if (account?.provider === 'telegram') {
          const claims = (profile || {}) as TelegramIdTokenClaims
          const mapped = mapTelegramClaimsToProfile(claims)
          const telegramId =
            normalizeTelegramAccountId(account.providerAccountId) ||
            mapped.telegramId
          if (!telegramId) {
            console.error('Telegram signIn: missing telegram id / sub')
            return false
          }

          // Profile Messengers tab: attach Telegram to the already-signed-in Ring user
          let linkUserId: string | null = null
          try {
            const { consumeTelegramLinkIntent } = await import(
              '@/lib/auth/telegram-link-intent'
            )
            linkUserId = await consumeTelegramLinkIntent()
          } catch (intentReadError) {
            console.warn('Telegram link intent cookie read failed:', intentReadError)
          }

          if (linkUserId) {
            try {
              const { linkTelegramToExistingUser } = await import(
                '@/features/auth/services/user-resolve'
              )
              const { getDatabaseService, initializeDatabase } = await import(
                '@/lib/database/DatabaseService'
              )
              await initializeDatabase()
              const db = getDatabaseService()
              const existing = await db.findById('users', linkUserId)
              if (!existing.success || !existing.data) {
                console.error('Telegram link intent: user not found', linkUserId)
                return false
              }
              try {
                const linked = await linkTelegramToExistingUser({
                  targetUserId: linkUserId,
                  telegramId,
                  telegramUsername: mapped.username,
                  idToken: account.id_token,
                })
                authLog('Telegram OIDC linked to existing session user:', {
                  userId: linkUserId,
                  telegramId,
                  newlyLinked: linked.newlyLinked,
                  mergedFromUserId: linked.mergedFromUserId,
                })
              } catch (syncErr) {
                const msg =
                  syncErr instanceof Error ? syncErr.message : String(syncErr)
                if (
                  msg.includes('already linked') ||
                  msg.includes('older or equal-age') ||
                  msg.includes('non-shell account')
                ) {
                  console.warn('Telegram link intent denied:', msg)
                  return false
                }
                throw syncErr
              }
              user.id = linkUserId
              user.name =
                (existing.data as { name?: string | null }).name ||
                mapped.name ||
                user.name
              user.email =
                normalizeAuthEmail(
                  (existing.data as { email?: string }).email || user.email,
                ) || ''
              user.image =
                (existing.data as { image?: string | null }).image ||
                mapped.image ||
                user.image
              ;(user as { telegramId?: string }).telegramId = telegramId
              ;(user as { role?: UserRolesArray }).role =
                ((existing.data as { role?: UserRolesArray }).role as UserRolesArray) ||
                UserRolesArray.subscriber
              return true
            } catch (linkIntentError) {
              console.error('Telegram link intent failed:', linkIntentError)
              return false
            }
          }

          try {
            const resolved = await resolveOrCreateTelegramUser({
              telegramId,
              name: mapped.name || user.name,
              image: mapped.image || user.image,
              username: mapped.username,
              phoneNumber: mapped.phoneNumber,
              phoneNumberVerified: !!claims.phone_number_verified,
              idToken: account.id_token,
            })
            user.id = resolved.userId
            user.name = resolved.userRow.name
              ? String(resolved.userRow.name)
              : mapped.name
            user.image =
              (resolved.userRow.image as string | null | undefined) ||
              mapped.image ||
              null
            // Empty email is intentional for Telegram-only accounts (partial unique index).
            user.email =
              normalizeAuthEmail(
                (resolved.userRow.email as string | undefined) || user.email,
              ) || ''
            ;(user as { telegramId?: string }).telegramId = telegramId
            ;(user as { role?: UserRolesArray }).role =
              (resolved.userRow.role as UserRolesArray) ||
              UserRolesArray.subscriber
            authLog('Telegram OIDC resolved user:', {
              userId: user.id,
              telegramId,
              created: resolved.created,
            })
          } catch (telegramError) {
            console.error('Telegram signIn resolve failed:', telegramError)
            return false
          }
        }

        // Block sign-ins to suspended/disabled accounts (db()-backed status)
        const loginUserId = user.id
        if (loginUserId) {
          const { status } = await getUserAccountStatus(loginUserId)
          if (!isAccountLoginAllowed(status)) {
            console.warn('Sign-in blocked for account status:', status, loginUserId)
            return false
          }
          ;(user as { accountStatus?: string }).accountStatus = status
        }
        if (usePostgreSQL) {
          console.log('✅ Using PostgreSQL adapter - user creation handled by adapter')
        } else if (useFirebase) {
          console.log('✅ Using Firebase adapter - user creation handled by adapter')
        } else {
          console.log('⚠️  JWT-only mode - no database persistence')
        }
        return true
      } catch (error) {
        // If backend fails, default to allowing sign in for resilience (soft fail open)
        console.error("Sign in error:", error)
        console.warn("Database error during sign in, proceeding with JWT-only session")
        return true
      }
    },
  },
  events: {
    // Side effects on successful signIn (user created, etc)
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in with ${account?.provider}`)

      // Track signup referrals if a ref cookie exists (first sign-up only)
      if (isNewUser && user.id) {
        try {
          const { cookies } = await import('next/headers')
          const { REF_COOKIE_NAME } = await import('@/features/refcodes/constants')
          const { persistSignupReferralAttribution } = await import(
            '@/features/refcodes/services/attribution-service'
          )
          const refCode = (await cookies()).get(REF_COOKIE_NAME)?.value
          if (refCode) {
            await persistSignupReferralAttribution(user.id, refCode)
          }
        } catch (referralPersistError) {
          console.warn('Signup referral attribution skipped:', referralPersistError)
        }
      }

      // Ensure canonical user doc exists (migration for old Auth.js users)
      try {
        console.log('Ensuring user document exists for authenticated user:', user.email)
        const canonicalId = await userMigrationService.ensureUserDocument(user as any)
        if (canonicalId && canonicalId !== user.id) {
          user.id = canonicalId
        }
        console.log('User document ensured successfully for authenticated user:', canonicalId)
      } catch (error) {
        // If user doc creation fails, don't block login
        console.error('Failed to ensure user document exists:', error)
      }

      // Ensure initial wallet exists for auth'd user (WalletConductor; override-safe — no session yet)
      try {
        console.log('Ensuring wallet for OAuth user:', user.email)
        const ensured = await WalletConductor.ensureNativeWallet({
          id: user.id,
          role: (user as any).role || UserRolesArray.subscriber as UserRolesArray,
        })
        if (!ensured.ok) {
          throw new Error(ensured.error || 'ensureNativeWallet failed')
        }
        console.log('Wallet ensured successfully for OAuth user')
      } catch (error) {
        // If wallet fails, do not block authentication
        console.error('Failed to ensure wallet for OAuth user:', error)
      }
    },
    async signOut() {
      console.log(`User signed out`)
    },
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`)
    },
  },
  debug: process.env.AUTH_DEBUG === "true", // Enable Auth.js debug logs if set
})

// Destructure needed helper functions and handlers from NextAuth instance
const { auth: nextAuthBase, handlers, signIn, signOut } = nextAuthApp

/**
 * Universal `auth()` for server session lookup, including MCP service injection.
 * Returns the signed-in user's session, or a synthetic session for superadmin MCP context.
 * Next.js 16: awaits `connection()` in route contexts so cookie/header reads stay dynamic.
 */
export async function auth(): Promise<Session | null> {
  // Next.js 16: opt out of static prerendering — auth() reads cookies/headers
  // via nextAuthBase(), which rejects during SSG with HANGING_PROMISE_REJECTION.
  // connection() signals Next.js that this request is dynamic. Wrapped in
  // try/catch because auth() is also called from non-route contexts (middleware,
  // instrumentation) where connection() may not be available.
  try {
    const { connection } = await import('next/server')
    await connection()
  } catch {
    // Non-route context (middleware, instrumentation) — safe to skip
  }

  const mcpActor = getMcpActor()
  if (mcpActor) {
    // Inject synthetic admin session if context present (used for MCP/gateway calls)
    return {
      user: {
        id: mcpActor.id,
        email: mcpActor.email,
        name: mcpActor.name,
        role: mcpActor.role,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Valid for 1hr
    } as Session
  }
  // Otherwise, use standard next-auth logic
  return nextAuthBase()
}

export { handlers, signIn, signOut }

export default { auth }