import type { NextAuthConfig } from "next-auth"
import { UserRole } from "@/features/auth/user-role"
import { withLocale } from "@/constants/routes"
import { defaultLocale, type Locale } from "@/i18n/shared"
import { routing } from "@/i18n/routing"
import {
  parseReturnToToPathSearch,
  stripLocalePrefix,
} from "@/lib/auth/safe-post-auth-redirect"

const localeIds = routing.locales as readonly string[]

function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split("/").filter(Boolean)[0]
  if (seg && localeIds.includes(seg)) {
    return seg as Locale
  }
  return defaultLocale as Locale
}

function safeRedirectTarget(pathname: string, search: string, baseUrl: string): string {
  const locale = localeFromPathname(pathname)

  if (pathname.includes("/auth/status/")) {
    return `${baseUrl}${withLocale(locale, "/profile")}`
  }

  const candidate = stripLocalePrefix(pathname) + search
  const parsed = parseReturnToToPathSearch(candidate)
  if (!parsed.success) {
    return `${baseUrl}${withLocale(locale, "/profile")}`
  }

  const localized = withLocale(locale, stripLocalePrefix(parsed.data.path))
  return `${baseUrl}${localized}${parsed.data.search || ""}`
}

/**
 * Auth.js v5 Edge-Compatible Configuration
 * CRITICAL: Edge-safe slice merged into `auth.ts`; `proxy.ts` does not wrap NextAuth.
 * 
 * Per Auth.js v5 architecture:
 * - auth.config.ts = Edge-compatible (NO providers, NO adapters, minimal callbacks)
 * - auth.ts = Full server config (ALL providers, database adapters, full logic)
 * 
 * Why NO providers here?
 * - OAuth providers bundle 100KB+ of libraries (OIDC clients, JWT parsers, etc)
 * - This slice is merged into auth flows that must stay small in edge-capable contexts
 * - Providers are only needed in auth.ts for actual authentication flows
 * 
 * This config only needs:
 * - Session validation (JWT verification)
 * - callbacks.authorized is permissive; routes enforce auth in layouts / RSC
 * - No provider initialization required
 */
export default {
  // EMPTY providers array - all providers defined in auth.ts only
  // Edge slice: no providers; full providers live in auth.ts
  providers: [],
  // CRITICAL: trustHost must be here for Auth.js in edge-capable runtime paths
  // Without this, server actions fail with "UntrustedHost" error
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Route protection is enforced in proxy (cookie gate), layouts, and Server Components.
    // Keeping this permissive avoids Auth.js + next-intl redirect loops when the proxy is not wrapped in auth().
    authorized() {
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = token.role || user.role || UserRole.subscriber
        token.isVerified = (user as any).isVerified || false
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.role = token.role as UserRole
        ;(session.user as any).isVerified = token.isVerified as boolean
      }
      return session
    },
    redirect({ url, baseUrl }) {
      const base = new URL(baseUrl)
      try {
        const target = new URL(url, baseUrl)
        if (target.origin !== base.origin) {
          return `${baseUrl}${withLocale(defaultLocale as Locale, "/profile")}`
        }
        return safeRedirectTarget(target.pathname, target.search, baseUrl)
      } catch {
        if (url.startsWith("/")) {
          const q = url.indexOf("?")
          const pathname = q === -1 ? url : url.slice(0, q)
          const search = q === -1 ? "" : url.slice(q)
          return safeRedirectTarget(pathname, search, baseUrl)
        }
        return `${baseUrl}${withLocale(defaultLocale as Locale, "/profile")}`
      }
    },
  },
} satisfies NextAuthConfig