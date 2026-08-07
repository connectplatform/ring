// TODO: Switch to new React 19/Next 16 fetch() cache/streaming loading (parallelize fetches)
// TODO: Replace server fetches with new use() hook (React 19) for native parallel async SSR
// TODO: Consider splitting layout/article/actions/toc into React server components, leverage <Suspense> for loading skeleton
// TODO: Add loading/error boundaries for async SSR hydration and partial rendering
 
import React from 'react';
import { getRingSeoBranding, getSiteBaseUrl } from '@/lib/ring-config-core'
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/database';
import { mapNewsDocument } from '@/lib/news/map-news-document';
import { NewsArticle } from '@/features/news/types';
import { pickImageSrc } from '@/lib/file/media-asset';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, User, Eye, Heart, ArrowLeft, Share2, Clock } from 'lucide-react';
import { LocalePageProps } from '@/utils/page-props';
import type { Locale } from '@/i18n/shared';
import { routing } from '@/i18n/routing';
import { defaultLocale } from '@/i18n/shared';
import { getTranslations } from 'next-intl/server';
import NewsArticleWrapper from '@/components/wrappers/news-article-wrapper';
import { NewsLikeButton } from '@/features/interactions/components/like-button';
import { AuthorBioCard } from '@/features/news/components/author-bio-card';
import { SocialShare } from '@/features/news/components/social-share';
import { CommentsOverlayButton } from '@/components/comments/comments-overlay-button';
import { TableOfContents } from '@/features/news/components/table-of-contents';
import { NewsArticleHeader } from '@/features/news/components/news-article-header';
import { calculateReadingTimeWithImages } from '@/features/news/utils/reading-time';
import { auth } from '@/auth';
import { canViewNewsArticle, buildNewsVisibilityFilters } from '@/features/news/lib/news-visibility-filter';
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role';
import { after, connection } from 'next/server'
import { RegisterMoodPlayerElements } from '@/features/mood-player/components/register-mood-player-elements'
import { ReviseArticleButton } from '@/features/news/components/revise-article-button'
import {
  NewsMarkdownView,
  newsBodyHtmlForChrome,
} from '@/features/news/lib/news-markdown-view'

// --- Type for page params
interface NewsArticlePageParams {
  locale: string;
  slug: string;
}

// --- Helper: Build canonical url for SEO
function newsArticleCanonicalUrl(locale: Locale, slug: string): string {
  const base = getSiteBaseUrl();
  const path =
    locale === defaultLocale ? `/news/${slug}` : `/${locale}/news/${slug}`;
  return `${base}${path}`;
}

// --- Helper: Coerce/parse a "date" field to JS Date object
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  // Handle Firestore Timestamp objects and other ad-hoc formats
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

/**
 * Fetch a single article document by slug.
 * Server Component - native async/await (React 19)
 * Returns article or null if not found.
 */
async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  try {
    const result = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'slug', operator: '==', value: slug }],
      pagination: { limit: 1 },
    });

    if (!result.success || result.data.length === 0) {
      return null;
    }
    // Map database document to NewsArticle type
    return mapNewsDocument(result.data[0]);
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

/**
 * Fetch related articles (same category), hide current, filter by role/visibility.
 * Returns at most 3 related NewsArticles.
 */
async function getRelatedArticles(
  currentArticle: NewsArticle,
  userRole: UserRolesArray,
  userId?: string
): Promise<NewsArticle[]> {
  try {
    const result = await db().queryDocs({
      collection: 'news',
      filters: [
        { field: 'status', operator: '==', value: 'published' },
        { field: 'category', operator: '==', value: currentArticle.category },
        ...buildNewsVisibilityFilters(userRole), // Handles extra visibility logic
      ],
      orderBy: [{ field: 'publishedAt', direction: 'desc' }],
      pagination: { limit: 4 },
    });

    if (!result.success) {
      return [];
    }
    // Remove self and check canView permission, return up to 3
    return result.data
      .map((row) => mapNewsDocument(row))
      .filter((article) => article.id !== currentArticle.id)
      .filter((article) => canViewNewsArticle(article, { userRole, userId }))
      .slice(0, 3);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

/**
 * Generates dynamic metadata for page, for React Server Components (React 19), Next.js 16+.
 * Used to produce meta tags, SEO, OpenGraph, etc.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<NewsArticlePageParams>;
}): Promise<Metadata> {
  await connection(); // Opt-out of prerendering (Next.js 16+)

  // Await incoming params (promise shape for server components)
  const { locale, slug } = await params;
  // Validate locale
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  // Fetch article document
  const article = await getArticleBySlug(slug);
  const newsBrand = `${getRingSeoBranding().siteName} News`;

  // If not found, signal in the title
  if (!article) {
    return {
      title: `Article Not Found | ${newsBrand}`,
    };
  }

  // Compose title, description & canonical for SEO
  const title = `${article.title} | ${newsBrand}`;
  const description = article.excerpt || article.title;
  const canonicalUrl = newsArticleCanonicalUrl(validLocale, article.slug);

  // TODO: In Next.js 16/React 19, leverage the new metadata API
  // TODO: Use dynamic route segment metadata configs for SSG/ISR logic
  
  const ogImage = pickImageSrc(
    article.featuredImageAsset || article.featuredImage,
    'og',
  ) || article.seo?.ogImage;

  return {
    title,
    description,
    keywords: [
      ...article.tags,
      article.category.replace('-', ' '),
      'news',
      'articles',
      getRingSeoBranding().siteName,
    ],
    authors: [{ name: article.authorName }],
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      locale: validLocale === 'uk' ? 'uk_UA' : 'en_US',
      images: ogImage
        ? [{ url: ogImage, alt: article.title }]
        : [],
      publishedTime: toDate(article.publishedAt).toISOString(),
      modifiedTime: toDate(article.updatedAt ?? article.publishedAt).toISOString(),
      authors: [article.authorName],
      section: article.category,
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    other: {
      'article:published_time': toDate(article.publishedAt).toISOString(),
      'article:modified_time': toDate(article.updatedAt ?? article.publishedAt).toISOString(),
      'article:author': article.authorName,
      'article:section': article.category,
      'news_keywords': article.tags.join(', '),
    },
  };
}

// --- Main News Article Page export. Uses React 19 server components model.
export default async function NewsArticlePage(
  props: LocalePageProps<NewsArticlePageParams>
) {
  await connection(); // Opt-out of prerendering in Next.js 16+

  // Await and resolve params, searchParams
  const params = await props.params;
  const searchParams = await props.searchParams; // STUB: Not currently used. // TODO: Implement article deep link / anchor navigation if searchParams used.

  // Validate locale param, fallback to default if not in available locales
  const locale =
    routing.locales.includes(params.locale as Locale) ? params.locale : routing.defaultLocale;
  const { slug } = params;

  // Log (dev) for debugging SSR locale
  console.log('NewsArticlePage: Using locale', locale);

  // --- Translations: Load i18n for this language (async)
  const t = await getTranslations('news');
  // Provide translation fallback helper
  const tr = (key: string, fallback: string) => {
    try {
      return t(key as any);
    } catch {
      return fallback;
    }
  };

  // --- Auth (for like, access control, etc)
  const session = await auth();
  // Determine user role (visitor if not logged in)
  const userRole = session?.user
    ? assertKnownUserRole(session.user.role as UserRolesArray)
    : (UserRolesArray.visitor as UserRolesArray);

  // --- Fetch main article doc, handle errors
  const article = await getArticleBySlug(slug);

  // If article not found, trigger Next.js "not found" (404).
  if (!article) {
    return notFound(); // TODO: Consider custom error/404 page in future.
  }

  // --- Access control: enforce by canViewNewsArticle filter (based on role, etc)
  if (!canViewNewsArticle(article, { userRole, userId: session?.user?.id })) {
    return notFound();
  }

  // Record a page view without blocking the HTML response
  after(() => {
    void import('@/features/news/services/news-service').then(({ recordArticlePageView }) =>
      recordArticlePageView(article.id),
    )
  })

  // --- Compose derived values for rendering & SEO, etc
  const newsBrand = `${getRingSeoBranding().siteName} News`;
  // Respect custom SEO meta if present
  const title = article.seo?.metaTitle || `${article.title} | ${newsBrand}`;
  const description = article.seo?.metaDescription || article.excerpt;
  const canonicalUrl = newsArticleCanonicalUrl(locale as Locale, slug);
  const siteBase = getSiteBaseUrl();
  // Dates: fallback logic for draft-compat
  const publishedDate = toDate(article.publishedAt ?? article.createdAt);

  // --- Reading time / TOC chrome use post-render HTML (Markdown SSOT)
  const bodyHtmlForChrome = newsBodyHtmlForChrome(
    article.content || '',
    article.versions,
  );
  const readingTime = calculateReadingTimeWithImages(bodyHtmlForChrome);

  // --- Fetch Related Articles, excluding this one and checking visibility logic
  const relatedArticles = await getRelatedArticles(article, userRole, session?.user?.id);

  // --- Like state: check via service (client hydrates real values if JS is enabled)
  let userHasLiked = false;
  let likeCount = article.likes || 0;
  if (article.id) {
    try {
      // Dynamically import: avoid load if not needed (SSR)
      const { getNewsLikeStatus } = await import('@/features/news/services/get-news-like-status');
      const likeStatus = await getNewsLikeStatus(article.id);
      userHasLiked = likeStatus.isLiked;
      likeCount = likeStatus.likeCount;
      console.log('NewsArticlePage: Like status fetched', { userHasLiked, likeCount });
    } catch (error) {
      // Could show warning for analytics/debug in the future
      console.log('NewsArticlePage: Error checking like status:', error);
    }
  }

  // --- Category badge colors (Tailwind classes, fallback for unknown)
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

  // TODO: When React 19 fully released, potentially use React.Suspense and native "loading" (segment-level). Still SSR here.

  return (
    <>
      {/* 
        Inject NewsArticle schema.org structured data for SEO, validated by Google News, etc.
        This is only rendered on SSR, so is safe to output here.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article.title,
            "description": article.excerpt,
            "image": pickImageSrc(article.featuredImageAsset || article.featuredImage, 'og')
              || article.featuredImage
              || `${siteBase}/images/logo.png`,
            "author": {
              "@type": "Person",
              "name": article.authorName,
            },
            "publisher": {
              "@type": "Organization",
              "name": getRingSeoBranding().siteName,
              "logo": {
                "@type": "ImageObject",
                "url": `${siteBase}/images/logo.png`,
              },
            },
            "datePublished": publishedDate.toISOString(),
            "dateModified": toDate(article.updatedAt ?? article.publishedAt ?? article.createdAt).toISOString(),
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": canonicalUrl,
            },
            "articleSection": article.category,
            "keywords": article.tags,
            "inLanguage": locale,
            "url": canonicalUrl,
          }),
        }}
      />

      {/* 
        Main Page Wrapper: handles context & analytics (see NewsArticleWrapper) 
        TODO: In future, migrate context to React 19 context-provider server pattern if breaking changes land. 
      */}
      <NewsArticleWrapper
        locale={locale as Locale}
        articleSlug={slug}
        articleData={{
          id: article.id,
          title: article.title,
          excerpt: article.excerpt,
          category: article.category,
          tags: article.tags,
          views: article.views,
          likes: article.likes,
        }}
      >
        <div className="container mx-auto px-0 py-0">
          {/* 
            Custom News Article Header (title, meta, badges, reading time, author, etc).
            All translations pulled via t/tr above.
          */}
          <NewsArticleHeader
            article={{
              title: article.title,
              excerpt: article.excerpt,
              category: article.category,
              featuredImage: article.featuredImage,
              featuredImageAsset: article.featuredImageAsset,
              authorName: article.authorName,
              publishedAt: publishedDate,
              views: article.views,
              likes: likeCount,
              tags: article.tags,
              featured: article.featured,
            }}
            locale={locale as Locale}
            readingTime={readingTime}
            translations={{
              byAuthor: tr('byAuthor', 'By'),
              featured: tr('featured', 'Featured'),
              backToNews: tr('backToNews', 'Back to News'),
            }}
            blurDataUrl={article.featuredImageAsset?.derivatives?.blur}
            userHasLiked={userHasLiked}
            likeCount={likeCount}
            showReadingProgress={true} // TODO: Consider toggling via searchParams in future for A/B exp.
          />

          {/* 
            Layout: Main content with sidebar TOC in desktop.
            Uses CSS grid for responsive adaptive structure.
          */}
          <div className="max-w-7xl mx-auto mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
              {/* --------- MAIN ARTICLE COLUMN --------- */}
              <article className="min-w-0">
                {/* 
                  Interactive actions bar: Like, Comments, Social Sharing 
                  TODO: Migrate to a reusable UI section component if used elsewhere.
                */}
                <div className="flex flex-wrap items-center gap-4 mb-8 pb-4 border-b border-border/30">
                  {/* Like button, hydrated by NewsLikeButton (client component), SSR initial state */}
                  <NewsLikeButton
                    targetId={article.id || ''}
                    initialLikeCount={likeCount}
                    initialIsLiked={userHasLiked}
                    variant="outline"
                    size="sm"
                    className="hover:text-red-500 hover:border-red-500/50"
                  />
                  {/* Comments entry/counter */}
                  <CommentsOverlayButton
                    targetId={article.id || ''}
                    targetType="news"
                    initialCount={article.comments || 0}
                    className="text-sm text-muted-foreground"
                  />
                  <ReviseArticleButton
                    slug={article.slug}
                    locale={locale as Locale}
                    status={article.status}
                    authorId={article.authorId}
                  />
                  {/* Social sharing widget (copy link, share to social, etc) */}
                  <div className="ml-auto">
                    <SocialShare
                      title={article.title}
                      url={canonicalUrl}
                      description={article.excerpt}
                      hashtags={article.tags}
                    />
                  </div>
                </div>

                {/* Main article content — Markdown SSOT via NewsMarkdownView */}
                <div className="article-content prose prose-lg prose-slate max-w-none mb-8 font-serif leading-relaxed">
                  <RegisterMoodPlayerElements />
                  <NewsMarkdownView
                    content={article.content || ''}
                    versions={article.versions}
                    className="text-foreground"
                  />
                </div>

                {/* 
                  Print-friendly styles, add with a <style> tag for print scenario.
                  TODO: Extract to a dedicated CSS module and optimize with native Next.js CSS-in-JS support.
                */}
                <style
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
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
                `,
                  }}
                />

                {/* 
                  Tags display section: each tag as outline badge.
                  Only renders if tags exist.
                */}
                {article.tags.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3">
                      {tr('tags', 'Tags')}
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

                {/* 
                  Optional gallery preview (if .gallery present and not empty).
                  Renders grid of images.
                */}
                {article.gallery && article.gallery.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3">
                      {tr('gallery', 'Gallery')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {article.gallery.map((image, index) => {
                        const gallerySrc = pickImageSrc(image, 'card')
                        const galleryBlur = image.derivatives?.blur
                        return (
                        <div key={image.fileId || image.url || index} className="relative h-48 overflow-hidden rounded-lg">
                          <Image
                            src={gallerySrc}
                            alt={`Gallery image ${index + 1}`}
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-200"
                            placeholder={galleryBlur ? 'blur' : 'empty'}
                            blurDataURL={galleryBlur}
                          />
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 
                  Author bio component.
                  TODO: Enrich bio details from users collection if available in data model.
                  TODO: Consider React 19 async component for SSR user fetch if not SSR-blocking.
                */}
                <div className="mb-12">
                  <AuthorBioCard
                    authorId={article.authorId}
                    authorName={article.authorName}
                    locale={locale}
                    translations={{
                      news: {
                        authorBio: tr(
                          'authorBio',
                          'Content creator and contributor to Ring Platform news and updates.'
                        ),
                        articles: tr('articles', 'articles'),
                        joined: tr('joined', 'Joined'),
                      },
                    }}
                  />
                </div>
              </article>

              {/* --------- SIDEBAR TABLE OF CONTENTS COLUMN --------- */}
              <aside className="hidden lg:block">
                {/* Table of Contents widget (autogenerate from HTML headings) */}
                <TableOfContents content={bodyHtmlForChrome} />
              </aside>
            </div>

            {/* 
              Related Articles: 
              Shown if relatedArticles is non-empty array. Uses Card UI for each.
            */}
            {relatedArticles.length > 0 && (
              <div className="max-w-6xl mx-auto mt-16">
                <h2 className="text-2xl font-semibold mb-6">
                  {tr('relatedArticles', 'Related Articles')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedArticles.map((relatedArticle) => (
                    <Card
                      key={relatedArticle.id}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardContent className="p-6">
                        <Badge
                          variant="secondary"
                          className={`${
                            categoryColors[relatedArticle.category] || categoryColors.other
                          } mb-3`}
                        >
                          {/* Capitalize first letter of each word in category */}
                          {relatedArticle.category
                            .replace('-', ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
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
                          {formatDistanceToNow(
                            toDate(relatedArticle.publishedAt ?? relatedArticle.createdAt),
                            { addSuffix: true }
                          )}
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
 *
 */
