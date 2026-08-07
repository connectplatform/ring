// Import core React and Next.js modules; these are mostly server safe.
// TODO: If React 19 and Next.js 16 are fully available in the project, prefer the following:
//   - Use `useParams()` from 'next/navigation' instead of passing params via props in server components.
//   - Use `useSearchParams()` for query handling (filter/sort/pagination) instead of props.searchParams.
//   - Replace imperative data fetching with suspense-enabled `use()` as needed.
import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { connection } from 'next/server'
import { LocalePageProps } from '@/utils/page-props'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { getUserByUsername } from '@/features/auth/services/get-user-by-username'
import { getMyArticles } from '@/features/news/services/news-service'
import { AuthorBioCard } from '@/features/news/components/author-bio-card'
import { NewsCard } from '@/features/news/components/news-card'
import { NewsArticle } from '@/features/news/types'
import {
  canViewNewsArticle,
  NewsVisibilityContext,
} from '@/features/news/lib/news-visibility-filter'
import { UserRolesArray } from '@/features/auth/user-role'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { hasRoleAtLeast } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
// (Removed unused imports: Image, db, mapNewsDocument, Badge, Card, CardContent, buildNewsVisibilityFilters)
//      ^ TODO: Clean up unused imports for smaller bundles and improved clarity

// Type definition for expected route parameters
interface NewsAuthorPageParams {
  locale: string;
  username: string;
}

// Helper: Safely convert various date-like values to JS Date object
// STUB: Only needed if DB returns ambiguous date objects (e.g., Firestore Timestamp). If DB always returns Date, remove.
// TODO: Analyze DB response and remove this function if unnecessary.
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
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

// --- SEO/OG Metadata Generator ---
// Generates metadata for the author page for better search/social preview.
// TODO: In Next.js 16+, export `generateMetadata` at the top level and refactor params parsing for native support.
// TODO: Change param destructuring to work directly with `{ params }` object instead of destructuring a Promise.
export async function generateMetadata({
  params
}: {
  params: Promise<NewsAuthorPageParams>
}): Promise<Metadata> {
  await connection(); // Ensure database connection before fetching metadata

  // Await and extract route params
  // TODO: In Next.js 16, destructure params natively instead of as a Promise.
  const { locale, username } = await params;

  // Validate locale or fallback to default
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  // Fetch user (author) by username from DB
  const user = await getUserByUsername(username);

  // If user doesn't exist, return simple fallback meta
  if (!user) {
    return {
      title: 'Author Not Found',
    };
  }

  // Prefer full display name, fallback to username, then slug
  const displayName = user.name ?? user.username ?? username;

  // Fetch translations for news module in current locale
  // Canonical news namespace is top-level `news` (locales/.../modules/news.json)
  const t = await getTranslations({ locale: validLocale, namespace: 'news' });

  // Build SEO and OpenGraph properties
  return {
    title: `${displayName} — ${t('title')}`,
    description: `${t('byAuthor')} ${displayName} — ${t('description')}`,
    openGraph: {
      title: `${displayName} — News`,
      description: user.bio ?? `${t('byAuthor')} ${displayName}`,
      type: 'profile',
      locale: validLocale === 'uk' ? 'uk_UA' : 'en_US',
      images: user.photoURL ? [{ url: user.photoURL }] : [],
    },
  }
}

// --- Main Author Page Server Component ---
// TODO: With React 19/Next.js 16, refactor this to leverage `useParams` and `useSearchParams` hooks for native param access.
// TODO: Replace imperative data-fetching with `use()` for suspense streaming if possible.
export default async function NewsAuthorPage(
  props: LocalePageProps<NewsAuthorPageParams>
) {
  await connection(); // Always connect to DB in server context

  // -- Parse route/static params --
  // TODO: Switch to native `const { locale, username } = useParams()` when stable.
  const params = await props.params;
  const { locale, username } = params;

  // -- STUB: Will use for filtering/sorting in future --
  //      When adding filters/sorting/pagination, switch to `useSearchParams()` from 'next/navigation' instead.
  //      (Current usage is just a placeholder, doesn't affect UI.)
  //      Step-by-step:
  //        1. Swap `props.searchParams` for native hook.
  //        2. Integrate param parsing and pass to queries.
  const searchParams = await props.searchParams; // STUB: Not currently in use.

  // -- Locale validation --
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  // -- Load translations for labels/UI --
  // Canonical news namespace is top-level `news` (locales/.../modules/news.json)
  const t = await getTranslations({ locale: validLocale, namespace: 'news' });
  
  // Fallback translation getter: always returns a string, even on missing translation keys.
  // TODO: If next-intl supports a clear fallback, replace try/catch pattern with official fallback mechanism for stricter i18n hygiene.
  const tr = (key: string, fallback: string) => {
    try {
      return t(key as any)
    } catch {
      return fallback
    }
  }

  // -- Session and permissions --
  // Fetch session (if visitor is logged in). Affects which articles are visible.
  const session = await auth();

  // Determine current user's role (at least 'visitor').
  // TODO: User role logic strictly compares or advances permission based on their session role.
  const userRole =
    session?.user
      ? hasRoleAtLeast(
          session.user.role as UserRolesArray,
          UserRolesArray.visitor as UserRolesArray
        )
      : (UserRolesArray.visitor as UserRolesArray);

  // -- Core data fetch: get the author profile --
  // TODO: Optimize with use() for React Server Components when available (eliminates waterfall and improves TTFB).
  const author = await getUserByUsername(username);

  // 404 if author not found; cuts SSR short if so
  if (!author) {
    return notFound(); // Next.js native 404 handling
  }

  // -- Fetch author's latest published news articles (limit to 50 for perf) --
  // TODO: Use streaming/suspense (via use()) when upgrading to React 19/Next.js 16 for optimal hydration and progressive rendering.
  const articlesResult = await getMyArticles(author.id, {
    status: 'published',
    limit: 50,
    // STUB: In future, add query params for full filter/pagination support here.
  });

  // If author has published no articles, default to empty array so UI stays robust
  let articles: NewsArticle[] = articlesResult.data ?? [];

  // Setup context: permission info for RBAC/news filtering (author id and user role)
  const visibilityCtx: NewsVisibilityContext = {
    userRole: userRole as UserRolesArray,
    userId: session?.user?.id,
  };

  // Filter articles according to what this user is allowed to view
  // TODO: If this filter is computationally heavy at scale, move filtering into DB query instead of JS.
  articles = articles.filter((article) =>
    canViewNewsArticle(article, visibilityCtx),
  );

  // -- Sidebar bios/author info block with author name, bio, and join date --
  // Translates labels for name, articles, and "joined" date with locale fallback.
  const authorBioSidebar = (
    <div className="space-y-6">
      <AuthorBioCard
        authorId={author.id}
        authorName={author.name ?? author.username ?? username}
        locale={validLocale}
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
  );

  // === Main Render: Layout, header, and article grid/empty state ===
  return (
    <RingRightRailLayout
      rightRailPurpose="generic"
      rightRailContent={[
        { blockType: 'author-bio', i18nKey: 'news.authorBio' },
      ]}
      rightRail={authorBioSidebar}
      railWidth={320}
      flushCenterPane
    >
      <DavinciCenterPane
        header={
          // Sticky header: Name, article count, back nav
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                {tr('articles', 'Articles')} by {author.name ?? username}
              </h2>
              <p className="text-muted-foreground mt-1">
                {articles.length} {articles.length === 1 ? 'article' : 'articles'} published
              </p>
            </div>
            <Link
              href={ROUTES.NEWS(validLocale)}
              className="text-sm text-primary hover:underline"
            >
              &larr; {t('backToNews')}
            </Link>
          </div>
        }
      >
        {articles.length > 0 ? (
          // Published articles available: responsive grid of NewsCard components
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {articles.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                locale={validLocale}
              />
            ))}
          </div>
        ) : (
          // Empty state: Show friendly message if author has no content
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              {tr('noArticles', 'No articles yet')}
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              {tr(
                'noArticlesDescription',
                'This author has not published any articles yet.'
              )}
            </p>
          </div>
        )}
      </DavinciCenterPane>
    </RingRightRailLayout>
  );
}
