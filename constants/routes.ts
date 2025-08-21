import type { Locale } from '@/i18n-config'
import { defaultLocale } from '@/i18n-config'

// Base routes without locale
const BASE_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  AUTH_STATUS: '/auth/status/[action]/[status]',
  ENTITIES: '/entities',
  ENTITY_STATUS: '/entities/status/[action]/[status]',
  OPPORTUNITY_STATUS: '/opportunities/status/[action]/[status]',
  NOTIFICATION_STATUS: '/notifications/status/[action]/[status]',
  ENTITY: (id: string) => `/entities/${id}`,
  OPPORTUNITY: (id: string) => `/opportunities/${id}`,
  ADD_ENTITY: '/entities/add',
  OPPORTUNITIES: '/opportunities',
  STORE: '/store',
  CART: '/store/cart',
  CHECKOUT: '/store/checkout',
  STORE_ORDERS: '/store/orders',
  STORE_ORDER_DETAILS: '/store/orders/[id]',
  ADD_OPPORTUNITY: '/opportunities/add',
  ABOUT: '/about',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  CONTACT: '/contact',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  MEMBERSHIP: '/membership',
  CONFIDENTIAL_ENTITIES: '/confidential/entities',
  CONFIDENTIAL_OPPORTUNITIES: '/confidential/opportunities',
  UNAUTHORIZED: '/unauthorized',
  WALLET: '/wallet'
}

// Localized routes
export const ROUTES = {
  HOME: (locale: Locale = defaultLocale) => `/${locale}`,
  LOGIN: (locale: Locale = defaultLocale) => `/${locale}/login`,
  FORGOT_PASSWORD: (locale: Locale = defaultLocale) => `/${locale}/forgot-password`,
  RESET_PASSWORD: (locale: Locale = defaultLocale) => `/${locale}/reset-password`,
  VERIFY_EMAIL: (locale: Locale = defaultLocale) => `/${locale}/verify-email`,
  AUTH_STATUS: (action: string, status: string, locale: Locale = defaultLocale) => `/${locale}/auth/status/${action}/${status}`,
  ENTITIES: (locale: Locale = defaultLocale) => `/${locale}/entities`,
  ENTITY_STATUS: (action: string, status: string, locale: Locale = defaultLocale) => `/${locale}/entities/status/${action}/${status}`,
  OPPORTUNITY_STATUS: (action: string, status: string, locale: Locale = defaultLocale) => `/${locale}/opportunities/status/${action}/${status}`,
  NOTIFICATION_STATUS: (action: string, status: string, locale: Locale = defaultLocale) => `/${locale}/notifications/status/${action}/${status}`,
  ENTITY: (id: string, locale: Locale = defaultLocale) => `/${locale}/entities/${id}`,
  ADD_ENTITY: (locale: Locale = defaultLocale) => `/${locale}/entities/add`,
  OPPORTUNITIES: (locale: Locale = defaultLocale) => `/${locale}/opportunities`,
  OPPORTUNITY: (id: string, locale: Locale = defaultLocale) => `/${locale}/opportunities/${id}`,
  NOTIFICATIONS: (locale: Locale = defaultLocale) => `/${locale}/notifications`,
  STORE: (locale: Locale = defaultLocale) => `/${locale}/store`,
  CART: (locale: Locale = defaultLocale) => `/${locale}/store/cart`,
  CHECKOUT: (locale: Locale = defaultLocale) => `/${locale}/store/checkout`,
  STORE_ORDERS: (locale: Locale = defaultLocale) => `/${locale}/store/orders`,
  STORE_ORDER_DETAILS: (locale: Locale = defaultLocale, id: string) => `/${locale}/store/orders/${id}`,
  ADD_OPPORTUNITY: (locale: Locale = defaultLocale) => `/${locale}/opportunities/add`,
  ABOUT: (locale: Locale = defaultLocale) => `/${locale}/about`,
  TERMS: (locale: Locale = defaultLocale) => `/${locale}/terms`,
  PRIVACY: (locale: Locale = defaultLocale) => `/${locale}/privacy`,
  CONTACT: (locale: Locale = defaultLocale) => `/${locale}/contact`,
  HELP: (locale: Locale = defaultLocale) => `/${locale}/help`,
  SETTINGS: (locale: Locale = defaultLocale) => `/${locale}/settings`,
  PROFILE: (locale: Locale = defaultLocale) => `/${locale}/profile`,
  MEMBERSHIP: (locale: Locale = defaultLocale) => `/${locale}/membership`,
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
  GITHUB: 'https://github.com/connectplatform/ring',
  TWITTER: 'https://twitter.com/sonoratek',
  LINKEDIN: 'https://linkedin.com/company/connectedin',
}