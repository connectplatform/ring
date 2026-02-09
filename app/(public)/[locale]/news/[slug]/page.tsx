import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { NewsArticle } from '@/features/news/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow, format } from 'date-fns';
import { Calendar, User, Eye, Heart, MessageCircle, ArrowLeft, Share2, Clock } from 'lucide-react';
import { LocalePageProps } from '@/utils/page-props';
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config';
import NewsArticleWrapper from '@/components/wrappers/news-article-wrapper';
import { NewsLikeButton } from '@/features/interactions/components/like-button';
import { AuthorBioCard } from '@/features/news/components/author-bio-card';
import { SocialShare } from '@/features/news/components/social-share';
import { TableOfContents } from '@/features/news/components/table-of-contents';
import { NewsArticleHeader } from '@/features/news/components/news-article-header';
import { calculateReadingTimeWithImages } from '@/features/news/utils/reading-time';
import { auth } from '@/auth';
import { connection } from 'next/server'

interface NewsArticlePageParams {
  locale: string;
  slug: string;
}

/**
 * Get article by slug
 * Server Component - native async/await (React 19 pattern)
 */
async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 }
    });
    
    if (!result.success || result.data.length === 0) {
      return null;
    }
    
    return result.data[0] as any as NewsArticle;
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

/**
 * Get related articles
 * Server Component - native async/await (React 19 pattern)
 */
async function getRelatedArticles(currentArticle: NewsArticle): Promise<NewsArticle[]> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.query({
      collection: 'news',
      filters: [
        { field: 'status', operator: '==', value: 'published' },
        { field: 'category', operator: '==', value: currentArticle.category },
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit: 4 }
    });
    
    if (!result.success) {
      return []
    }
    
    return (result.data as any[] as NewsArticle[])
      .filter(article => article.id !== currentArticle.id)
      .slice(0, 3);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<NewsArticlePageParams>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale, slug } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;

  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: 'Article Not Found | Ring Platform News'
    };
  }

  const title = `${article.title} | Ring Platform News`;
  const description = article.excerpt || article.title;
  const canonicalUrl = `https://ring.ck.ua/${validLocale}/news/${article.slug}`;

  return {
    title,
    description,
    keywords: [
      ...article.tags,
      article.category.replace('-', ' '),
      'news',
      'articles',
      'Ring Platform'
    ],
    authors: [{ name: article.authorName }],
    alternates: generateHreflangAlternates(canonicalUrl),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      locale: validLocale === 'uk' ? 'uk_UA' : 'en_US',
      images: article.featuredImage ? [{ url: article.featuredImage, alt: article.title }] : [],
      publishedTime: article.publishedAt?.toDate().toISOString(),
      modifiedTime: article.updatedAt?.toDate().toISOString() || article.publishedAt?.toDate().toISOString(),
      authors: [article.authorName],
      section: article.category,
      tags: article.tags
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: article.featuredImage ? [article.featuredImage] : []
    },
    other: {
      'article:published_time': article.publishedAt?.toDate().toISOString(),
      'article:modified_time': article.updatedAt?.toDate().toISOString() || article.publishedAt?.toDate().toISOString(),
      'article:author': article.authorName,
      'article:section': article.category,
      'news_keywords': article.tags.join(', ')
    }
  };
}

export default async function NewsArticlePage(props: LocalePageProps<NewsArticlePageParams>) {
  await connection() // Next.js 16: opt out of prerendering

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

  // Calculate reading time
  const readingTime = calculateReadingTimeWithImages(article.content);

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

      <NewsArticleWrapper
        locale={locale}
        articleSlug={slug}
        articleData={{
          title: article.title,
          excerpt: article.excerpt,
          category: article.category,
          tags: article.tags,
          views: article.views,
          likes: article.likes
        }}
      >
        <div className="container mx-auto px-0 py-0">
        {/* 🎨 MAGNIFICENT ARTICLE HEADER - DaVinci Class */}
        <NewsArticleHeader
          article={{
            title: article.title,
            excerpt: article.excerpt,
            category: article.category,
            featuredImage: article.featuredImage,
            authorName: article.authorName,
            publishedAt: publishedDate,
            views: article.views,
            likes: likeCount,
            tags: article.tags,
            featured: article.featured
          }}
          locale={locale}
          readingTime={readingTime}
          translations={{
            byAuthor: (translations as any).news?.byAuthor,
            featured: (translations as any).news?.featured,
            backToNews: (translations as any).news?.backToNews
          }}
          userHasLiked={userHasLiked}
          likeCount={likeCount}
          showReadingProgress={true}
        />

        {/* Article Layout with Table of Contents */}
        <div className="max-w-7xl mx-auto mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            {/* Main Article Content */}
            <article className="min-w-0">
              {/* Interactive Actions Bar */}
              <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border/30">
                  {/* Interactive Like Button */}
                  <NewsLikeButton
                    targetId={article.id || ''}
                    initialLikeCount={likeCount}
                    initialIsLiked={userHasLiked}
                  variant="outline"
                    size="sm"
                  className="hover:text-red-500 hover:border-red-500/50"
                  />

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                  <span>{article.comments || 0} comments</span>
                  </div>

                  {/* Social Share Component */}
                <div className="ml-auto">
                  <SocialShare
                    title={article.title}
                    url={canonicalUrl}
                    description={article.excerpt}
                    hashtags={article.tags}
                    />
                  </div>
                </div>

              {/* Article Content with Professional Typography */}
              <div className="article-content prose prose-lg prose-slate max-w-none mb-8 font-serif leading-relaxed">
                <div
                  dangerouslySetInnerHTML={{ __html: article.content }}
                  className="text-foreground"
                />
              </div>

              {/* Print Styles */}
              <style dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    .article-content {
                      font-family: 'Times New Roman', serif;
                      line-height: 1.6;
                      color: black;
                    }
                    .article-content h1,
                    .article-content h2,
                    .article-content h3,
                    .article-content h4,
                    .article-content h5,
                    .article-content h6 {
                      page-break-after: avoid;
                      color: black;
                    }
                    .article-content p {
                      orphans: 3;
                      widows: 3;
                    }
                    .article-content img {
                      max-width: 100%;
                      height: auto;
                    }
                  }
                `
              }} />

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

              {/* Author Bio Card */}
              <div className="mb-12">
                <AuthorBioCard
                  article={article}
                  locale={locale}
                  translations={translations}
                />
              </div>
            </article>

            {/* Table of Contents - Sidebar */}
            <aside className="hidden lg:block">
              <TableOfContents content={article.content} />
            </aside>
          </div>

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
      </div>

      </NewsArticleWrapper>
    </>
  );
}

/* 
 * React 19 Native Features Used:
 * - Document metadata: Handled by generateMetadata() function
 * - Article-specific metadata: Dynamic title, description, and SEO optimization
 * - NewsArticle structured data: Native <script> tag with JSON-LD for news SEO
 * - Advanced OpenGraph: Article metadata, publishing dates, author information
 * - Twitter Cards: Enhanced with article imagery and content
 * - News SEO: Special news_keywords meta tag for Google News
 * - Preserved all content rendering, interactions, and user experience
 */
