import { PLATFORM_NEWS_CATEGORIES, type NewsCategory } from '@/features/news/types'

export type PlatformCategoryDisplay = {
  name: string
  description: string
  color: string
  icon: string
  articleCount: number
}

const SEED: Record<string, Omit<PlatformCategoryDisplay, 'articleCount'>> = {
  'platform-updates': {
    name: 'Platform Updates',
    description: 'Latest updates, features, and improvements to Ring Platform',
    color: 'bg-blue-500',
    icon: '🚀',
  },
  partnerships: {
    name: 'Partnerships',
    description: 'Collaborations, integrations, and partnership announcements',
    color: 'bg-green-500',
    icon: '🤝',
  },
  community: {
    name: 'Community',
    description: 'Community highlights, events, and member stories',
    color: 'bg-purple-500',
    icon: '👥',
  },
  'industry-news': {
    name: 'Industry News',
    description: 'Web3, blockchain, and decentralized technology news',
    color: 'bg-orange-500',
    icon: '📰',
  },
  events: {
    name: 'Events',
    description: 'Upcoming events, webinars, and community gatherings',
    color: 'bg-pink-500',
    icon: '📅',
  },
  announcements: {
    name: 'Announcements',
    description: 'Important announcements and platform communications',
    color: 'bg-yellow-500',
    icon: '📢',
  },
  'press-releases': {
    name: 'Press Releases',
    description: 'Official press releases and media communications',
    color: 'bg-indigo-500',
    icon: '📄',
  },
  tutorials: {
    name: 'Tutorials',
    description: 'How-to guides, tutorials, and educational content',
    color: 'bg-teal-500',
    icon: '📚',
  },
  other: {
    name: 'Other',
    description: 'Miscellaneous articles and content',
    color: 'bg-gray-500',
    icon: '📝',
  },
  security: {
    name: 'Security',
    description: 'Security updates and advisories',
    color: 'bg-red-500',
    icon: '🔒',
  },
  blogs: {
    name: 'Blogs',
    description: 'Member blog posts and community writing',
    color: 'bg-slate-500',
    icon: '✍️',
  },
}

export const PLATFORM_CATEGORY_INFO: Record<NewsCategory, PlatformCategoryDisplay> =
  Object.fromEntries(
    PLATFORM_NEWS_CATEGORIES.map((slug) => {
      const seed = SEED[slug] ?? {
        name: slug,
        description: '',
        color: 'bg-gray-500',
        icon: '📝',
      }
      return [slug, { ...seed, articleCount: 0 }]
    }),
  )
