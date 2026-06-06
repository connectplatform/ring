import { Timestamp } from 'firebase-admin/firestore';

// News visibility levels
export type NewsVisibility = 'public' | 'subscriber' | 'member' | 'confidential' | 'blog-only' | 'site-wide';

export type NewsContentType = 'official' | 'blog';

export type MainPageStatus =
  | 'draft'
  | 'submitted'
  | 'ai_scored'
  | 'payment_pending'
  | 'awaiting_admin_approval'
  | 'published_main'
  | 'rejected'
  | 'published_blog_only'
  | 'none';

// News status
export type NewsStatus = 'draft' | 'published' | 'archived';

// News categories
export type NewsCategory = 
  | 'platform-updates'
  | 'partnerships' 
  | 'community'
  | 'industry-news'
  | 'events'
  | 'announcements'
  | 'security'
  | 'press-releases'
  | 'tutorials'
  | 'other'
  | 'blogs';

// SEO metadata for news articles
export interface NewsSEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

// News article interface
export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  category: NewsCategory;
  tags: string[];
  featuredImage?: string;
  gallery?: string[];
  status: NewsStatus;
  visibility: NewsVisibility;
  featured: boolean;
  views: number;
  likes: number;
  comments: number;
  publishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  seo?: NewsSEO;
  // Multilingual support
  locale?: string;
  translationGroupId?: string;
  availableTranslations?: string[]; // List of available locale codes
  contentType?: NewsContentType;
  blogUsername?: string;
  promoteToMainPage?: boolean;
  mainPageStatus?: MainPageStatus;
  mainPageStatusHistory?: NewsStatusHistoryEntry[];
  siteWideSlug?: string;
  siteWideCategory?: string;
  aiScore?: NewsAiScore;
  payment?: NewsPromotionPayment;
}

export interface NewsStatusHistoryEntry {
  status: MainPageStatus;
  at: string;
  by?: string;
  note?: string;
}

export interface NewsAiScore {
  ethics: number;
  spamRisk: number;
  duplicateRisk: number;
  merit: number;
  suggestedPriceUah?: number;
  model?: string;
  scoredAt?: string;
  hardBlock?: boolean;
  blockReason?: string;
}

export interface NewsPromotionPayment {
  provider: 'wayforpay' | 'stripe';
  orderReference?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
  counterOfferAmount?: number;
}

// News category interface
export interface NewsCategoryInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// News comment interface
export interface NewsComment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  parentId?: string; // For nested comments
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// News like interface
export interface NewsLike {
  id: string;
  articleId: string;
  userId: string;
  createdAt: Timestamp;
}

// News form data for create/edit
export interface NewsFormData {
  title: string;
  slug?: string;
  content: string;
  excerpt: string;
  category: NewsCategory;
  tags: string[];
  featuredImage?: string;
  gallery?: string[];
  status: NewsStatus;
  visibility: NewsVisibility;
  featured: boolean;
  publishedAt?: Date;
  seo?: NewsSEO;
  contentType?: NewsContentType;
  blogUsername?: string;
  promoteToMainPage?: boolean;
  locale?: string;
}

// News query filters
export interface NewsFilters {
  category?: NewsCategory;
  status?: NewsStatus;
  visibility?: NewsVisibility;
  featured?: boolean;
  mainPageStatus?: MainPageStatus;
  contentType?: NewsContentType;
  authorId?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'publishedAt' | 'views' | 'likes';
  sortOrder?: 'asc' | 'desc';
}

// News analytics data
export interface NewsAnalytics {
  totalArticles: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  popularArticles: NewsArticle[];
  topCategories: { category: NewsCategory; count: number }[];
  recentActivity: {
    date: string;
    views: number;
    likes: number;
    comments: number;
  }[];
}

// News RSS feed item
export interface NewsRSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: string;
  author: string;
  guid: string;
}