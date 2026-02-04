'use client'

/**
 * NEWS ARTICLE PAGE WRAPPER - Ring Platform v2.0
 * ==============================================
 * Standardized 3-column responsive layout for news article pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Related Articles
 * - Share Options
 * - Newsletter CTA
 * - Categories
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - Content Strategy Expert (article engagement)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Newspaper,
  Share2,
  Mail,
  Tag,
  ExternalLink,
  MessageCircle,
  ThumbsUp,
  Twitter,
  Facebook,
  Linkedin,
  Copy,
  Calendar,
  User,
  Eye
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface NewsArticleWrapperProps {
  children: React.ReactNode
  locale: string
  articleSlug?: string
  articleData?: {
    title?: string
    excerpt?: string
    category?: string
    tags?: string[]
    views?: number
    likes?: number
  }
}

export default function NewsArticleWrapper({
  children,
  locale,
  articleSlug,
  articleData
}: NewsArticleWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.news')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [emailSubscribed, setEmailSubscribed] = useState(false)
  const [newsletterEmail, setNewsletterEmail] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock related articles (will be dynamic later)
  const relatedArticles = [
    {
      id: '1',
      title: 'Platform Updates: New Features Released',
      category: 'platform-updates',
      publishedAt: '2 days ago',
      views: 1250,
      likes: 89
    },
    {
      id: '2',
      title: 'Partnership Announcement: Strategic Alliance',
      category: 'partnerships',
      publishedAt: '1 week ago',
      views: 2100,
      likes: 156
    },
    {
      id: '3',
      title: 'Community Spotlight: Success Stories',
      category: 'community',
      publishedAt: '3 days ago',
      views: 890,
      likes: 67
    },
  ]

  // Mock categories
  const categories = [
    { id: 'platform-updates', name: 'Platform Updates', count: 24, color: 'bg-blue-100 text-blue-800' },
    { id: 'partnerships', name: 'Partnerships', count: 18, color: 'bg-green-100 text-green-800' },
    { id: 'community', name: 'Community', count: 32, color: 'bg-purple-100 text-purple-800' },
    { id: 'industry-news', name: 'Industry News', count: 15, color: 'bg-orange-100 text-orange-800' },
    { id: 'events', name: 'Events', count: 8, color: 'bg-pink-100 text-pink-800' },
    { id: 'announcements', name: 'Announcements', count: 12, color: 'bg-yellow-100 text-yellow-800' },
  ]

  const shareOptions = [
    {
      id: 'twitter',
      label: 'Twitter',
      icon: Twitter,
      color: 'hover:text-blue-500',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(articleData?.title || 'Check out this article')}&url=${encodeURIComponent(window?.location?.href || '')}`
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      color: 'hover:text-blue-600',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window?.location?.href || '')}`
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      icon: Linkedin,
      color: 'hover:text-blue-700',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window?.location?.href || '')}`
    },
    {
      id: 'copy',
      label: t('copyLink', { defaultValue: 'Copy Link' }),
      icon: Copy,
      color: 'hover:text-green-600',
      action: () => {
        navigator.clipboard.writeText(window.location.href)
        // TODO: Show toast notification
      }
    },
  ]

  const handleShare = (option: typeof shareOptions[0]) => {
    if (option.url) {
      window.open(option.url, '_blank', 'width=600,height=400')
    } else if (option.action) {
      option.action()
    }
    setRightSidebarOpen(false)
  }

  const handleNewsletterSubscribe = () => {
    if (newsletterEmail) {
      setEmailSubscribed(true)
      setNewsletterEmail('')
      // TODO: Implement actual newsletter subscription
      setTimeout(() => setEmailSubscribed(false), 3000)
    }
  }

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Share Article Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('shareArticle', { defaultValue: 'Share Article' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {shareOptions.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className={`w-full justify-start ${option.color}`}
              onClick={() => handleShare(option)}
            >
              <option.icon className="h-4 w-4 mr-2" />
              {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Newsletter CTA Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {t('newsletter', { defaultValue: 'Stay Updated' })}
          </CardTitle>
          <CardDescription>
            {t('newsletterDescription', { defaultValue: 'Get the latest news and updates delivered to your inbox.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!emailSubscribed ? (
            <>
              <Input
                type="email"
                placeholder={t('enterEmail', { defaultValue: 'Enter your email' })}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleNewsletterSubscribe}
                disabled={!newsletterEmail}
              >
                {t('subscribe', { defaultValue: 'Subscribe' })}
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium mb-2">
                {t('subscribed', { defaultValue: 'Successfully subscribed!' })}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('checkEmail', { defaultValue: 'Check your email for confirmation.' })}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {t('noSpam', { defaultValue: 'No spam, unsubscribe anytime.' })}
          </p>
        </CardContent>
      </Card>

      {/* Related Articles Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            {t('relatedArticles', { defaultValue: 'Related Articles' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {relatedArticles.map((article) => (
            <div
              key={article.id}
              className="cursor-pointer hover:bg-accent p-3 rounded-lg transition-colors"
              onClick={() => router.push(`/${locale}/news/${article.id}`)}
            >
              <h4 className="font-medium text-sm mb-2 line-clamp-2">
                {article.title}
              </h4>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{article.views}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{article.likes}</span>
                  </div>
                </div>
                <span>{article.publishedAt}</span>
              </div>
              <Badge
                variant="secondary"
                className={`text-xs mt-2 ${categories.find(c => c.id === article.category)?.color || 'bg-gray-100 text-gray-800'}`}
              >
                {categories.find(c => c.id === article.category)?.name || article.category}
              </Badge>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/news`)}
          >
            {t('viewAllArticles', { defaultValue: 'View All Articles' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Categories Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {t('categories', { defaultValue: 'Categories' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.id}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
              onClick={() => {
                router.push(`/${locale}/news?category=${category.id}`)
                setRightSidebarOpen(false)
              }}
            >
              <span>{category.name}</span>
              <Badge variant="secondary" className="text-xs">
                {category.count}
              </Badge>
            </button>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/news`)}
          >
            {t('viewAllCategories', { defaultValue: 'View All Categories' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Article Stats Card */}
      {articleData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('articleStats', { defaultValue: 'Article Stats' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('views', { defaultValue: 'Views' })}</span>
              <span className="font-medium">{articleData.views || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('likes', { defaultValue: 'Likes' })}</span>
              <span className="font-medium">{articleData.likes || 0}</span>
            </div>
            {articleData.tags && articleData.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">{t('tags', { defaultValue: 'Tags' })}</p>
                  <div className="flex flex-wrap gap-1">
                    {articleData.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        {/* Left Sidebar - Main Navigation (Desktop only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Article Info & Engagement (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar for right sidebar content */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}
