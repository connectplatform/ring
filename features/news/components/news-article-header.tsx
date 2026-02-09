'use client'

/**
 * NEWS ARTICLE HEADER - GreenFood.live DaVinci Class
 * ==================================================
 * Magnificent article header with animated visuals, professional typography,
 * and agricultural emerald theme. React 19 + Motion + Modern CSS.
 * 
 * Features:
 * - Animated category badge with spring physics
 * - Parallax featured image with blur overlay
 * - Animated metadata with staggered reveal
 * - Reading progress indicator (optional)
 * - Social share hover effects
 * - Accessibility: prefers-reduced-motion support
 * 
 * Strike Team:
 * - React Animated Visuals Guru (animations)
 * - UI/UX Optimization Agent (mobile excellence)
 * - React 19 Specialist (modern patterns)
 */

import React, { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import { 
  Calendar, 
  User, 
  Eye, 
  Clock, 
  ArrowLeft, 
  Share2, 
  Bookmark, 
  Heart,
  Sparkles
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface NewsArticleHeaderProps {
  article: {
    title: string
    excerpt?: string
    category: string
    featuredImage?: string
    authorName: string
    authorAvatar?: string
    publishedAt: Date
    views?: number
    likes?: number
    tags?: string[]
    featured?: boolean
  }
  locale: string
  readingTime: {
    text: string
    minutes: number
  }
  translations: {
    byAuthor?: string
    featured?: string
    backToNews?: string
    minRead?: string
  }
  userHasLiked?: boolean
  likeCount?: number
  showReadingProgress?: boolean
}

// =============================================================================
// CATEGORY CONFIGURATION - Agricultural GreenFood Theme
// =============================================================================

const categoryConfig: Record<string, { 
  gradient: string
  bgLight: string
  bgDark: string
  icon: string
  glow: string
}> = {
  'platform-updates': {
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-950/30',
    icon: '🚀',
    glow: 'shadow-blue-500/20'
  },
  'partnerships': {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/30',
    icon: '🤝',
    glow: 'shadow-emerald-500/20'
  },
  'community': {
    gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-950/30',
    icon: '👥',
    glow: 'shadow-purple-500/20'
  },
  'industry-news': {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    bgLight: 'bg-orange-50',
    bgDark: 'dark:bg-orange-950/30',
    icon: '📰',
    glow: 'shadow-orange-500/20'
  },
  'events': {
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    bgLight: 'bg-pink-50',
    bgDark: 'dark:bg-pink-950/30',
    icon: '🎉',
    glow: 'shadow-pink-500/20'
  },
  'announcements': {
    gradient: 'from-yellow-500 via-amber-500 to-orange-500',
    bgLight: 'bg-yellow-50',
    bgDark: 'dark:bg-yellow-950/30',
    icon: '📢',
    glow: 'shadow-yellow-500/20'
  },
  'press-releases': {
    gradient: 'from-indigo-500 via-blue-500 to-cyan-500',
    bgLight: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-950/30',
    icon: '📋',
    glow: 'shadow-indigo-500/20'
  },
  'tutorials': {
    gradient: 'from-teal-500 via-cyan-500 to-sky-500',
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-950/30',
    icon: '📚',
    glow: 'shadow-teal-500/20'
  },
  'other': {
    gradient: 'from-gray-500 via-slate-500 to-zinc-500',
    bgLight: 'bg-gray-50',
    bgDark: 'dark:bg-gray-950/30',
    icon: '📄',
    glow: 'shadow-gray-500/20'
  }
}

// =============================================================================
// ANIMATION VARIANTS - Spring Physics for Delight
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30
    }
  }
}

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -5 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 25
    }
  },
  hover: {
    scale: 1.05,
    rotate: 2,
    transition: { type: 'spring' as const, stiffness: 600, damping: 20 }
  }
}

const imageVariants = {
  hidden: { opacity: 0, scale: 1.1 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Animated Category Badge with Glow Effect
 */
const CategoryBadge: React.FC<{ category: string; featured?: boolean }> = ({ 
  category, 
  featured 
}) => {
  const config = categoryConfig[category] || categoryConfig.other
  const displayName = category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <motion.div
      variants={badgeVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="inline-flex items-center gap-2"
    >
      {/* Category Badge */}
      <div className={cn(
        'relative px-4 py-2 rounded-full',
        'bg-gradient-to-r',
        config.gradient,
        'shadow-lg',
        config.glow,
        'cursor-default select-none'
      )}>
        {/* Glow Effect */}
        <div className={cn(
          'absolute inset-0 rounded-full blur-xl opacity-30',
          'bg-gradient-to-r',
          config.gradient
        )} />
        
        {/* Content */}
        <div className="relative flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-sm font-semibold text-white tracking-wide">
            {displayName}
          </span>
        </div>
      </div>

      {/* Featured Badge */}
      <AnimatePresence>
        {featured && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.8 }}
            className={cn(
              'px-3 py-1.5 rounded-full',
              'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400',
              'shadow-lg shadow-yellow-500/20',
              'flex items-center gap-1.5'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Featured
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * Author Info with Avatar Animation
 */
const AuthorInfo: React.FC<{
  name: string
  avatar?: string
  date: Date
  byAuthor?: string
}> = ({ name, avatar, date, byAuthor = 'By' }) => {
  return (
    <motion.div 
      variants={itemVariants}
      className="flex items-center gap-4"
    >
      {/* Avatar with ring animation */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="relative"
      >
        {/* Animated ring */}
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          }}
          className={cn(
            'absolute -inset-1 rounded-full',
            'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400',
            'opacity-60 blur-sm'
          )}
        />
        
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-800">
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Author Details */}
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{byAuthor}</span>
        <span className="font-semibold text-foreground">{name}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Calendar className="w-3 h-3" />
          <span>{format(date, 'MMMM d, yyyy')}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Article Stats with Micro-animations
 */
const ArticleStats: React.FC<{
  views?: number
  likes?: number
  readingTime: { text: string; minutes: number }
  userHasLiked?: boolean
}> = ({ views = 0, likes = 0, readingTime, userHasLiked }) => {
  return (
    <motion.div 
      variants={itemVariants}
      className="flex items-center gap-4 flex-wrap"
    >
      {/* Reading Time - Most Important */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full',
          'bg-emerald-100 dark:bg-emerald-900/30',
          'text-emerald-700 dark:text-emerald-300'
        )}
      >
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">{readingTime.text}</span>
      </motion.div>

      {/* Views */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex items-center gap-1.5 text-muted-foreground"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm">{views.toLocaleString()}</span>
      </motion.div>

      {/* Likes */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'flex items-center gap-1.5 cursor-pointer transition-colors',
          userHasLiked 
            ? 'text-rose-500' 
            : 'text-muted-foreground hover:text-rose-400'
        )}
      >
        <Heart 
          className={cn(
            'w-4 h-4 transition-all',
            userHasLiked && 'fill-current'
          )} 
        />
        <span className="text-sm">{likes.toLocaleString()}</span>
      </motion.div>
    </motion.div>
  )
}

/**
 * Reading Progress Bar (Fixed at top on scroll)
 */
const ReadingProgressBar: React.FC<{ show?: boolean }> = ({ show = true }) => {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  if (!show) return null

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 z-50 origin-left"
      style={{ scaleX }}
    >
      <div className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-lg shadow-emerald-500/50" />
    </motion.div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const NewsArticleHeader: React.FC<NewsArticleHeaderProps> = ({
  article,
  locale,
  readingTime,
  translations,
  userHasLiked = false,
  likeCount,
  showReadingProgress = true
}) => {
  const headerRef = useRef<HTMLElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  
  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Parallax effect for image
  const { scrollYProgress } = useScroll({
    target: headerRef,
    offset: ['start start', 'end start']
  })
  
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.1])
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0.3, 0.7])

  const categoryConfig_ = categoryConfig[article.category] || categoryConfig.other

  return (
    <>
      {/* Reading Progress */}
      <ReadingProgressBar show={showReadingProgress && !prefersReducedMotion} />

      <motion.header
        ref={headerRef}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative"
      >
        {/* Featured Image Hero Section */}
        {article.featuredImage && (
          <div className="relative h-[50vh] min-h-[400px] max-h-[600px] -mx-4 md:-mx-6 lg:-mx-0 overflow-hidden rounded-none lg:rounded-2xl mb-8">
            {/* Parallax Image */}
            <motion.div
              style={{ 
                y: prefersReducedMotion ? 0 : imageY,
                scale: prefersReducedMotion ? 1 : imageScale
              }}
              className="absolute inset-0"
            >
              <Image
                src={article.featuredImage}
                alt={article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </motion.div>

            {/* Gradient Overlay */}
            <motion.div
              style={{ opacity: prefersReducedMotion ? 0.5 : overlayOpacity }}
              className={cn(
                'absolute inset-0',
                'bg-gradient-to-t from-black/80 via-black/40 to-transparent'
              )}
            />

            {/* Bottom Gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

            {/* Floating Category Badge on Image */}
            <div className="absolute top-6 left-6 z-10">
              <CategoryBadge 
                category={article.category} 
                featured={article.featured} 
              />
            </div>

            {/* Back Button on Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute top-6 right-6 z-10"
            >
              <Link href={`/${locale}/news`}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(
                    'backdrop-blur-md bg-white/10 hover:bg-white/20',
                    'border border-white/20 text-white',
                    'shadow-lg shadow-black/20'
                  )}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {translations.backToNews || 'Back to News'}
                </Button>
              </Link>
            </motion.div>

            {/* Title on Image (Desktop) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 hidden lg:block">
              <motion.h1
                variants={itemVariants}
                className={cn(
                  'text-4xl lg:text-5xl xl:text-6xl font-bold',
                  'text-white leading-tight',
                  'drop-shadow-2xl',
                  'max-w-4xl'
                )}
              >
                {article.title}
              </motion.h1>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className={cn(
          'relative z-10',
          !article.featuredImage && 'pt-6'
        )}>
          {/* Category Badge (if no image) */}
          {!article.featuredImage && (
            <div className="mb-6">
              <CategoryBadge 
                category={article.category} 
                featured={article.featured} 
              />
            </div>
          )}

          {/* Title (Mobile or no image) */}
          <motion.h1
            variants={itemVariants}
            className={cn(
              'text-3xl md:text-4xl lg:text-5xl font-bold',
              'leading-tight mb-6',
              'text-foreground',
              article.featuredImage ? 'lg:hidden' : ''
            )}
          >
            {article.title}
          </motion.h1>

          {/* Excerpt */}
          {article.excerpt && (
            <motion.p
              variants={itemVariants}
              className={cn(
                'text-lg md:text-xl',
                'text-muted-foreground',
                'leading-relaxed mb-8',
                'max-w-3xl',
                // Elegant typography
                'font-serif italic'
              )}
            >
              {article.excerpt}
            </motion.p>
          )}

          {/* Meta Information Row */}
          <motion.div
            variants={itemVariants}
            className={cn(
              'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6',
              'pb-8 border-b border-border/50'
            )}
          >
            {/* Author Info */}
            <AuthorInfo
              name={article.authorName}
              avatar={article.authorAvatar}
              date={article.publishedAt}
              byAuthor={translations.byAuthor}
            />

            {/* Stats */}
            <ArticleStats
              views={article.views}
              likes={likeCount ?? article.likes}
              readingTime={readingTime}
              userHasLiked={userHasLiked}
            />
          </motion.div>

          {/* Tags Row */}
          {article.tags && article.tags.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-2 mt-6"
            >
              {article.tags.slice(0, 5).map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm',
                    'bg-muted hover:bg-muted/80',
                    'text-muted-foreground hover:text-foreground',
                    'cursor-pointer transition-colors',
                    'border border-border/50'
                  )}
                >
                  #{tag}
                </motion.span>
              ))}
              {article.tags.length > 5 && (
                <span className="px-3 py-1 text-sm text-muted-foreground">
                  +{article.tags.length - 5} more
                </span>
              )}
            </motion.div>
          )}
        </div>
      </motion.header>
    </>
  )
}

export default NewsArticleHeader

