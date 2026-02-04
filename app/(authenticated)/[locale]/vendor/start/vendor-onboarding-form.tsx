'use client'

/**
 * Vendor Onboarding Form - Single Page (Emperor's Directive)
 * 
 * Simplified vendor registration with just 5 essential fields:
 * 1. Store Slug (auto-generated from name)
 * 2. Store Name
 * 3. Store Description
 * 4. Store Categories (multi-select)
 * 5. Store Logo (Vercel Blob upload)
 * 
 * Features:
 * - Agricultural glassmorphism theme
 * - React 19 useActionState
 * - Vercel Blob integration
 * - Real-time slug generation
 * - Form validation
 * - i18n support (en/uk/ru)
 */

import React, { useState, useEffect, useTransition } from 'react'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Store, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import StoreLogoUploader from '@/components/vendor/store-logo-uploader'
import CategoryMultiSelect from '@/components/vendor/category-multi-select'
import { createVendorStore } from '@/app/_actions/vendor-actions'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'

interface VendorOnboardingFormProps {
  locale: string
  translations?: any
}

// Helper function to generate slug from store name
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .slice(0, 50) // Max 50 chars
}

export default function VendorOnboardingForm({ locale, translations }: VendorOnboardingFormProps) {
  const t = useTranslations('vendor.onboarding')
  const tForm = useTranslations('vendor.onboarding.form')
  const tValidation = useTranslations('vendor.onboarding.validation')
  const tStartPage = translations?.vendor?.startPage || {}

  const [state, formAction, isPending] = useActionState(createVendorStore, null)

  // React 19 useTransition for non-blocking slug generation
  const [isSlugPending, startSlugTransition] = useTransition()

  // Form state
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [storeCategories, setStoreCategories] = useState<string[]>([])
  const [storeLogo, setStoreLogo] = useState<File | null>(null)
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(true)
  
  // Auto-generate slug from name (wrapped in useTransition for non-blocking updates)
  useEffect(() => {
    if (autoGenerateSlug && storeName) {
      startSlugTransition(() => {
        const generated = generateSlugFromName(storeName)
        setStoreSlug(generated)
      })
    }
  }, [storeName, autoGenerateSlug, startSlugTransition])

  const handleSlugChange = (value: string) => {
    setStoreSlug(value)
    setAutoGenerateSlug(false) // Disable auto-generation if user manually edits
  }

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <motion.div
        className="flex items-center justify-center space-x-4 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
            ✓
          </div>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Account</span>
        </div>
        <div className="w-12 h-px bg-border"></div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            2
          </div>
          <span className="text-sm font-medium text-foreground">Store Setup</span>
        </div>
        <div className="w-12 h-px bg-border"></div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">
            3
          </div>
          <span className="text-sm font-medium text-muted-foreground">Launch</span>
        </div>
      </motion.div>

      {/* Header */}
      <motion.div
        className="text-center space-y-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-lime-600 flex items-center justify-center shadow-xl">
            <Store className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
      </motion.div>

      {/* Main Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border shadow-lg">
          <CardHeader className="bg-gradient-to-br from-emerald-500/5 via-green-500/5 to-lime-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <CardTitle>{tForm('submit')}</CardTitle>
            </div>
            <CardDescription>
              Fill in the essential information to create your vendor store
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form action={formAction} className="space-y-6">
              {/* Hidden locale field */}
              <input type="hidden" name="locale" value={locale} />

              {/* Store Name */}
              <div className="space-y-2">
                <Label htmlFor="storeName" className="text-sm font-medium">
                  {tForm('storeName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="storeName"
                  name="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={tForm('storeNamePlaceholder')}
                  className="h-11"
                  disabled={isPending}
                  required
                />
                <p className="text-xs text-muted-foreground">{tForm('storeNameHint')}</p>
              </div>

              {/* Store Slug (auto-generated with manual override) */}
              <div className="space-y-2">
                <Label htmlFor="storeSlug" className="text-sm font-medium">
                  {tForm('storeSlug')} <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">greenfood.live/store/vendors/</span>
                  <Input
                    id="storeSlug"
                    name="storeSlug"
                    value={storeSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder={tForm('storeSlugPlaceholder')}
                    className="h-11 flex-1 font-mono"
                    disabled={isPending}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">{tForm('storeSlugHint')}</p>
              </div>

              {/* Store Description */}
              <div className="space-y-2">
                <Label htmlFor="storeDescription" className="text-sm font-medium">
                  {tForm('storeDescription')} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="storeDescription"
                  name="storeDescription"
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder={tForm('storeDescriptionPlaceholder')}
                  className="min-h-[120px] resize-y"
                  maxLength={500}
                  disabled={isPending}
                  required
                />
                <div className="flex items-center justify-between text-xs">
                  <p className="text-muted-foreground">{tForm('storeDescriptionHint')}</p>
                  <p className={cn(
                    "font-mono",
                    storeDescription.length > 450 ? "text-amber-600" : "text-muted-foreground"
                  )}>
                    {storeDescription.length}/500
                  </p>
                </div>
              </div>

              {/* Store Categories */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {tForm('storeCategories')} <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-3">{tForm('storeCategoriesHint')}</p>
                
                <CategoryMultiSelect
                  selectedCategories={storeCategories}
                  onCategoriesChange={setStoreCategories}
                  error={state?.error && storeCategories.length === 0 ? tValidation('categoriesRequired') : undefined}
                />
                
                {/* Hidden input for form submission */}
                <input type="hidden" name="storeCategories" value={JSON.stringify(storeCategories)} />
              </div>

              {/* Store Logo */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {tForm('storeLogo')}
                </Label>
                <StoreLogoUploader
                  onLogoChange={setStoreLogo}
                  error={state?.error && storeLogo ? tValidation('logoInvalidType') : undefined}
                />
                
                {/* Hidden file input for form submission */}
                {storeLogo && (
                  <input type="hidden" name="storeLogo" value="file-attached" />
                )}
              </div>

              {/* Error Display */}
              {state?.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-destructive/10 border border-destructive/30 rounded-lg p-4"
                >
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ {state.error}
                  </p>
                </motion.div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isPending || storeCategories.length === 0 || !storeName || !storeDescription}
                  className={cn(
                    "w-full h-12",
                    "bg-primary hover:bg-primary/90",
                    "text-primary-foreground font-semibold text-base",
                    "shadow-sm hover:shadow-md",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {tForm('submitting')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      {tForm('submit')}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>🌾</span>
                    <span>50+ Farms</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>⚡</span>
                    <span>Instant Activation</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🛡️</span>
                    <span>Secure Platform</span>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Benefits Section - Only show on mobile/tablet, hidden on desktop with right sidebar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid md:grid-cols-2 gap-4 lg:hidden"
      >
        <Card className="border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">AI Product Enrichment</h3>
                <p className="text-sm text-muted-foreground">
                  Upload photo + basic info, AI generates descriptions, tags, and recommendations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-lime-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Automated Settlements</h3>
                <p className="text-sm text-muted-foreground">
                  Sales automatically processed, commissions calculated, payouts scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🍃</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">DAAR Token Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Earn up to 25% bonus tokens for regenerative agriculture practices
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Trust Tier System</h3>
                <p className="text-sm text-muted-foreground">
                  Start at 20% commission, earn your way to 12% through quality and sales
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

