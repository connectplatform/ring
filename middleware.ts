import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ROUTES, LEGACY_ROUTES } from './constants/routes'
import { UserRole } from '@/features/auth/types'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n-config'

// Create next-intl middleware
// NOTE: next-intl v3 createMiddleware accepts a single routing config object
const intlMiddleware = createMiddleware(routing)

/**
 * Combined BetterAuth + next-intl Middleware with route protection
 * 
 * @param {NextRequest} req - The incoming request object
 * @returns {NextResponse} The response object, either allowing the request or redirecting
 */
export default async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    // Skip middleware for API routes, static files, and Next.js internals
    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.includes('.')
    ) {
      return NextResponse.next()
    }

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
    const locale = (localeFromPath === 'en' || localeFromPath === 'uk') ? localeFromPath : routing.defaultLocale
    const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'

    // Check for BetterAuth session using cookies
    let isLoggedIn = false
    let userRole = UserRole.VISITOR
    
    try {
      // BetterAuth stores session info in cookies
      // Check for common BetterAuth session cookie names
      const sessionCookie = req.cookies.get('better-auth.session_token') || 
                           req.cookies.get('session_token') || 
                           req.cookies.get('better-auth.session') ||
                           req.cookies.get('session')
      
      if (sessionCookie?.value) {
        // Basic validation - if session cookie exists, consider user logged in
        // Full session validation will happen in server components and API routes
        isLoggedIn = true
        userRole = UserRole.SUBSCRIBER // Default authenticated role
        
        console.log(`Middleware: Found session cookie: ${sessionCookie.name}`)
      }
    } catch (error) {
      console.warn('Middleware: Error checking session:', error)
      // On error, default to unauthenticated
      isLoggedIn = false
      userRole = UserRole.VISITOR
    }

    console.log(`Middleware: Path: ${pathname}, Locale: ${locale}, IsLoggedIn: ${isLoggedIn}, UserRole: ${userRole}`);

    // Check if this is a language switch by looking for the referer header
    const referer = req.headers.get('referer')
    const isLanguageSwitch = referer && referer.includes(req.nextUrl.origin) && 
                            referer.replace(/\/[a-z]{2}\//, '/') === pathname.replace(/\/[a-z]{2}\//, '/')

    // Protect routes that require authentication
    const protectedRoutes = [
      '/profile',
      '/settings',
      '/entities',
      '/opportunities'
    ];

    // Routes that require confidential or admin status
    const confidentialRoutes = [
      '/confidential/entities',
      '/confidential/opportunities'
    ];

    // If trying to access protected route without auth, redirect to localized login
    // Skip redirect if this is just a language switch (user is already on the page)
    if (protectedRoutes.includes(pathnameWithoutLocale) && !isLoggedIn && !isLanguageSwitch) {
      console.log(`Middleware: Redirecting to login, from: ${pathname}`);
      const url = new URL(ROUTES.LOGIN(locale), req.nextUrl.origin);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }

    // If trying to access confidential route without proper role, redirect to localized home
    if (confidentialRoutes.includes(pathnameWithoutLocale) && userRole === UserRole.VISITOR) {
      console.log(`Middleware: Unauthorized access to confidential route, redirecting to home`);
      return NextResponse.redirect(new URL(ROUTES.HOME(locale), req.nextUrl.origin));
    }

    // If authenticated user tries to access login page, redirect to localized profile
    if (pathnameWithoutLocale === '/login' && isLoggedIn) {
      console.log(`Middleware: Redirecting to profile, from: ${pathname}`);
      // Preserve locale when redirecting to profile
      return NextResponse.redirect(new URL(`/${locale}/profile`, req.nextUrl.origin));
    }

    console.log(`Middleware: Proceeding with request to: ${pathname}`);
    
    // Continue with the request
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

/**
 * BetterAuth Middleware Matcher Configuration
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
