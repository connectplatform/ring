import { Timestamp } from 'firebase-admin/firestore';

// News visibility levels
export type NewsVisibility = 'public' | 'subscriber' | 'member' | 'confidential';

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
  | 'press-releases'
  | 'tutorials'
  | 'other';

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
}

// News query filters
export interface NewsFilters {
  category?: NewsCategory;
  status?: NewsStatus;
  visibility?: NewsVisibility;
  featured?: boolean;
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