/**
 * React 19 Enhanced Metadata Management System
 * Provides dynamic metadata generation with performance optimizations
 */

import { Metadata } from 'next'
import { NewsArticle } from '@/features/news/types'
import { Opportunity } from '@/features/opportunities/types'
import { Entity } from '@/features/entities/types'
import { Timestamp, FieldValue } from 'firebase/firestore'

// Base metadata configuration with mutable arrays for Next.js compatibility
const BASE_METADATA = {
  title: 'Ring - Decentralized Opportunities Platform',
  description: 'Connect, collaborate, and create value in the decentralized economy',
  keywords: ['decentralized', 'opportunities', 'blockchain', 'collaboration', 'web3'] as string[],
  author: 'Ring Platform',
  robots: 'index, follow',
  openGraph: {
    type: 'website' as const,
    locale: 'en_US',
    siteName: 'Ring Platform',
    images: [
      {
        url: '/images/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Ring Platform - Decentralized Opportunities',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image' as const,
    site: '@RingPlatform',
    creator: '@RingPlatform',
  },
}

// Page-specific metadata generators
export const generatePageMetadata = {
  home: (locale: string = 'en'): Metadata => ({
    title: BASE_METADATA.title,
    description: BASE_METADATA.description,
    keywords: [...BASE_METADATA.keywords],
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'en': '/en',
        'uk': '/uk',
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: BASE_METADATA.openGraph.siteName,
      title: 'Ring - Decentralized Opportunities Platform',
      description: 'Discover and create opportunities in the decentralized economy',
      url: `/${locale}`,
      images: [...BASE_METADATA.openGraph.images],
    },
    twitter: BASE_METADATA.twitter,
  }),

  opportunities: (locale: string = 'en'): Metadata => ({
    title: 'Opportunities - Ring Platform',
    description: 'Explore decentralized opportunities, partnerships, and collaborations. Find your next big opportunity in the Web3 ecosystem.',
    keywords: [...BASE_METADATA.keywords, 'opportunities', 'partnerships', 'collaborations'],
    alternates: {
      canonical: `/${locale}/opportunities`,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: BASE_METADATA.openGraph.siteName,
      title: 'Opportunities - Ring Platform',
      description: 'Explore decentralized opportunities and partnerships',
      url: `/${locale}/opportunities`,
      images: [...BASE_METADATA.openGraph.images],
    },
    twitter: BASE_METADATA.twitter,
  }),

  entities: (locale: string = 'en'): Metadata => ({
    title: 'Entities - Ring Platform',
    description: 'Discover verified entities in the decentralized ecosystem. Connect with organizations, DAOs, and projects building the future.',
    keywords: [...BASE_METADATA.keywords, 'entities', 'organizations', 'DAOs', 'projects'],
    alternates: {
      canonical: `/${locale}/entities`,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: BASE_METADATA.openGraph.siteName,
      title: 'Entities - Ring Platform',
      description: 'Discover verified entities in the decentralized ecosystem',
      url: `/${locale}/entities`,
      images: [...BASE_METADATA.openGraph.images],
    },
    twitter: BASE_METADATA.twitter,
  }),

  news: (locale: string = 'en'): Metadata => ({
    title: 'News - Ring Platform',
    description: 'Stay updated with the latest news, announcements, and insights from the Ring platform and the broader Web3 ecosystem.',
    keywords: [...BASE_METADATA.keywords, 'news', 'announcements', 'updates', 'insights'],
    alternates: {
      canonical: `/${locale}/news`,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: BASE_METADATA.openGraph.siteName,
      title: 'News - Ring Platform',
      description: 'Latest news and updates from Ring platform',
      url: `/${locale}/news`,
      images: [...BASE_METADATA.openGraph.images],
    },
    twitter: BASE_METADATA.twitter,
  }),

  profile: (locale: string = 'en'): Metadata => ({
    title: 'Profile - Ring Platform',
    description: 'Manage your Ring platform profile, preferences, and account settings.',
    robots: 'noindex, nofollow', // Private page
    alternates: {
      canonical: `/${locale}/profile`,
    },
  }),
}

// Helper function to convert Firebase Timestamp to ISO string
const timestampToISOString = (timestamp: Timestamp | FieldValue | Date): string => {
  if (timestamp instanceof Date) {
    return timestamp.toISOString()
  }
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date((timestamp as Timestamp).seconds * 1000).toISOString()
  }
  // Fallback to current date if timestamp is invalid
  return new Date().toISOString()
}

// Dynamic content metadata generators with correct property names
export const generateContentMetadata = {
  newsArticle: (article: NewsArticle, locale: string = 'en'): Metadata => ({
    title: `${article.title} - Ring News`,
    description: article.excerpt || article.seo?.metaDescription || BASE_METADATA.description,
    keywords: [
      ...BASE_METADATA.keywords,
      ...article.tags,
      ...(article.seo?.keywords || []),
    ],
    authors: [{ name: article.authorName }],
    alternates: {
      canonical: `/${locale}/news/${article.slug}`,
    },
    openGraph: {
      type: 'article',
      title: article.seo?.ogTitle || article.title,
      description: article.seo?.ogDescription || article.excerpt,
      url: `/${locale}/news/${article.slug}`,
      siteName: BASE_METADATA.openGraph.siteName,
      authors: [article.authorName],
      tags: article.tags,
      images: article.featuredImage ? [
        {
          url: article.featuredImage,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ] : [...BASE_METADATA.openGraph.images],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seo?.twitterTitle || article.title,
      description: article.seo?.twitterDescription || article.excerpt,
      images: article.seo?.twitterImage || article.featuredImage ? [
        article.seo?.twitterImage || article.featuredImage
      ] : undefined,
    },
  }),

  opportunity: (opportunity: Opportunity, locale: string = 'en'): Metadata => ({
    title: `${opportunity.title} - Ring Opportunities`,
    description: opportunity.briefDescription?.substring(0, 160) + '...' || `Learn more about ${opportunity.title} on Ring platform`,
    keywords: [
      ...BASE_METADATA.keywords,
      ...opportunity.tags,
      opportunity.type,
      opportunity.category,
    ],
    alternates: {
      canonical: `/${locale}/opportunities/${opportunity.id}`,
    },
    openGraph: {
      type: 'article',
      title: opportunity.title,
      description: opportunity.briefDescription?.substring(0, 160) + '...' || `Learn more about ${opportunity.title}`,
      url: `/${locale}/opportunities/${opportunity.id}`,
      siteName: BASE_METADATA.openGraph.siteName,
      images: opportunity.attachments?.length ? [
        {
          url: opportunity.attachments[0].url,
          width: 1200,
          height: 630,
          alt: opportunity.title,
        },
      ] : [...BASE_METADATA.openGraph.images],
    },
  }),

  entity: (entity: Entity, locale: string = 'en'): Metadata => ({
    title: `${entity.name} - Ring Entities`,
    description: entity.shortDescription?.substring(0, 160) + '...' || `Learn more about ${entity.name} on Ring platform`,
    keywords: [
      ...BASE_METADATA.keywords,
      entity.type,
      entity.name,
      ...(entity.tags || []),
    ],
    alternates: {
      canonical: `/${locale}/entities/${entity.id}`,
    },
    openGraph: {
      type: 'profile',
      title: entity.name,
      description: entity.shortDescription?.substring(0, 160) + '...' || `Learn more about ${entity.name}`,
      url: `/${locale}/entities/${entity.id}`,
      siteName: BASE_METADATA.openGraph.siteName,
      images: entity.logo ? [
        {
          url: entity.logo,
          width: 1200,
          height: 630,
          alt: entity.name,
        },
      ] : [...BASE_METADATA.openGraph.images],
    },
  }),
}

// JSON-LD structured data generators
export const generateStructuredData = {
  website: (locale: string = 'en') => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ring Platform',
    description: BASE_METADATA.description,
    url: `https://ring.platform/${locale}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `https://ring.platform/${locale}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }),

  organization: () => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ring Platform',
    description: BASE_METADATA.description,
    url: 'https://ring.platform',
    logo: 'https://ring.platform/images/logo.svg',
    sameAs: [
      'https://twitter.com/RingPlatform',
      'https://github.com/ring-platform',
    ],
  }),

  newsArticle: (article: NewsArticle, locale: string = 'en') => ({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: article.featuredImage,
    datePublished: timestampToISOString(article.createdAt),
    dateModified: timestampToISOString(article.updatedAt),
    author: {
      '@type': 'Person',
      name: article.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ring Platform',
      logo: {
        '@type': 'ImageObject',
        url: 'https://ring.platform/images/logo.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://ring.platform/${locale}/news/${article.slug}`,
    },
  }),

  opportunity: (opportunity: Opportunity, locale: string = 'en') => ({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opportunity.title,
    description: opportunity.briefDescription || opportunity.fullDescription,
    datePosted: timestampToISOString(opportunity.dateCreated),
    validThrough: timestampToISOString(opportunity.expirationDate),
    employmentType: opportunity.type === 'offer' ? 'FULL_TIME' : 'CONTRACT',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Ring Platform',
    },
    jobLocation: {
      '@type': 'Place',
      address: opportunity.location,
    },
  }),

  entity: (entity: Entity, locale: string = 'en') => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: entity.name,
    description: entity.shortDescription || entity.fullDescription,
    url: entity.website,
    logo: entity.logo,
    address: entity.location,
    foundingDate: entity.foundedYear ? `${entity.foundedYear}-01-01` : undefined,
    numberOfEmployees: entity.employeeCount,
    sameAs: [
      entity.socialMedia?.linkedin,
      entity.socialMedia?.twitter,
      entity.socialMedia?.facebook,
    ].filter(Boolean),
  }),
}

// React 19 Enhanced Metadata Hook
export function useMetadata(type: string, data?: any, locale: string = 'en'): Metadata {
  switch (type) {
    case 'home':
      return generatePageMetadata.home(locale)
    case 'opportunities':
      return generatePageMetadata.opportunities(locale)
    case 'entities':
      return generatePageMetadata.entities(locale)
    case 'news':
      return generatePageMetadata.news(locale)
    case 'profile':
      return generatePageMetadata.profile(locale)
    case 'news-article':
      return data ? generateContentMetadata.newsArticle(data, locale) : generatePageMetadata.news(locale)
    case 'opportunity':
      return data ? generateContentMetadata.opportunity(data, locale) : generatePageMetadata.opportunities(locale)
    case 'entity':
      return data ? generateContentMetadata.entity(data, locale) : generatePageMetadata.entities(locale)
    default:
      return {
        title: BASE_METADATA.title,
        description: BASE_METADATA.description,
        keywords: [...BASE_METADATA.keywords],
      }
  }
}

// Performance optimization: Preload critical metadata
export const preloadCriticalMetadata = () => {
  // This can be called in the root layout to preload critical metadata
  return {
    title: BASE_METADATA.title,
    description: BASE_METADATA.description,
    keywords: [...BASE_METADATA.keywords],
    other: {
      'preload-metadata': 'true',
    },
  }
} 