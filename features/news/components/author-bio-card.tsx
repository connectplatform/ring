import React from 'react'
import { NewsArticle } from '@/features/news/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Twitter, Linkedin, Globe } from 'lucide-react'
import Link from 'next/link'

interface AuthorBioCardProps {
  article: NewsArticle
  locale: string
  translations: any
}

export function AuthorBioCard({ article, locale, translations }: AuthorBioCardProps) {
  // This is a placeholder - in a real app, you'd fetch author profile data
  const authorBio = {
    name: article.authorName,
    avatar: null, // Would come from user profile
    bio: `${translations?.news?.authorBio || 'Content creator and contributor to Ring Platform news and updates.'}`,
    role: 'Contributor', // Would come from user profile
    socialLinks: {
      twitter: null,
      linkedin: null,
      website: null
    },
    articleCount: 1, // Would be calculated from database
    joinedDate: article.createdAt // Would come from user profile
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={authorBio.avatar}
            alt={authorBio.name}
            size="lg"
            fallback={getInitials(authorBio.name)}
            className="bg-primary/10 text-primary font-semibold"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{authorBio.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {authorBio.role}
              </Badge>
            </div>

            <p className="text-muted-foreground mb-4 leading-relaxed">
              {authorBio.bio}
            </p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>{authorBio.articleCount} {(translations?.news?.articles || 'articles')}</span>
              <span>
                {translations?.news?.joined || 'Joined'} {
                  new Date(authorBio.joinedDate instanceof Date ? authorBio.joinedDate : authorBio.joinedDate.toDate())
                    .toLocaleDateString(locale === 'uk' ? 'uk-UA' : locale === 'ru' ? 'ru-RU' : 'en-US', {
                      year: 'numeric',
                      month: 'long'
                    })
                }
              </span>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              {authorBio.socialLinks.twitter && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://twitter.com/${authorBio.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer">
                    <Twitter className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {authorBio.socialLinks.linkedin && (
                <Button variant="outline" size="sm" asChild>
                  <a href={authorBio.socialLinks.linkedin} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {authorBio.socialLinks.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={authorBio.socialLinks.website} target="_blank" rel="noopener noreferrer">
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
