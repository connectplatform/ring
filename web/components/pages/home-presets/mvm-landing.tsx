'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useLocale } from 'next-intl'
import { Session } from 'next-auth'
import { useOptionalStore } from '@/features/store/context'
import { ProductCard } from '@/features/store/components/product-card'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { 
  ShoppingBag, 
  Truck, 
  Shield, 
  Leaf, 
  ChevronRight,
  Star,
  Heart,
  Sparkles,
  TrendingUp,
  Zap,
  Award,
  Package,
  ArrowRight
} from 'lucide-react'
import type { Locale } from '@/i18n/shared'

interface HomeContentProps {
  session: Session | null
}

/**
 * MVM landing home preset — multi-vendor-marketplace e-commerce homepage (DaVinci Class UI).
 * Origin: GreenFood.live (iHerb/Wildberries style); preserved via `home.preset = "mvm-landing"`.
 *
 * Design: Glassmorphism 2025 (backdrop-blur + gradient overlays), spring micro-interactions,
 * emerald/green vertical theme, mobile-first.
 *
 * Locale: uk/ru use Cyrillic copy; en uses English. Category counts derive from live store products.
 */
const HomeContent: React.FC<HomeContentProps> = ({ session }) => {
  const locale = useLocale() as Locale
  const tCommon = useTranslations('common')
  const tPages = useTranslations('pages.home')
  const tStore = useTranslations('modules.store')
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const store = useOptionalStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = theme === 'system' ? resolvedTheme : theme
  const isDark = currentTheme === 'dark'

  /** Cyrillic locales — do not fall back to English on /ru. */
  const useCyrillic = locale === 'uk' || locale === 'ru'
  const isRu = locale === 'ru'

  const pick = (uk: string, ru: string, en: string) =>
    isRu ? ru : useCyrillic ? uk : en

  // Animation variants - DaVinci class micro-interactions
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 500, damping: 30 }
    }
  }

  const heroVariants: Variants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
  }

  // Get products from store
  const products = useMemo(() => {
    return store?.enhancedProducts || store?.products || []
  }, [store?.enhancedProducts, store?.products])

  // Featured products (first 8)
  const featuredProducts = useMemo(() => products.slice(0, 8), [products])
  
  // Trending products (deterministic slice — avoid Math.random hydration flicker)
  const trendingProducts = useMemo(() => {
    if (products.length <= 4) return products
    return products.slice(Math.max(0, products.length - 4))
  }, [products])

  // Categories for GreenFood.live - DaVinci styled
  const categories = useMemo(
    () => [
      { id: 'organic', nameUk: 'Органічні продукти', nameRu: 'Органические продукты', nameEn: 'Organic Products', icon: '🌱', gradient: 'from-emerald-500 via-green-500 to-teal-500' },
      { id: 'dairy', nameUk: 'Молочні продукти', nameRu: 'Молочные продукты', nameEn: 'Dairy Products', icon: '🥛', gradient: 'from-sky-400 via-blue-500 to-cyan-500' },
      { id: 'meat', nameUk: "М'ясо та птиця", nameRu: 'Мясо и птица', nameEn: 'Meat & Poultry', icon: '🥩', gradient: 'from-rose-500 via-red-500 to-pink-500' },
      { id: 'vegetables', nameUk: 'Овочі та зелень', nameRu: 'Овощи и зелень', nameEn: 'Vegetables & Greens', icon: '🥬', gradient: 'from-lime-500 via-green-500 to-emerald-500' },
      { id: 'fruits', nameUk: 'Фрукти та ягоди', nameRu: 'Фрукты и ягоды', nameEn: 'Fruits & Berries', icon: '🍎', gradient: 'from-orange-500 via-amber-500 to-yellow-500' },
      { id: 'honey', nameUk: 'Мед та бджільництво', nameRu: 'Мёд и пчеловодство', nameEn: 'Honey & Bee Products', icon: '🍯', gradient: 'from-amber-400 via-yellow-500 to-orange-400' },
      { id: 'grains', nameUk: 'Крупи та борошно', nameRu: 'Крупы и мука', nameEn: 'Grains & Flour', icon: '🌾', gradient: 'from-amber-600 via-yellow-600 to-orange-500' },
      { id: 'preserves', nameUk: 'Консервація', nameRu: 'Консервация', nameEn: 'Preserves', icon: '🫙', gradient: 'from-violet-500 via-purple-500 to-fuchsia-500' },
    ],
    [],
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      categories.map((c) => [c.id, 0]),
    )
    for (const product of products) {
      const raw = String(
        (product as { category?: string; categoryId?: string }).category ||
          (product as { categoryId?: string }).categoryId ||
          '',
      )
        .toLowerCase()
        .trim()
      if (!raw) continue
      if (raw in counts) {
        counts[raw] += 1
        continue
      }
      // Fuzzy: "organic honey" → honey / organic
      for (const id of Object.keys(counts)) {
        if (raw.includes(id)) {
          counts[id] += 1
          break
        }
      }
    }
    return counts
  }, [categories, products])

  // Trust badges - Glassmorphism styled
  const trustBadges = [
    { icon: Truck, titleUk: 'Безкоштовна доставка', titleRu: 'Бесплатная доставка', titleEn: 'Free Delivery', descUk: 'від 500₴', descRu: 'от 500₴', descEn: 'from 500₴', gradient: 'from-emerald-500/20 to-green-500/20' },
    { icon: Shield, titleUk: 'Гарантія якості', titleRu: 'Гарантия качества', titleEn: 'Quality Guarantee', descUk: '100% натуральне', descRu: '100% натуральное', descEn: '100% Natural', gradient: 'from-blue-500/20 to-cyan-500/20' },
    { icon: Leaf, titleUk: 'Еко-сертифікація', titleRu: 'Эко-сертификация', titleEn: 'Eco-Certified', descUk: 'Перевірені ферми', descRu: 'Проверенные фермы', descEn: 'Verified Farms', gradient: 'from-lime-500/20 to-green-500/20' },
    { icon: Award, titleUk: 'DAAR бонуси', titleRu: 'DAAR бонусы', titleEn: 'DAAR Rewards', descUk: 'Накопичуй токени', descRu: 'Копите токены', descEn: 'Earn Tokens', gradient: 'from-amber-500/20 to-yellow-500/20' },
  ]

  // Hero slides
  const [currentSlide, setCurrentSlide] = useState(0)
  const heroSlides = [
    {
      titleUk: 'Свіжі продукти з українських ферм',
      titleRu: 'Свежие продукты с украинских ферм',
      titleEn: 'Fresh Products from Ukrainian Farms',
      subtitleUk: 'Доставка прямо до дверей протягом 24 годин',
      subtitleRu: 'Доставка прямо к двери в течение 24 часов',
      subtitleEn: 'Delivered to Your Door Within 24 Hours',
      ctaUk: 'Замовити зараз',
      ctaRu: 'Заказать сейчас',
      ctaEn: 'Order Now',
      gradient: 'from-emerald-600 via-green-500 to-lime-400',
      accent: '🌿'
    },
    {
      titleUk: 'Органічні овочі та фрукти',
      titleRu: 'Органические овощи и фрукты',
      titleEn: 'Organic Vegetables & Fruits',
      subtitleUk: 'Без пестицидів та ГМО — тільки природа',
      subtitleRu: 'Без пестицидов и ГМО — только природа',
      subtitleEn: 'Pesticide & GMO Free — Pure Nature',
      ctaUk: 'Переглянути',
      ctaRu: 'Смотреть',
      ctaEn: 'Browse',
      gradient: 'from-green-600 via-emerald-500 to-teal-400',
      accent: '🥬'
    },
    {
      titleUk: 'Знижки до 30% на мед',
      titleRu: 'Скидки до 30% на мёд',
      titleEn: 'Up to 30% Off Honey',
      subtitleUk: 'Тільки цього тижня — встигни замовити!',
      subtitleRu: 'Только на этой неделе — успейте заказать!',
      subtitleEn: 'This Week Only — Order Now!',
      ctaUk: 'Скористатись',
      ctaRu: 'Купить',
      ctaEn: 'Shop Now',
      gradient: 'from-amber-500 via-yellow-500 to-orange-400',
      accent: '🍯'
    }
  ]

  // Auto-rotate hero slides (client-only)
  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [heroSlides.length])

  // Always paint landing (SSR + first paint). Do not gate on mounted —
  // a client hang previously left users on an infinite spinner.
  return (
    <motion.div
      variants={mounted ? containerVariants : undefined}
      initial={mounted ? 'hidden' : false}
      animate={mounted ? 'visible' : false}
      className="space-y-8 pb-12"
    >
      {/* Hero Banner Section - DaVinci Glassmorphism */}
      <motion.section variants={heroVariants} className="relative overflow-hidden rounded-3xl mx-2 md:mx-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative bg-gradient-to-br",
              heroSlides[currentSlide].gradient,
              "p-8 md:p-12 min-h-[300px] md:min-h-[360px] flex flex-col justify-center"
            )}
          >
            {/* Glassmorphism overlay */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
            
            {/* Animated decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -bottom-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div 
                className="absolute top-8 right-8 text-7xl md:text-9xl opacity-20 select-none"
                animate={{ 
                  rotate: [0, 10, -10, 0], 
                  scale: [1, 1.1, 1],
                  y: [0, -10, 0]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                {heroSlides[currentSlide].accent}
              </motion.div>
              
              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-white/30 rounded-full"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${30 + (i % 3) * 20}%`
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.3, 0.7, 0.3]
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.3
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-4"
              >
                <Sparkles className="w-4 h-4" />
                {pick('Нові надходження', 'Новые поступления', 'New Arrivals')}
              </motion.div>
              
              <motion.h1 
                className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 400 }}
              >
                {pick(
                  heroSlides[currentSlide].titleUk,
                  heroSlides[currentSlide].titleRu,
                  heroSlides[currentSlide].titleEn,
                )}
              </motion.h1>
              
              <motion.p 
                className="text-lg md:text-xl text-white/90 mb-8 max-w-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                {pick(
                  heroSlides[currentSlide].subtitleUk,
                  heroSlides[currentSlide].subtitleRu,
                  heroSlides[currentSlide].subtitleEn,
                )}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                <Link href={ROUTES.STORE(locale)}>
                  <motion.button
                    className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3.5 rounded-full font-semibold shadow-xl hover:shadow-2xl transition-shadow"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {pick(
                      heroSlides[currentSlide].ctaUk,
                      heroSlides[currentSlide].ctaRu,
                      heroSlides[currentSlide].ctaEn,
                    )}
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
                <Link href={`${ROUTES.STORE(locale)}?category=organic`}>
                  <motion.button
                    className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-6 py-3.5 rounded-full font-semibold border border-white/30 hover:bg-white/30 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Leaf className="w-5 h-5" />
                    {pick('Органіка', 'Органика', 'Organic')}
                  </motion.button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slide indicators - Glassmorphism style */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20 bg-black/20 backdrop-blur-sm px-3 py-2 rounded-full">
          {heroSlides.map((_, idx) => (
            <motion.button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                idx === currentSlide 
                  ? 'bg-white w-8' 
                  : 'bg-white/40 w-2 hover:bg-white/60'
              )}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>
      </motion.section>

      {/* Trust Badges - Glassmorphism Cards */}
      <motion.section variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3 px-2 md:px-0">
        {trustBadges.map((badge, idx) => (
          <motion.div
            key={badge.title}
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn(
              "relative group flex items-center gap-3 p-4",
              "bg-card/80 backdrop-blur-xl rounded-2xl",
              "border border-border/50 hover:border-primary/30",
              "shadow-sm hover:shadow-lg transition-all duration-300",
              "overflow-hidden"
            )}
          >
            {/* Gradient background on hover */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              badge.gradient
            )} />
            
            <motion.div 
              className="relative z-10 p-2.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl group-hover:from-primary/30 group-hover:to-primary/20 transition-colors"
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <badge.icon className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="relative z-10 min-w-0 flex-1">
              <div className="font-semibold text-sm truncate text-foreground">
                {pick(badge.titleUk, badge.titleRu, badge.titleEn)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {pick(badge.descUk, badge.descRu, badge.descEn)}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* Categories Section - DaVinci Grid */}
      <motion.section variants={itemVariants} className="px-2 md:px-0">
        <div className="flex items-center justify-between mb-6">
          <motion.h2 
            className="text-2xl font-bold flex items-center gap-3"
            whileHover={{ x: 4 }}
          >
            <motion.div
              className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-primary" />
            </motion.div>
            {pick('Категорії', 'Категории', 'Categories')}
          </motion.h2>
          <Link href={ROUTES.STORE(locale)}>
            <motion.span 
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
              whileHover={{ x: 4 }}
            >
              {pick('Всі категорії', 'Все категории', 'All Categories')}
              <ChevronRight className="w-4 h-4" />
            </motion.span>
          </Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              variants={itemVariants}
              custom={idx}
            >
              <Link href={`${ROUTES.STORE(locale)}?category=${cat.id}`}>
                <motion.div
                  className={cn(
                    "group relative p-5 rounded-2xl overflow-hidden",
                    "bg-card/80 backdrop-blur-xl border border-border/50",
                    "hover:border-transparent hover:shadow-xl",
                    "transition-all duration-300"
                  )}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Gradient background on hover */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    cat.gradient
                  )} />
                  
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                  />
                  
                  <div className="relative z-10">
                    <motion.div 
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4",
                        "bg-gradient-to-br shadow-lg",
                        cat.gradient,
                        "group-hover:shadow-xl group-hover:scale-110 transition-all duration-300"
                      )}
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      {cat.icon}
                    </motion.div>
                    <div className="font-semibold text-sm mb-1 group-hover:text-white transition-colors">
                      {pick(cat.nameUk, cat.nameRu, cat.nameEn)}
                    </div>
                    <div className="text-xs text-muted-foreground group-hover:text-white/80 transition-colors flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {categoryCounts[cat.id] ?? 0}{' '}
                      {pick('товарів', 'товаров', 'products')}
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Empty store — wire CTAs instead of fake catalog */}
      {products.length === 0 && (
        <motion.section variants={itemVariants} className="px-2 md:px-0">
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 text-center space-y-4">
            <h2 className="text-xl font-bold">
              {pick(
                'Каталог наповнюється',
                'Каталог наполняется',
                'Catalog is filling up',
              )}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {pick(
                'Живі товари з’являться після онбордингу продавців. Можете відкрити ринок або стати продавцем.',
                'Живые товары появятся после онбординга продавцов. Откройте рынок или станьте продавцом.',
                'Live products appear after vendor onboarding. Open the market or become a vendor.',
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={ROUTES.STORE(locale)}>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                  {pick('На ринок', 'На рынок', 'Go to market')}
                </span>
              </Link>
              <Link href={ROUTES.VENDOR_START(locale)}>
                <span className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
                  {pick('Стати продавцем', 'Стать продавцом', 'Become a vendor')}
                </span>
              </Link>
            </div>
          </div>
        </motion.section>
      )}

      {/* Featured Products - DaVinci Grid */}
      {featuredProducts.length > 0 && (
        <motion.section variants={itemVariants} className="px-2 md:px-0">
          <div className="flex items-center justify-between mb-6">
            <motion.h2 
              className="text-2xl font-bold flex items-center gap-3"
              whileHover={{ x: 4 }}
            >
              <motion.div
                className="p-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </motion.div>
              {pick('Популярні товари', 'Популярные товары', 'Featured Products')}
            </motion.h2>
            <Link href={ROUTES.STORE(locale)}>
              <motion.span 
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
                whileHover={{ x: 4 }}
              >
                {pick('Переглянути всі', 'Смотреть все', 'View All')}
                <ChevronRight className="w-4 h-4" />
              </motion.span>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                variants={itemVariants}
                custom={idx}
                whileHover={{ y: -4 }}
              >
                <ProductCard product={product} locale={locale} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Promotional Banner - DaVinci Glassmorphism */}
      <motion.section variants={itemVariants} className="px-2 md:px-0">
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500 p-8 md:p-10"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-white/5" />
          
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"
              animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"
              animate={{ scale: [1.3, 1, 1.3], rotate: [360, 180, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl opacity-10 select-none"
              animate={{ rotate: 360, scale: [1, 1.1, 1] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              🌿
            </motion.div>
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-3"
              >
                <Zap className="w-4 h-4" />
                {pick('Спеціальна пропозиція', 'Специальное предложение', 'Special Offer')}
              </motion.div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {pick('Приєднуйтесь до GreenFood!', 'Присоединяйтесь к GreenFood!', 'Join GreenFood!')}
              </h3>
              <p className="text-white/90 text-lg max-w-md">
                {pick(
                  'Отримайте 100 DAAR бонусів за першу покупку та ексклюзивні знижки',
                  'Получите 100 DAAR бонусов за первую покупку и эксклюзивные скидки',
                  'Get 100 DAAR bonus on your first purchase and exclusive discounts',
                )}
              </p>
            </div>
            <Link href={ROUTES.LOGIN(locale)}>
              <motion.button
                className="inline-flex items-center gap-3 bg-white text-emerald-700 px-8 py-4 rounded-full font-bold shadow-xl hover:shadow-2xl transition-shadow text-lg"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles className="w-5 h-5" />
                {pick('Зареєструватись', 'Зарегистрироваться', 'Sign Up')}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </motion.section>

      {/* Trending Products - DaVinci Grid */}
      {trendingProducts.length > 0 && (
        <motion.section variants={itemVariants} className="px-2 md:px-0">
          <div className="flex items-center justify-between mb-6">
            <motion.h2 
              className="text-2xl font-bold flex items-center gap-3"
              whileHover={{ x: 4 }}
            >
              <motion.div
                className="p-2 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Heart className="w-6 h-6 text-pink-500" />
              </motion.div>
              {pick('Вам може сподобатись', 'Вам может понравиться', 'You May Like')}
            </motion.h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trendingProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                variants={itemVariants}
                custom={idx}
                whileHover={{ y: -4 }}
              >
                <ProductCard product={product} locale={locale} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Welcome message for logged-in users - DaVinci Glassmorphism */}
      {session && (
        <motion.div
          variants={itemVariants}
          className="px-2 md:px-0"
        >
          <motion.div 
            className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20 backdrop-blur-xl"
            whileHover={{ scale: 1.01 }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
            
            <div className="relative z-10 flex items-center gap-4">
              <motion.div 
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Sparkles className="w-6 h-6 text-primary" />
              </motion.div>
              <div>
                <div className="font-bold text-lg">
                  {pick('Вітаємо', 'Добро пожаловать', 'Welcome')}, {session.user?.name || 'User'}! 👋
                </div>
                <div className="text-sm text-muted-foreground">
                  {pick(
                    'Раді бачити вас знову на GreenFood.live — ваш кошик чекає!',
                    'Рады видеть вас снова на GreenFood.live — ваша корзина ждёт!',
                    'Great to see you back at GreenFood.live — your cart awaits!',
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default HomeContent
