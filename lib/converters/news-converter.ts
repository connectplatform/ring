import {
  FirestoreDataConverter,
  DocumentData,
  WithFieldValue,
  QueryDocumentSnapshot,
  FieldValue,
  Timestamp,
} from 'firebase-admin/firestore';
import { NewsArticle } from '@/features/news/types';

/**
 * Helper function to safely convert various timestamp formats to Firestore Timestamp
 */
function safeToTimestamp(timestamp: any): Timestamp | undefined {
  if (!timestamp) return undefined;
  
  // If it's already a Timestamp, return it
  if (timestamp instanceof Timestamp) {
    return timestamp;
  }
  
  // If it has toDate method (Firestore timestamp-like object), try to convert
  if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
    try {
      const date = timestamp.toDate();
      return Timestamp.fromDate(date);
    } catch (error) {
      console.warn('Failed to convert timestamp-like object:', error);
      return undefined;
    }
  }
  
  // If it's a Date object, convert to Timestamp
  if (timestamp instanceof Date) {
    return Timestamp.fromDate(timestamp);
  }
  
  // If it's a string, try to parse as date then convert to Timestamp
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  
  // If it's a number (milliseconds), convert to Timestamp
  if (typeof timestamp === 'number') {
    return Timestamp.fromMillis(timestamp);
  }
  
  return undefined;
}

/**
 * Helper function to generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

/**
 * Firestore data converter for the NewsArticle type.
 */
export const newsConverter: FirestoreDataConverter<NewsArticle> = {
  /**
   * Converts a `NewsArticle` object to Firestore format.
   */
  toFirestore(article: WithFieldValue<NewsArticle>): DocumentData {
    return {
      // Required fields
      title: article.title ?? '',
      slug: article.slug ?? (article.title ? generateSlug(article.title as string) : ''),
      content: article.content ?? '',
      excerpt: article.excerpt ?? '',
      authorId: article.authorId ?? '',
      authorName: article.authorName ?? '',
      category: article.category ?? 'other',
      status: article.status ?? 'draft',
      visibility: article.visibility ?? 'public',
      featured: !!article.featured,

      // Timestamps
      createdAt: article.createdAt || FieldValue.serverTimestamp(),
      updatedAt: article.updatedAt || FieldValue.serverTimestamp(),
      publishedAt: article.publishedAt || undefined,

      // Optional fields with defaults
      tags: article.tags ?? [],
      featuredImage: article.featuredImage ?? null,
      gallery: article.gallery ?? [],
      views: article.views ?? 0,
      likes: article.likes ?? 0,
      comments: article.comments ?? 0,
      seo: article.seo ?? null,
    };
  },

  /**
   * Converts a Firestore document snapshot to a `NewsArticle` object.
   */
  fromFirestore(snapshot: QueryDocumentSnapshot): NewsArticle {
    const data = snapshot.data();

    return {
      // Required fields
      id: snapshot.id,
      title: data.title ?? 'Untitled',
      slug: data.slug ?? generateSlug(data.title ?? snapshot.id),
      content: data.content ?? '',
      excerpt: data.excerpt ?? '',
      authorId: data.authorId ?? '',
      authorName: data.authorName ?? 'Unknown Author',
      category: data.category ?? 'other',
      status: data.status ?? 'draft',
      visibility: data.visibility ?? 'public',
      featured: !!data.featured,

      // Convert timestamps safely
      createdAt: safeToTimestamp(data.createdAt) || Timestamp.now(),
      updatedAt: safeToTimestamp(data.updatedAt) || Timestamp.now(),
      publishedAt: safeToTimestamp(data.publishedAt),

      // Optional fields with fallbacks
      tags: Array.isArray(data.tags) ? data.tags : [],
      featuredImage: data.featuredImage ?? null,
      gallery: Array.isArray(data.gallery) ? data.gallery : [],
      views: typeof data.views === 'number' ? data.views : 0,
      likes: typeof data.likes === 'number' ? data.likes : 0,
      comments: typeof data.comments === 'number' ? data.comments : 0,
      seo: data.seo ?? null,
    };
  },
};

/**
 * Firestore data converter for news categories.
 */
export const newsCategoryConverter: FirestoreDataConverter<any> = {
  toFirestore(category: WithFieldValue<any>): DocumentData {
    return {
      name: category.name ?? '',
      description: category.description ?? '',
      color: category.color ?? '#6B7280',
      icon: category.icon ?? '📰',
      createdAt: category.createdAt || FieldValue.serverTimestamp(),
      updatedAt: category.updatedAt || FieldValue.serverTimestamp(),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): any {
    const data = snapshot.data();

    return {
      id: snapshot.id,
      name: data.name ?? 'Unknown Category',
      description: data.description ?? '',
      color: data.color ?? '#6B7280',
      icon: data.icon ?? '📰',
      createdAt: safeToTimestamp(data.createdAt) || Timestamp.now(),
      updatedAt: safeToTimestamp(data.updatedAt) || Timestamp.now(),
    };
  },
};

/**
 * Firestore data converter for news comments.
 */
export const newsCommentConverter: FirestoreDataConverter<any> = {
  toFirestore(comment: WithFieldValue<any>): DocumentData {
    return {
      articleId: comment.articleId ?? '',
      userId: comment.userId ?? '',
      userName: comment.userName ?? '',
      userAvatar: comment.userAvatar ?? null,
      content: comment.content ?? '',
      parentId: comment.parentId ?? null,
      likes: comment.likes ?? 0,
      createdAt: comment.createdAt || FieldValue.serverTimestamp(),
      updatedAt: comment.updatedAt || FieldValue.serverTimestamp(),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): any {
    const data = snapshot.data();

    return {
      id: snapshot.id,
      articleId: data.articleId ?? '',
      userId: data.userId ?? '',
      userName: data.userName ?? 'Anonymous',
      userAvatar: data.userAvatar ?? null,
      content: data.content ?? '',
      parentId: data.parentId ?? null,
      likes: typeof data.likes === 'number' ? data.likes : 0,
      createdAt: safeToTimestamp(data.createdAt) || Timestamp.now(),
      updatedAt: safeToTimestamp(data.updatedAt) || Timestamp.now(),
    };
  },
};