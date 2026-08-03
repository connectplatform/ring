'use client'

/**
 * Vendor onboarding form — DaVinci surfaces (no Card boundary).
 * Existing storefront URLs + Upload & Generate logo (FsModal + gallery strip).
 */

import React, { useState, useEffect, useTransition } from 'react'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Link2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import CategoryMultiSelect from '@/components/vendor/category-multi-select'
import { GenerativeGalleryStrip } from '@/features/generative-media/components/generative-gallery-strip'
import { GenerativeMediaEditorFsModal } from '@/features/generative-media/components/generative-media-editor-fs-modal'
import {
  galleryFromUrlList,
  primaryGalleryUrl,
  type GalleryItem,
  type GenerativeGalleryValue,
} from '@/features/generative-media/types'
import { createVendorStore } from '@/app/_actions/vendor-actions'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciCtaPrimary } from '@/lib/ui/davinci'

interface VendorOnboardingFormProps {
  locale: Locale
}

function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

const INSET = 'px-0'

export default function VendorOnboardingForm({ locale }: VendorOnboardingFormProps) {
  const t = useTranslations('vendor.onboarding')
  const tForm = useTranslations('vendor.onboarding.form')
  const tValidation = useTranslations('vendor.onboarding.validation')
  const tStartPage = useTranslations('vendor.startPage')

  const [state, formAction, isPending] = useActionState(createVendorStore, null)
  const [isSlugPending, startSlugTransition] = useTransition()

  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [storeCategories, setStoreCategories] = useState<string[]>([])
  const [logoGallery, setLogoGallery] = useState<GenerativeGalleryValue>(() =>
    galleryFromUrlList([]),
  )
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(true)

  const [sellElsewhere, setSellElsewhere] = useState(false)
  const [existingUrls, setExistingUrls] = useState<string[]>([''])
  const [logoEditorOpen, setLogoEditorOpen] = useState(false)

  const addGeneratedLogo = (item: GalleryItem) => {
    setLogoGallery({
      items: [{ ...item, isPrimary: true, enabled: true }],
    })
  }

  useEffect(() => {
    if (autoGenerateSlug && storeName) {
      startSlugTransition(() => {
        setStoreSlug(generateSlugFromName(storeName))
      })
    }
  }, [storeName, autoGenerateSlug, startSlugTransition])

  const handleSlugChange = (value: string) => {
    setStoreSlug(value)
    setAutoGenerateSlug(false)
  }

  const logoUrl = primaryGalleryUrl(logoGallery)

  const cleanedExistingUrls = existingUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0)

  const slugPreviewHost = 'ring-platform.org'
  const slugPreviewUrl = storeSlug.trim()
    ? `https://${storeSlug.trim()}.${slugPreviewHost}`
    : `https://[slug].${slugPreviewHost}`

  return (
    <div className={cn('space-y-8', INSET)}>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[
          { n: '✓', label: tStartPage('progressSteps.account'), done: true },
          { n: '2', label: tStartPage('progressSteps.storeSetup'), active: true },
          { n: '3', label: tStartPage('progressSteps.launch'), muted: true },
        ].map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 ? <div className="hidden h-px w-8 bg-border sm:block" /> : null}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  step.done && 'bg-primary text-primary-foreground',
                  step.active && !step.done && 'bg-primary text-primary-foreground',
                  step.muted && 'bg-muted text-muted-foreground',
                )}
              >
                {step.n}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  step.muted ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cn(davinciGlassSurface, 'rounded-2xl p-5 sm:p-6 space-y-6')}
      >
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="storeLogoUrl" value={logoUrl} />
          <input
            type="hidden"
            name="existingStorefrontUrls"
            value={JSON.stringify(sellElsewhere ? cleanedExistingUrls : [])}
          />

          {/* 1. Store name */}
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

          {/* 2. Categories (right below store name) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {tForm('storeCategories')} <span className="text-destructive">*</span>
            </Label>
            <p className="mb-3 text-xs text-muted-foreground">{tForm('storeCategoriesHint')}</p>
            <CategoryMultiSelect
              selectedCategories={storeCategories}
              onCategoriesChange={setStoreCategories}
              error={
                state?.error && storeCategories.length === 0
                  ? tValidation('categoriesRequired')
                  : undefined
              }
            />
            <input type="hidden" name="storeCategories" value={JSON.stringify(storeCategories)} />
          </div>

          {/* 3. I already sell at (right below categories) */}
          <div className={cn('space-y-3 rounded-xl border border-border/60 p-4')}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  {tForm('existingStorefrontsTitle')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tForm('existingStorefrontsHint')}
                </p>
              </div>
              <Switch
                checked={sellElsewhere}
                onCheckedChange={setSellElsewhere}
                aria-label={tForm('existingStorefrontsTitle')}
              />
            </div>

            {sellElsewhere ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {tForm('existingPagesUrls')}
                </p>
                {existingUrls.map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="https://shopify.com/store528"
                      value={url}
                      onChange={(e) => {
                        const next = [...existingUrls]
                        next[idx] = e.target.value
                        setExistingUrls(next)
                      }}
                      className="h-10 font-mono text-sm"
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={existingUrls.length <= 1}
                      onClick={() =>
                        setExistingUrls((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label={tForm('removeUrl')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setExistingUrls((prev) => [...prev, ''])}
                    disabled={isPending || existingUrls.length >= 8}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    {tForm('addUrl')}
                  </Button>
                  {/*
                    TODO(wwwdata-conductor): Wire Save → wwwdata-conductor fetch of cleanedExistingUrls.
                    Goals: detect primary language; extract applicable storefront data; TextConductor brief
                    description → populate storeDescription when empty; if logo found, fetch → object
                    storage → logoGallery. Do not block onboarding submit on this async path.
                    UI Save button lands in Plan (Ring Vendor-Start Improvements).
                  */}
                </div>
              </div>
            ) : null}
          </div>

          {/* 4. Store slug — subdomain preview https://[slug].ring-platform.org */}
          <div className="space-y-2">
            <Label htmlFor="storeSlug" className="text-sm font-medium">
              {tForm('storeSlug')} <span className="text-destructive">*</span>
            </Label>
            {/*
              TODO(ingress): On vendor activation, provision wildcard/host ingress for
              https://{storeSlug}.ring-platform.org → vendor storefront (k8s Ingress /
              cert-manager / DNS). Preview below is the product URL contract; routing
              must be wired before go-live of subdomain stores.
            */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="shrink-0 text-sm text-muted-foreground font-mono">
                https://
              </span>
              <Input
                id="storeSlug"
                name="storeSlug"
                value={storeSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={tForm('storeSlugPlaceholder')}
                className="h-11 flex-1 font-mono"
                disabled={isPending || isSlugPending}
                required
              />
              <span className="shrink-0 text-sm text-muted-foreground font-mono">
                .{slugPreviewHost}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {tForm('storeSlugHint')}{' '}
              <span className="font-mono text-foreground/80">{slugPreviewUrl}</span>
            </p>
          </div>

          {/* 5. Description */}
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
              <p
                className={cn(
                  'font-mono',
                  storeDescription.length > 450 ? 'text-amber-600' : 'text-muted-foreground',
                )}
              >
                {storeDescription.length}/500
              </p>
            </div>
          </div>

          {/* 6. Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{tForm('storeLogo')}</Label>
            <p className="text-xs text-muted-foreground">{tForm('storeLogoHint')}</p>
            {logoUrl ? (
              <div className="overflow-hidden rounded-xl border border-border/60 max-w-[12rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              </div>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className={cn(davinciGlassSurface, 'h-11')}
              onClick={() => setLogoEditorOpen(true)}
              disabled={isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {tForm('uploadAndGenerate')}
            </Button>
            {/* Pre-vendor: vendor:logo asserts ownership — nft:media until Plan adds onboarding purpose */}
            <GenerativeGalleryStrip
              scope="product"
              pageSlug="vendor-start"
              fieldId="store-logo"
              value={logoGallery}
              onChange={setLogoGallery}
              maxItems={1}
              uploadPurpose="nft:media"
            />
            <GenerativeMediaEditorFsModal
              open={logoEditorOpen}
              onOpenChange={setLogoEditorOpen}
              scope="product"
              pageSlug="vendor-start"
              fieldId="store-logo"
              purpose="vendor:store-logo"
              context={{
                name: storeName || 'Vendor store',
                description: storeDescription,
                category: storeCategories[0],
              }}
              referenceImageUrl={logoUrl || undefined}
              onUseImage={addGeneratedLogo}
            />
          </div>

          {state?.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">{state.error}</p>
            </div>
          ) : null}

          {state?.success ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
              {t('success')} {t('redirecting')}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isPending || storeCategories.length === 0}
            className={cn(davinciCtaPrimary, 'h-11 w-full sm:w-auto')}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tForm('submitting')}
              </>
            ) : (
              <>
                {tForm('submit')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
