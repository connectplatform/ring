import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import NextAuth from "next-auth"
import authConfig from '@/auth.config'
import { ROUTES, LEGACY_ROUTES } from './constants/routes'
import { UserRole } from '@/features/auth/types'
import { locales, defaultLocale, isValidLocale, getLocaleFromPathname } from '@/utils/i18n-server'

// Create edge-compatible auth instance
const { auth } = NextAuth(authConfig)

/**
 * Auth.js v5 Middleware with i18n routing and route protection
 * 
 * @param {NextRequest} req - The incoming request object
 * @returns {NextResponse} The response object, either allowing the request or redirecting
 */
export default auth((req) => {
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

  // Handle root redirect to default locale
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, req.url))
  }

  // Extract locale from pathname
  const locale = getLocaleFromPathname(pathname)
  const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'

  // If no valid locale in URL, redirect to default locale
  if (!pathname.startsWith(`/${locale}`) && !isValidLocale(pathname.split('/')[1])) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, req.url))
  }

  // Handle legacy route redirects (e.g., /settings -> /en/settings)
  const legacyRoutes = Object.values(LEGACY_ROUTES)
  if (legacyRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, req.url))
  }

  // Get auth info from Auth.js v5
  const session = req.auth
  const isLoggedIn = !!session?.user
  const userRole = session?.user?.role || UserRole.VISITOR

  console.log(`Middleware: Path: ${pathname}, Locale: ${locale}, IsLoggedIn: ${isLoggedIn}, UserRole: ${userRole}`);

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
  if (protectedRoutes.includes(pathnameWithoutLocale) && !isLoggedIn) {
    console.log(`Middleware: Redirecting to login, from: ${pathname}`);
    const url = new URL(ROUTES.LOGIN(locale), req.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // If trying to access confidential route without proper role, redirect to localized home
  if (confidentialRoutes.includes(pathnameWithoutLocale) && (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN)) {
    console.log(`Middleware: Unauthorized access to confidential route, redirecting to home`);
    return NextResponse.redirect(new URL(ROUTES.HOME(locale), req.url));
  }

  // If authenticated user tries to access login page, redirect to localized profile
  if (pathnameWithoutLocale === '/login' && isLoggedIn) {
    console.log(`Middleware: Redirecting to profile, from: ${pathname}`);
    return NextResponse.redirect(new URL(ROUTES.PROFILE(locale), req.url));
  }

  // Allow authenticated users to access the entities page
  if (pathnameWithoutLocale === '/entities' && isLoggedIn) {
    console.log(`Middleware: Allowing access to entities`);
    return NextResponse.next();
  }

  console.log(`Middleware: Proceeding with request to: ${pathname}`);
  return NextResponse.next();
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};

