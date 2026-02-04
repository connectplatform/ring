'use client'

/**
 * Vendor CTA Card - Agricultural Glassmorphism Design
 * 
 * Displays "Become a Vendor" call-to-action in store right-sidebar
 * for authenticated users who are NOT vendors.
 * 
 * Features:
 * - Agricultural emerald/green theme with floating orbs
 * - Framer Motion entrance animation
 * - Benefits list with checkmarks
 * - Gradient CTA button
 * - Conditional rendering (non-vendors only)
 * 
 * Tech: React 19 + Framer Motion + Vercel Blob integration prep
 */

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import { Store, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'

interface VendorCTACardProps {
  className?: string
}

export default function VendorCTACard({ className }: VendorCTACardProps) {
  const { data: session } = useSession()
  const locale = useLocale() as Locale
  const t = useTranslations('modules.store')
  const [mounted, setMounted] = useState(false)
  const [isVendor, setIsVendor] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user is already a vendor
  useEffect(() => {
    async function checkVendorStatus() {
      if (!session?.user?.id) {
        setChecking(false)
        return
      }

      try {
        // Check if user has vendor entity
        const response = await fetch('/api/vendor/check-status')
        if (response.ok) {
          const data = await response.json()
          setIsVendor(data.isVendor || false)
        }
      } catch (error) {
        console.error('Error checking vendor status:', error)
      } finally {
        setChecking(false)
      }
    }

    checkVendorStatus()
  }, [session?.user?.id])

  // Don't render if:
  // - Not mounted (hydration)
  // - Not authenticated
  // - Already a vendor
  // - Still checking
  if (!mounted || !session?.user || isVendor || checking) {
    return null
  }

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-lime-500/10",
        "backdrop-blur-xl border border-emerald-500/20",
        "p-6 shadow-xl",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Floating orbs background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"
          animate={{
            x: [0, 15, 0],
            y: [0, -15, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-4 -left-4 w-24 h-24 bg-lime-500/20 rounded-full blur-2xl"
          animate={{
            x: [0, -15, 0],
            y: [0, 15, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Icon and title */}
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-lime-600 flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Store className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              🌾 Become a Vendor
            </h3>
            <p className="text-xs text-muted-foreground">
              Join the marketplace
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {t('filters.becomeVendorDescription')}
        </p>

        {/* Benefits list */}
        <ul className="text-xs space-y-2 mb-5">
          <motion.li
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 text-xs">✓</span>
            </div>
            <span>Reach thousands of customers</span>
          </motion.li>
          <motion.li
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3 text-emerald-600" />
            </div>
            <span>AI product enrichment</span>
          </motion.li>
          <motion.li
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            </div>
            <span>Automated settlements</span>
          </motion.li>
          <motion.li
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-emerald-600" />
            </div>
            <span>DAAR token rewards</span>
          </motion.li>
        </ul>

        {/* CTA Button */}
        <Link href={ROUTES.VENDOR_START(locale)}>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              className={cn(
                "w-full",
                "bg-gradient-to-r from-emerald-600 to-lime-600",
                "hover:from-emerald-700 hover:to-lime-700",
                "text-white font-semibold",
                "shadow-lg hover:shadow-xl",
                "transition-all duration-300"
              )}
              size="lg"
            >
              {t('filters.becomeVendor')}
            </Button>
          </motion.div>
        </Link>

        {/* Trust indicator */}
        <div className="mt-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            🛡️ Trusted by 50+ Ukrainian farms
          </p>
        </div>
      </div>

      {/* Shine effect on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  )
}

