'use client'

/**
 * MY NEWS RAIL — title + author context live in the right sidebar
 * (center pane is charts + article list, matching admin/dao layout).
 */

import React, { useCallback, useState } from 'react'
import {
  FileText,
  Eye,
  Heart,
  MessageSquare,
  ExternalLink,
  Link2,
  Check,
  UserRoundPen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Link, toAppHref } from '@/i18n/routing'

export interface MyNewsRailStats {
  totalArticles: number
  totalViews: number
  totalLikes: number
  totalComments: number
}

export interface MyNewsRailProps {
  locale: Locale
  title: string
  description: string
  userName: string
  /** Public handle without @ — routes via /[username] blog space. */
  blogUsername?: string | null
  /** Absolute origin (no trailing slash), e.g. https://ring-platform.org */
  siteBaseUrl?: string
  stats?: MyNewsRailStats | null
  onNavigate?: () => void
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export function MyNewsRail({
  locale,
  title,
  description,
  userName,
  blogUsername,
  siteBaseUrl = '',
  stats,
  onNavigate,
}: MyNewsRailProps) {
  const handle = blogUsername?.replace(/^@/, '').trim() || ''
  const blogPath = handle ? ROUTES.PUBLIC_PROFILE(handle, locale) : null
  const authorListingHref = handle ? ROUTES.NEWS_AUTHOR(handle, locale) : null
  const absoluteBlogUrl =
    blogPath && siteBaseUrl
      ? `${stripTrailingSlash(siteBaseUrl)}${blogPath.startsWith('/') ? blogPath : `/${blogPath}`}`
      : blogPath

  const [copied, setCopied] = useState(false)

  const shareLink = useCallback(async () => {
    if (!absoluteBlogUrl) return
    try {
      await navigator.clipboard.writeText(absoluteBlogUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers / insecure contexts
      window.prompt('Copy blog link:', absoluteBlogUrl)
    }
  }, [absoluteBlogUrl])

  return (
    <div className="space-y-6">
      <div className="space-y-2 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">{userName}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My blog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {handle && blogPath ? (
            <>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Public blog URL</p>
                <p className="break-all font-mono text-sm text-foreground">
                  {absoluteBlogUrl || blogPath}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Articles publish as /{handle}/[slug]
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" onClick={shareLink}>
                  {copied ? (
                    <Check className="mr-2 h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Link2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? 'Link copied' : 'Share link'}
                </Button>
                <Button asChild variant="outline" size="sm" onClick={onNavigate}>
                  <Link href={toAppHref(blogPath)}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Open profile blog
                  </Link>
                </Button>
                {authorListingHref ? (
                  <Button asChild variant="ghost" size="sm" onClick={onNavigate}>
                    <Link href={toAppHref(authorListingHref)}>
                      Author articles
                    </Link>
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Set a username in your profile to publish under /[username]/[slug].
              </p>
              <Button asChild variant="outline" size="sm" onClick={onNavigate}>
                <Link href={toAppHref(ROUTES.PROFILE(locale))}>
                  <UserRoundPen className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Set username
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {stats ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">At a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden />
                Articles
              </span>
              <span className="font-medium tabular-nums">{stats.totalArticles}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" aria-hidden />
                Views
              </span>
              <span className="font-medium tabular-nums">{stats.totalViews.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" aria-hidden />
                Likes
              </span>
              <span className="font-medium tabular-nums">{stats.totalLikes.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" aria-hidden />
                Comments
              </span>
              <span className="font-medium tabular-nums">{stats.totalComments.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button asChild className="w-full" onClick={onNavigate}>
        <Link href={toAppHref(ROUTES.NEWS_CREATE(locale))}>
          Create article
        </Link>
      </Button>
    </div>
  )
}
