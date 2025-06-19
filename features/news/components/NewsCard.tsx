'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { NewsArticle } from '@/features/news/types';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Eye, Heart, MessageCircle, Calendar, User } from 'lucide-react';

interface NewsCardProps {
  article: NewsArticle;
  showExcerpt?: boolean;
  showStats?: boolean;
  className?: string;
  locale?: string;
}

export function NewsCard({ 
  article, 
  showExcerpt = true, 
  showStats = true,
  className = '',
  locale = 'en'
}: NewsCardProps) {
  const publishedDate = article.publishedAt?.toDate() || article.createdAt.toDate();
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
    <Card className={`group hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader className="p-0">
        {article.featuredImage && (
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
            <Image
              src={article.featuredImage}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {article.featured && (
              <div className="absolute top-3 left-3">
                <Badge variant="secondary" className="bg-yellow-500 text-white">
                  Featured
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge 
            variant="secondary" 
            className={categoryColors[article.category] || categoryColors.other}
          >
            {article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {formatDistanceToNow(publishedDate, { addSuffix: true })}
          </div>
        </div>

        <Link href={`/${locale}/news/${article.slug}`} className="block group">
          <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </h3>
        </Link>

        {showExcerpt && (
          <p className="text-muted-foreground mb-4 line-clamp-3">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <User className="h-3 w-3 mr-1" />
          <span>By {article.authorName}</span>
        </div>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {article.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {article.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{article.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      {showStats && (
        <CardFooter className="px-6 py-3 bg-muted/50 border-t">
          <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{article.views}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                <span>{article.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                <span>{article.comments}</span>
              </div>
            </div>
            
            <Link 
              href={`/${locale}/news/${article.slug}`}
              className="text-primary hover:underline font-medium"
            >
              Read more →
            </Link>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}