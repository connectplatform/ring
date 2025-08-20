import React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getNewsCollection } from '@/lib/firestore-collections';
import { NewsArticle } from '@/features/news/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow, format } from 'date-fns';
import { Calendar, User, Eye, Heart, MessageCircle, ArrowLeft, Share2 } from 'lucide-react';
import { LocalePageProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config';
import { NewsLikeButton } from '@/features/interactions/components/like-button';
import { auth } from '@/auth';

interface NewsArticlePageParams {
  locale: string;
  slug: string;
}

async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  try {
    const newsCollection = getNewsCollection();
    const snapshot = await newsCollection.where('slug', '==', slug).limit(1).get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data();
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

async function getRelatedArticles(currentArticle: NewsArticle): Promise<NewsArticle[]> {
  try {
    const newsCollection = getNewsCollection();
    const snapshot = await newsCollection
      .where('status', '==', 'published')
      .where('category', '==', currentArticle.category)
      .where('visibility', 'in', ['public', 'subscriber'])
      .orderBy('publishedAt', 'desc')
      .limit(4)
      .get();
    
    return snapshot.docs
      .map(doc => doc.data())
      .filter(article => article.id !== currentArticle.id)
      .slice(0, 3);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

export default async function NewsArticlePage(props: LocalePageProps<NewsArticlePageParams>) {
  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  const { slug } = params;

  console.log('NewsArticlePage: Using locale', locale);

  // Load translations for the current locale
  const translations = loadTranslations(locale);
  
  // Get current user session for like button
  const session = await auth();

  const article = await getArticleBySlug(slug);
  
  if (!article) {
    notFound();
  }

  // React 19 metadata preparation
  const title = article.seo?.metaTitle || `${article.title} - Ring Platform`;
  const description = article.seo?.metaDescription || article.excerpt;
  const canonicalUrl = `https://ring.ck.ua/${locale}/news/${slug}`;
  const alternates = generateHreflangAlternates(`/news/${slug}`);
  const publishedDate = article.publishedAt?.toDate() || article.createdAt.toDate();

  const relatedArticles = await getRelatedArticles(article);
  
  // Check if current user has liked this article
  let userHasLiked = false;
  let likeCount = article.likes || 0;
  
  if (article.id) {
    try {
      console.log('NewsArticlePage: Calling getNewsLikeStatus service');
      const { getNewsLikeStatus } = await import('@/features/news/services/get-news-like-status');
      const likeStatus = await getNewsLikeStatus(article.id);
      
      userHasLiked = likeStatus.isLiked;
      likeCount = likeStatus.likeCount;
      console.log('NewsArticlePage: Like status fetched', { userHasLiked, likeCount });
    } catch (error) {
      console.log('NewsArticlePage: Error checking like status:', error);
      // Keep default values on error
    }
  }
  
  const categoryColors: Record<string, string> = {
    'platform-updates': 'bg-blue-100 text-blue-800',
    'partnerships': 'bg-green-100 text-green-800',
    'community': 'bg-purple-100 text-purple-800',
    'industry-news': 'bg-orange-100 text-orange-800',
    'events': 'bg-pink-100 text-pink-800',
    'announcements': 'bg-yellow-100 text-yellow-800',
    'press-releases': 'bg-indigo-100 text-indigo-800',
    'tutorials': 'bg-teal-100 text-teal-800',
    'other': 'bg-gray-100 text-gray-800',
  };

  return (
    <>
      {/* React 19 Native Document Metadata - Article-Specific */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={
        typeof article.seo?.keywords === 'string' 
          ? article.seo.keywords 
          : Array.isArray(article.seo?.keywords) 
            ? article.seo.keywords.join(', ')
            : article.tags.join(', ')
      } />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Article-specific OpenGraph data */}
      {article.featuredImage && <meta property="og:image" content={article.featuredImage} />}
      <meta property="article:published_time" content={publishedDate.toISOString()} />
      <meta property="article:author" content={article.authorName} />
      <meta property="article:section" content={article.category} />
      {article.tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {article.featuredImage && <meta name="twitter:image" content={article.featuredImage} />}
      
      {/* SEO optimization for news articles */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="news_keywords" content={article.tags.join(', ')} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* Article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article.title,
            "description": article.excerpt,
            "image": article.featuredImage || `https://ring.ck.ua/api/og/news/${article.slug}`,
            "author": {
              "@type": "Person",
              "name": article.authorName
            },
            "publisher": {
              "@type": "Organization",
              "name": "Ring Platform",
              "logo": {
                "@type": "ImageObject",
                "url": "https://ring.ck.ua/images/logo.png"
              }
            },
            "datePublished": publishedDate.toISOString(),
            "dateModified": article.updatedAt?.toDate().toISOString() || publishedDate.toISOString(),
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": canonicalUrl
            },
            "articleSection": article.category,
            "keywords": article.tags,
            "inLanguage": locale,
            "url": canonicalUrl
          })
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href={`/${locale}/news`}>
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {(translations as any).news?.backToNews || 'Back to News'}
            </Button>
          </Link>
        </div>

        {/* Article Header */}
        <article className="max-w-4xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge 
                variant="secondary" 
                className={categoryColors[article.category] || categoryColors.other}
              >
                {article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
              
              {article.featured && (
                <Badge variant="secondary" className="bg-yellow-500 text-white">
                  {(translations as any).news?.featured || 'Featured'}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold mb-4 leading-tight">
              {article.title}
            </h1>

            <p className="text-xl text-muted-foreground mb-6">
              {article.excerpt}
            </p>

            <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b">
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{(translations as any).news?.byAuthor || 'By'} {article.authorName}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(publishedDate, 'MMMM d, yyyy')}</span>
                  <span className="ml-1">
                    ({formatDistanceToNow(publishedDate, { addSuffix: true })})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{article.views}</span>
                </div>
                
                {/* Interactive Like Button */}
                <NewsLikeButton
                  targetId={article.id || ''}
                  initialLikeCount={likeCount}
                  initialIsLiked={userHasLiked}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-500"
                />
                
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{article.comments}</span>
                </div>
                
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  {(translations as any).news?.share || 'Share'}
                </Button>
              </div>
            </div>
          </header>

          {/* Featured Image */}
          {article.featuredImage && (
            <div className="mb-8">
              <div className="relative h-96 w-full overflow-hidden rounded-lg">
                <Image
                  src={article.featuredImage}
                  alt={article.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          )}

          {/* Article Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <div dangerouslySetInnerHTML={{ __html: article.content }} />
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">
                {(translations as any).news?.tags || 'Tags'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {article.gallery && article.gallery.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">
                {(translations as any).news?.gallery || 'Gallery'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {article.gallery.map((image, index) => (
                  <div key={index} className="relative h-48 overflow-hidden rounded-lg">
                    <Image
                      src={image}
                      alt={`Gallery image ${index + 1}`}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="max-w-6xl mx-auto mt-16">
            <h2 className="text-2xl font-semibold mb-6">
              {(translations as any).news?.relatedArticles || 'Related Articles'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map((relatedArticle) => (
                <Card key={relatedArticle.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <Badge 
                      variant="secondary" 
                      className={`${categoryColors[relatedArticle.category] || categoryColors.other} mb-3`}
                    >
                      {relatedArticle.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    
                    <Link href={`/${locale}/news/${relatedArticle.slug}`}>
                      <h3 className="font-semibold mb-2 hover:text-primary transition-colors line-clamp-2">
                        {relatedArticle.title}
                      </h3>
                    </Link>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                      {relatedArticle.excerpt}
                    </p>
                    
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(relatedArticle.publishedAt?.toDate() || relatedArticle.createdAt.toDate(), { addSuffix: true })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Article-specific metadata: Dynamic title, description, and SEO optimization
 * - NewsArticle structured data: Native <script> tag with JSON-LD for news SEO
 * - Advanced OpenGraph: Article metadata, publishing dates, author information
 * - Twitter Cards: Enhanced with article imagery and content
 * - News SEO: Special news_keywords meta tag for Google News
 * - Preserved all content rendering, interactions, and user experience
 */ 