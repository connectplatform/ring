import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Globe } from 'lucide-react'
import { TwitterIcon } from '@/components/ui/icons/twitter-icon'
import { LinkedinIcon } from '@/components/ui/icons/linkedin-icon'
import { getNewsAuthorProfile } from '@/features/news/services/get-news-author-profile'
import { getMyArticles } from '@/features/news/services/news-service'

/**
 * React 19 Server Component — Author Bio Card
 *
 * Design (per React 19 Specialist truth lens):
 * - Async Server Component: direct data access, zero client JS for display
 * - `cache()`-wrapped services: request deduplication via React.cache()
 * - Promise.all parallelism: fetch profile + article count concurrently
 * - NOT a client component: no `use()` hook needed (that's for Client Components).
 *   Server Components use native async/await — the correct React 19 pattern.
 */

interface AuthorBioCardProps {
  authorId: string
  authorName: string
  locale: string
  translations: {
    news: {
      authorBio: string
      articles: string
      joined: string
    }
  }
}

/** Extract initials from a name string for Avatar fallback. */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export async function AuthorBioCard({
  authorId,
  authorName,
  locale,
  translations,
}: AuthorBioCardProps) {
  // Parallel data fetching: React 19 pattern — both services use cache()
  // for automatic request deduplication within the same render pass.
  const [authorProfile, articlesResult] = await Promise.all([
    getNewsAuthorProfile(authorId),
    getMyArticles(authorId, { status: 'published' }),
  ])

  // Prepare author bio data with safe fallbacks
  const authorBio = {
    name: authorProfile?.name ?? authorName,
    avatar: authorProfile?.photoURL ?? null,
    bio: authorProfile?.bio ?? translations?.news?.authorBio,
    role: authorProfile?.role ?? 'member',
    socialLinks: {
      twitter: authorProfile?.socialLinks?.twitter ?? null,
      linkedin: authorProfile?.socialLinks?.linkedin ?? null,
      website: authorProfile?.socialLinks?.website ?? null,
    },
    articleCount: articlesResult?.stats?.publishedArticles ?? 0,
    joinedDate: authorProfile?.createdAt,
  }

  // Render author bio card
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar (either photoURL or initials): */}
          <Avatar
            src={authorBio.avatar}
            alt={authorBio.name}
            size="lg"
            fallback={getInitials(authorBio.name)}
            className="bg-primary/10 text-primary font-semibold"
          />

          <div className="flex-1 min-w-0">
            {/* Display Author's Name and Role badge */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{authorBio.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {authorBio.role}
              </Badge>
            </div>

            {/* Short Author Bio */}
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {authorBio.bio}
            </p>

            {/* Article count and join date, formatted for i18n */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>
                {authorBio.articleCount}{' '}
                {translations?.news?.articles || 'articles'}
              </span>
              {authorBio.joinedDate && (
                <span>
                  {translations?.news?.joined || 'Joined'}{' '}
                  {authorBio.joinedDate.toLocaleDateString(
                    // Locale handling: uk-UA, ru-RU, or fallback to en-US
                    locale === 'uk'
                      ? 'uk-UA'
                      : locale === 'ru'
                        ? 'ru-RU'
                        : 'en-US',
                    { year: 'numeric', month: 'long' },
                  )}
                </span>
              )}
            </div>

            {/* Social Media Links (conditionally rendered, as defined in profile) */}
            <div className="flex items-center gap-2">
              {authorBio.socialLinks.twitter && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://twitter.com/${authorBio.socialLinks.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitterIcon className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {authorBio.socialLinks.linkedin && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={authorBio.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkedinIcon className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {authorBio.socialLinks.website && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={authorBio.socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
