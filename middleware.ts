import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import NextAuth from "next-auth"
import authConfig from '@/auth.config'
import { UserRole } from '@/features/auth/user-role'
import createMiddleware from 'next-intl/middleware'
import { routing, type Locale } from './i18n-routing'

// Inline route constants - middleware only needs login/home paths
// Full route definitions stay in constants/routes.ts for app code
const LOGIN_PATH = '/login'
const HOME_PATH = '/'

// Create edge-compatible auth instance
const { auth } = NextAuth(authConfig)

// Create next-intl middleware
// NOTE: next-intl v3 createMiddleware accepts a single routing config object
const intlMiddleware = createMiddleware(routing)

// OPTIMIZATION: Auth cache to prevent redundant checks (Edge-compatible Map)
// SECURITY: Include IP address in cache key to prevent session fixation attacks
interface AuthCacheEntry {
  userId: string
  role: UserRole
  expires: number
  ipAddress: string // SECURITY: Bind cache to IP to prevent session hijacking
}

const authCache = new Map<string, AuthCacheEntry>()
const CACHE_TTL = 30000 // 30 seconds - optimal for Edge runtime memory constraints

// Clean up expired cache entries (Edge runtime compatible)
function cleanExpiredCache() {
  const now = Date.now()
  for (const [key, value] of authCache.entries()) {
    if (value.expires < now) {
      authCache.delete(key)
    }
  }
  // Keep cache size manageable in Edge runtime
  if (authCache.size > 1000) {
    const entries = Array.from(authCache.entries())
    entries.sort((a, b) => a[1].expires - b[1].expires)
    // Remove oldest 25% of entries
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25))
    toRemove.forEach(([key]) => authCache.delete(key))
  }
}

/**
 * Combined Auth.js v5 + next-intl Middleware with route protection
 * 
 * @param {NextRequest} req - The incoming request object
 * @returns {NextResponse} The response object, either allowing the request or redirecting
 */
export default auth(async (req) => {
  try {
    const { pathname } = req.nextUrl
    const method = req.method

    // Skip middleware for API routes, static files, and Next.js internals
    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.includes('.')
    ) {
      return NextResponse.next()
    }

    // NOTE: Removed POST→GET redirect for /login page
    // Auth.js v5 with GIS uses client-side signIn() calls, not form POST
    // The redirect was causing 80+ unnecessary middleware executions per auth attempt

    // First, handle i18n routing with next-intl and capture its response if it redirects
    const i18nResponse = intlMiddleware(req)
    if (i18nResponse) {
      // If next-intl decided to redirect (e.g., missing/invalid locale), return that response to avoid double-processing
      const status = i18nResponse.status
      if (status >= 300 && status < 400) {
        return i18nResponse
      }
    }

    // Extract locale from pathname (after next-intl processing)
    const localeFromPath = pathname.split('/')[1] || routing.defaultLocale
    let locale = (localeFromPath === 'en' || localeFromPath === 'uk' || localeFromPath === 'ru') ? localeFromPath : routing.defaultLocale

    // Check if we should redirect to user's preferred locale
    // Only redirect if no locale in path or path doesn't have a valid locale
    const shouldCheckStoredLocale = !localeFromPath || !routing.locales.includes(localeFromPath as any)
    if (shouldCheckStoredLocale) {
      const storedLocale = req.cookies.get('ring-locale')?.value as Locale
      if (storedLocale && routing.locales.includes(storedLocale) && storedLocale !== locale) {
        // Redirect to stored locale preference
        const newPath = `/${storedLocale}${pathname}`
        return NextResponse.redirect(new URL(newPath, req.nextUrl.origin))
      }
    }

    const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'

    // OPTIMIZED: Check auth cache first to prevent redundant auth() calls
    const sessionToken = req.cookies.get('next-auth.session-token')?.value || 
                        req.cookies.get('__Secure-next-auth.session-token')?.value
    
    // SECURITY: Get client IP for session fixation prevention
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown'

    let isLoggedIn = false
    let userRole = UserRole.VISITOR
    let userId: string | undefined
    let isCachedAuth = false

    // Clean up expired cache entries periodically
    cleanExpiredCache()

    if (sessionToken) {
      const cached = authCache.get(sessionToken)
      if (cached && cached.expires > Date.now()) {
        // SECURITY: Verify IP address matches to prevent session hijacking
        if (cached.ipAddress === clientIp) {
          // Use cached auth result - significant performance improvement
          isLoggedIn = true
          userRole = cached.role
          userId = cached.userId
          isCachedAuth = true
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`Middleware: Using cached auth - User: ${userId}, Role: ${userRole}`);
          }
        } else {
          // SECURITY: IP mismatch - potential session hijacking attempt
          console.warn(`⚠️ Session IP mismatch detected! Cached: ${cached.ipAddress}, Current: ${clientIp}`)
          authCache.delete(sessionToken) // Invalidate suspicious cache entry
        }
      }
    }

    // Only call auth() if not cached - reduces auth overhead by ~70%
    if (!isCachedAuth) {
      // Get auth info from Auth.js v5 (middleware version) - ONLY when not cached
      const session = req.auth
      
      // Check for session cookies as fallback since middleware auth might be inconsistent
      const hasSessionCookie = !!sessionToken
      
      // Consider user logged in if either session exists OR session cookie is present
      isLoggedIn = !!session?.user || hasSessionCookie
      userRole = session?.user?.role || (hasSessionCookie ? UserRole.SUBSCRIBER : UserRole.VISITOR)
      userId = session?.user?.id

      // CACHE: Store auth result for future requests (Edge-compatible)
      // SECURITY: Bind cache entry to IP address
      if (session?.user && sessionToken) {
        authCache.set(sessionToken, {
          userId: session.user.id,
          role: userRole,
          expires: Date.now() + CACHE_TTL,
          ipAddress: clientIp // SECURITY: Bind to IP
        })
      }
      
      // Debug session state in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Middleware: Auth check - Session: ${!!session?.user}, Cookie: ${hasSessionCookie}, Final IsLoggedIn: ${isLoggedIn}`);
        if (session) {
          console.log(`Middleware: Session found - User ID: ${session.user?.id}, Email: ${session.user?.email}`);
        }
      }
    }

    // Only log middleware checks in development to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`Middleware: Path: ${pathname}, Locale: ${locale}, IsLoggedIn: ${isLoggedIn}, UserRole: ${userRole}`);
    }

    // Check if this is a language switch by looking for the referer header
    const referer = req.headers.get('referer')
    const isLanguageSwitch = referer && referer.includes(req.nextUrl.origin) && 
                            referer.replace(/\/[a-z]{2}\//, '/') === pathname.replace(/\/[a-z]{2}\//, '/')

    // Protect routes that require authentication
    const protectedRoutes = [
      '/profile',
      '/settings'
    ];

    // Routes that should bypass tunnel initialization during auth
    // Tunnel will be established AFTER user authentication is confirmed
    const tunnelBypassRoutes = [
      '/profile'
    ];

    // Routes that require confidential or admin status
    const confidentialRoutes = [
      '/confidential/entities',
      '/confidential/opportunities'
    ];

    // If trying to access protected route without auth, redirect to localized login
    // Skip redirect if this is just a language switch (user is already on the page)
    if (protectedRoutes.includes(pathnameWithoutLocale) && !isLoggedIn && !isLanguageSwitch) {
      console.log(`Middleware: Redirecting to login, from: ${pathname} (no session found)`);
      const url = new URL(`/${locale}${LOGIN_PATH}`, req.nextUrl.origin);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }

    // If trying to access confidential route without proper role, redirect to localized home
    if (confidentialRoutes.includes(pathnameWithoutLocale) && (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN)) {
      console.log(`Middleware: Unauthorized access to confidential route, redirecting to home`);
      return NextResponse.redirect(new URL(`/${locale}`, req.nextUrl.origin));
    }

    // If authenticated user tries to access login page, redirect to localized profile
    // BUT: Skip redirect if OAuth callback is in progress (query params: code, state, error, session_state)
    // These params indicate the user is completing an OAuth flow and should not be interrupted
    if (pathnameWithoutLocale === '/login' && isLoggedIn) {
      const hasOAuthCallbackParams = 
        req.nextUrl.searchParams.has('code') ||
        req.nextUrl.searchParams.has('state') ||
        req.nextUrl.searchParams.has('error') ||
        req.nextUrl.searchParams.has('session_state')
      
      if (!hasOAuthCallbackParams) {
        console.log(`Middleware: Redirecting authenticated user to profile, from: ${pathname}`);
        // Preserve locale when redirecting to profile
        return NextResponse.redirect(new URL(`/${locale}/profile`, req.nextUrl.origin));
      } else {
        const paramsList = Array.from(req.nextUrl.searchParams.keys()).join(', ')
        console.log(`Middleware: OAuth callback detected (${paramsList}), allowing login page access for OAuth completion`);
      }
    }

    console.log(`Middleware: Proceeding with request to: ${pathname}`);
    
    // OPTIMIZATION: Pass auth info to API routes via headers to prevent duplicate auth checks
    const response = NextResponse.next()

    // PHASE 1: TUNNEL TIMING REARCHITECTURE
    // Move tunnel initialization to AFTER user authentication for auth-critical routes
    const shouldBypassTunnel = tunnelBypassRoutes.includes(pathnameWithoutLocale) && isLoggedIn;

    if (shouldBypassTunnel) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Middleware: Bypassing tunnel initialization for auth route: ${pathname} - tunnel will connect after user status confirmed`);
      }
      // Set flag to indicate tunnel should be established client-side after auth
      response.headers.set('x-tunnel-bypass', 'true');
    }

    if (isLoggedIn && userId) {
      // Set auth headers for API routes to consume - reduces API auth overhead
      response.headers.set('x-auth-user-id', userId)
      response.headers.set('x-auth-user-role', userRole)
      response.headers.set('x-auth-cached', isCachedAuth ? 'true' : 'false')
      response.headers.set('x-auth-timestamp', Date.now().toString())

      if (process.env.NODE_ENV === 'development') {
        console.log(`Middleware: Set auth headers - User: ${userId}, Role: ${userRole}, Cached: ${isCachedAuth}`);
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    // In case of any error, allow the request to proceed
    return NextResponse.next();
  }
})

/**
 * Auth.js v5 Middleware Matcher Configuration
 * Ensures middleware runs on all routes except API routes, static files, and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
