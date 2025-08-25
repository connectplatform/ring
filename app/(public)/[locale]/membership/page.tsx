import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { isValidLocale, defaultLocale, type Locale, loadTranslations, generateHreflangAlternates } from '@/i18n-config'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import MembershipContent from '@/features/auth/components/membership-content'
import type { AuthUser } from '@/features/auth/types'

interface MembershipPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MembershipPage(props: MembershipPageProps) {
  // Resolve params
  const params = await props.params
  const searchParams = await props.searchParams
  
  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  
  // Get session
  const session = await auth()
  
  // Redirect to login if not authenticated
  if (!session || !session.user) {
    redirect(ROUTES.LOGIN(locale))
  }
  
  const user = session.user as AuthUser
  
  // If user is already a member or higher, redirect to profile
  if (user.role === UserRole.MEMBER || 
      user.role === UserRole.CONFIDENTIAL || 
      user.role === UserRole.ADMIN) {
    redirect(ROUTES.PROFILE(locale))
  }
  
  // React 19 metadata preparation
  const translations = await loadTranslations(locale)
  const membershipTranslations = translations.modules?.membership || {}
  const title = `${membershipTranslations.page?.title || 'Upgrade to Member'} | Ring Platform`
  const description = membershipTranslations.page?.subtitle || 'Upgrade your account to member status and unlock the ability to create entities and opportunities'
  const canonicalUrl = `https://ring.ck.ua/${locale}/membership`
  const alternates = generateHreflangAlternates('/membership')
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}
      
      <MembershipContent 
        user={user}
        locale={locale}
      />
    </>
  )
}
