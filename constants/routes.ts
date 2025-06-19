import { Locale, defaultLocale } from '@/utils/i18n-server'

// Base routes without locale
const BASE_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  ENTITIES: '/entities',
  ENTITY: (id: string) => `/entities/${id}`,
  ADD_ENTITY: '/entities/add',
  OPPORTUNITIES: '/opportunities',
  ADD_OPPORTUNITY: '/opportunities/add',
  ABOUT: '/about',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  CONTACT: '/contact',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  CONFIDENTIAL_ENTITIES: '/confidential/entities',
  CONFIDENTIAL_OPPORTUNITIES: '/confidential/opportunities',
  UNAUTHORIZED: '/unauthorized',
  WALLET: '/wallet'
}

// Localized routes
export const ROUTES = {
  HOME: (locale: Locale = defaultLocale) => `/${locale}`,
  LOGIN: (locale: Locale = defaultLocale) => `/${locale}/login`,
  ENTITIES: (locale: Locale = defaultLocale) => `/${locale}/entities`,
  ENTITY: (id: string, locale: Locale = defaultLocale) => `/${locale}/entities/${id}`,
  ADD_ENTITY: (locale: Locale = defaultLocale) => `/${locale}/entities/add`,
  OPPORTUNITIES: (locale: Locale = defaultLocale) => `/${locale}/opportunities`,
  ADD_OPPORTUNITY: (locale: Locale = defaultLocale) => `/${locale}/opportunities/add`,
  ABOUT: (locale: Locale = defaultLocale) => `/${locale}/about`,
  TERMS: (locale: Locale = defaultLocale) => `/${locale}/terms`,
  PRIVACY: (locale: Locale = defaultLocale) => `/${locale}/privacy`,
  CONTACT: (locale: Locale = defaultLocale) => `/${locale}/contact`,
  SETTINGS: (locale: Locale = defaultLocale) => `/${locale}/settings`,
  PROFILE: (locale: Locale = defaultLocale) => `/${locale}/profile`,
  CONFIDENTIAL_ENTITIES: (locale: Locale = defaultLocale) => `/${locale}/confidential/entities`,
  CONFIDENTIAL_OPPORTUNITIES: (locale: Locale = defaultLocale) => `/${locale}/confidential/opportunities`,
  UNAUTHORIZED: (locale: Locale = defaultLocale) => `/${locale}/unauthorized`,
  WALLET: (locale: Locale = defaultLocale) => `/${locale}/wallet`
}

// Legacy routes for backward compatibility (these will redirect to localized versions)
export const LEGACY_ROUTES = BASE_ROUTES

export const API_ROUTES = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REGISTER: '/api/auth/register',
  GET_ENTITIES: '/api/entities',
  GET_ENTITY: (id: string) => `/api/entities/${id}`,
  GET_OPPORTUNITIES: '/api/opportunities',
  SUBMIT_CONTACT_FORM: '/api/contact'
}

export const EXTERNAL_LINKS = {
  GITHUB: 'https://github.com/connectplatform/main-web-app',
  TWITTER: 'https://twitter.com/sonoratek',
  LINKEDIN: 'https://linkedin.com/company/connectedin',
}