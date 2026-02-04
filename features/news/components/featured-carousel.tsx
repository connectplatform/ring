'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { NewsArticle } from '@/features/news/types'
import { formatDistanceToNow } from 'date-fns'

interface FeaturedCarouselProps {
  articles: NewsArticle[]
  locale: string
  translations: any
}

export function FeaturedCarousel({ articles, locale, translations }: FeaturedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const featuredArticles = articles.filter(article => article.featured).slice(0, 5)

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || featuredArticles.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === featuredArticles.length - 1 ? 0 : prevIndex + 1
      )
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [currentIndex, isPlaying, featuredArticles.length])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const nextSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === featuredArticles.length - 1 ? 0 : prevIndex + 1
    )
  }

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? featuredArticles.length - 1 : prevIndex - 1
    )
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) {
      nextSlide()
    }
    if (isRightSwipe) {
      prevSlide()
    }
  }

  if (featuredArticles.length === 0) {
    return null
  }

  const currentArticle = featuredArticles[currentIndex]

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'platform-updates': 'bg-blue-500',
      'partnerships': 'bg-green-500',
      'community': 'bg-purple-500',
      'industry-news': 'bg-orange-500',
      'events': 'bg-pink-500',
      'announcements': 'bg-yellow-500',
      'press-releases': 'bg-indigo-500',
      'tutorials': 'bg-teal-500',
      'other': 'bg-gray-500',
    }
    return colors[category] || colors.other
  }

  return (
    <div className="relative mb-12 overflow-hidden rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5">
      {/* Main Carousel */}
      <div
        className="relative h-[400px] md:h-[500px] lg:h-[600px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {featuredArticles.map((article, index) => (
          <div
            key={article.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Background Image */}
            {article.featuredImage && (
              <div className="absolute inset-0">
                <Image
                  src={article.featuredImage}
                  alt={article.title}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}

            {/* Content Overlay */}
            <div className="relative h-full flex items-center">
              <div className="container mx-auto px-6">
                <div className="max-w-2xl text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={`${getCategoryColor(article.category)} text-white border-0`}>
                      {translations.news?.categories?.[article.category] ||
                       article.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      {translations.news?.featured || 'Featured'}
                    </Badge>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                    {article.title}
                  </h1>

                  <p className="text-lg md:text-xl mb-6 text-white/90 leading-relaxed line-clamp-3">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center gap-6 mb-6">
                    <span className="text-sm text-white/80">
                      {translations.news?.byAuthor || 'By'} {article.authorName}
                    </span>
                    <span className="text-sm text-white/80">
                      {article.publishedAt
                        ? formatDistanceToNow(
                            article.publishedAt instanceof Date ? article.publishedAt :
                            (article.publishedAt as any).toDate ? (article.publishedAt as any).toDate() :
                            new Date(article.publishedAt as any),
                            { addSuffix: true }
                          )
                        : formatDistanceToNow(
                            article.createdAt instanceof Date ? article.createdAt :
                            (article.createdAt as any).toDate ? (article.createdAt as any).toDate() :
                            new Date(article.createdAt as any),
                            { addSuffix: true }
                          )
                      }
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      asChild
                      size="lg"
                      className="bg-white text-black hover:bg-white/90 font-semibold"
                    >
                      <Link href={`/${locale}/news/${article.slug}`}>
                        {translations.news?.readMore || 'Read More'}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-white/30 text-white hover:bg-white/10"
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {featuredArticles.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white border-0"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white border-0"
            onClick={nextSlide}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Dots Indicator */}
      {featuredArticles.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {featuredArticles.map((_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white scale-125'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {featuredArticles.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full bg-white transition-all duration-500 ease-out"
            style={{
              width: `${((currentIndex + 1) / featuredArticles.length) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  )
}
