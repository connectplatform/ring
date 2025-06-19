import { CollectionReference } from 'firebase-admin/firestore';
import { Entity } from '@/types';
import { Opportunity } from '@/types';
import { NewsArticle, NewsCategoryInfo, NewsComment } from '@/features/news/types';
import { entityConverter } from '@/lib/converters/entity-converter';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { newsConverter, newsCategoryConverter, newsCommentConverter } from '@/lib/converters/news-converter';
import { getAdminDb } from '@/lib/firebase-admin.server';

// Utility function for entities collection
export const getEntitiesCollection = (): CollectionReference<Entity> =>
  getAdminDb().collection('entities').withConverter(entityConverter);

// Utility function for opportunities collection
export const getopportunitiesCollection = (): CollectionReference<Opportunity> =>
  getAdminDb().collection('opportunities').withConverter(opportunityConverter);

// Utility function for news collection
export const getNewsCollection = (): CollectionReference<NewsArticle> =>
  getAdminDb().collection('news').withConverter(newsConverter);

// Utility function for news categories collection
export const getNewsCategoriesCollection = (): CollectionReference<NewsCategoryInfo> =>
  getAdminDb().collection('newsCategories').withConverter(newsCategoryConverter);

// Utility function for news comments collection
export const getNewsCommentsCollection = (): CollectionReference<NewsComment> =>
  getAdminDb().collection('newsComments').withConverter(newsCommentConverter);

