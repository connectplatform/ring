'use client'

/**
 * Shared Product Form Component (Create + Edit)
 * 
 * Features:
 * - Photo upload (1-5 images) with drag & drop
 * - Video upload (optional)
 * - Product details (name, category, price, stock, description)
 * - Submit to Main Store toggle
 * - Active in My Store toggle
 * - React 19 useActionState
 * - Vercel Blob uploads handled in server action
 * 
 * Mode: 'create' | 'edit'
 */

import React, { useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Upload, X, Loader2, Save, ArrowLeft, Link as LinkIcon, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { createVendorProduct, updateVendorProduct } from '@/app/_actions/vendor-actions'
import { createAdminStoreProduct, updateAdminStoreProduct } from '@/app/_actions/admin-store-erp'
import type { AdminVendorOption } from '@/app/_actions/admin-store-erp'
import VendorEntitySelect from '@/components/admin/vendor-entity-select'
import { STORE_PRODUCT_CATEGORIES } from '@/lib/zod/store-product'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import NicheProductFieldsSection from '@/components/vendor/niche-product-fields-section'
import { ProductPromotionsFields } from '@/components/vendor/product-promotions-fields'
import ProductRepSelect from '@/components/store/product-rep-select'
import { GenerativeMediaField } from '@/features/generative-media/components/generative-media-field'
import {
  galleryFromUrlList,
  primaryGalleryUrl,
  type GenerativeGalleryValue,
} from '@/features/generative-media/types'
import { useStoreCurrency } from '@/features/store/currency-context'
import { displayPriceFromUah, getCurrencySymbol } from '@/lib/zod/store-product'
import { getProductFieldsPreset } from '@/lib/ring-config-core'
import type { StoreCurrency } from '@/lib/zod/store-product'

interface ProductFormProps {
  mode: 'create' | 'edit'
  variant?: 'vendor' | 'admin'
  locale: Locale
  vendorEntity: any
  adminVendors?: AdminVendorOption[]
  existingProduct?: any
  inheritedReferralPercent?: number
}

const PRODUCT_CATEGORIES = [...STORE_PRODUCT_CATEGORIES]
const HAS_NICHE_PRODUCT_FIELDS = getProductFieldsPreset() !== 'platform'

export default function ProductForm({
  mode,
  variant = 'vendor',
  locale,
  vendorEntity,
  adminVendors,
  existingProduct,
  inheritedReferralPercent = 5,
}: ProductFormProps) {
  const tForm = useTranslations('vendor.products.form')
  const tProducts = useTranslations('vendor.products')
  const tAdminPage = useTranslations('modules.admin.storeHub.productsPage')
  const tAdminForm = useTranslations('modules.admin.storeHub.productsPage.form')
  const tCat = useTranslations('vendor.onboarding.categories')
  const router = useRouter()
  const { currency, convertPrice, formatPrice: formatCurrencyPrice } = useStoreCurrency()
  const currencySymbol = getCurrencySymbol(currency as StoreCurrency)

  const pageTitle =
    variant === 'admin'
      ? mode === 'create'
        ? tAdminPage('addTitle')
        : tAdminPage('editTitle')
      : mode === 'create'
        ? tProducts('addProduct')
        : tProducts('editProduct')

  const pageSubtitle =
    variant === 'admin'
      ? mode === 'create'
        ? tAdminPage('addSubtitle')
        : tAdminPage('editSubtitle')
      : mode === 'create'
        ? tProducts('createSubtitle')
        : tProducts('editSubtitle')

  const serverAction =
    variant === 'admin'
      ? mode === 'create'
        ? createAdminStoreProduct
        : updateAdminStoreProduct
      : mode === 'create'
        ? createVendorProduct
        : updateVendorProduct

  const backHref =
    variant === 'admin'
      ? ROUTES.ADMIN_STORE_PRODUCTS(locale)
      : ROUTES.VENDOR_PRODUCTS(locale)

  const [state, formAction, isPending] = useActionState(serverAction, null)
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    variant === 'admin'
      ? String(existingProduct?.entity_id ?? existingProduct?.vendorId ?? vendorEntity?.id ?? '')
      : vendorEntity?.id ?? '',
  )

  React.useEffect(() => {
    if (variant === 'admin' && state && 'success' in state && state.success) {
      router.push(backHref)
      router.refresh()
    }
  }, [state, variant, router, backHref])

  // Form state — generative gallery SSOT (Upload | Generate)
  const [gallery, setGallery] = useState<GenerativeGalleryValue>(() => {
    const fromDoc =
      existingProduct?.generativeGallery || existingProduct?.data?.generativeGallery
    if (fromDoc?.items?.length) return fromDoc as GenerativeGalleryValue
    return galleryFromUrlList(
      Array.isArray(existingProduct?.images) ? (existingProduct.images as string[]) : [],
    )
  })
  const [video, setVideo] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(existingProduct?.data?.videoUrl || null)
  const [activeInMyStore, setActiveInMyStore] = useState<boolean>(existingProduct?.status === 'active' || true)
  const [submitToMainStore, setSubmitToMainStore] = useState(false)
  const [productAudience, setProductAudience] = useState<'public' | 'member'>(existingProduct?.productAudience ?? existingProduct?.audience ?? 'public')
  const [selectedCategory, setSelectedCategory] = useState<string>(existingProduct?.category || '')
  const [repUsername, setRepUsername] = useState<string>(existingProduct?.rep ?? '')
  const [customFields, setCustomFields] = useState<Array<{ id: string; fieldName: string; fieldValue: string; fieldType: string }>>([])
  const [priceInput, setPriceInput] = useState(() => {
    if (!existingProduct?.price) return ''
    return String(displayPriceFromUah(Number(existingProduct.price), currency))
  })

  React.useEffect(() => {
    if (existingProduct?.price) {
      setPriceInput(String(displayPriceFromUah(Number(existingProduct.price), currency)))
    }
  }, [currency, existingProduct?.price])

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    
    if (!file) return
    
    if (file.size > 50 * 1024 * 1024) {
      alert(tProducts('validation.videoSizeExceeded'))
      return
    }
    
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      alert(tProducts('validation.videoInvalidType'))
      return
    }
    
    setVideo(file)
    const url = URL.createObjectURL(file)
    setVideoPreview(url)
  }

  const handleRemoveVideo = () => {
    setVideo(null)
    setVideoPreview(null)
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator - Only for Create Mode */}
      {mode === 'create' && variant === 'vendor' && (
        <motion.div
          className="flex items-center justify-center space-x-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
              ✓
            </div>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Store Setup</span>
          </div>
          <div className="w-12 h-px bg-border"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
              2
            </div>
            <span className="text-sm font-medium text-foreground">Product Details</span>
          </div>
          <div className="w-12 h-px bg-border"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">
              3
            </div>
            <span className="text-sm font-medium text-muted-foreground">Publish</span>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>
      </div>

      {/* Form Card */}
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        {variant === 'admin' && (
          <input type="hidden" name="vendorEntityId" value={selectedVendorId} />
        )}
        {mode === 'edit' && existingProduct && (
          <input type="hidden" name="productId" value={existingProduct.id} />
        )}
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="rep" value={repUsername} />
        <input type="hidden" name="activeInMyStore" value={activeInMyStore ? 'true' : 'false'} />
        <input type="hidden" name="submitToMainStore" value={submitToMainStore ? 'true' : 'false'} />
        <input type="hidden" name="productAudience" value={productAudience} />

        {variant === 'admin' && adminVendors && mode === 'create' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{tAdminForm('vendorOwner')}</CardTitle>
            </CardHeader>
            <CardContent>
              <VendorEntitySelect
                vendors={adminVendors}
                value={selectedVendorId}
                onChange={setSelectedVendorId}
                placeholder={tAdminForm('vendorOwnerPlaceholder')}
              />
            </CardContent>
          </Card>
        )}
        
        {variant === 'admin' ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold tracking-tight">{tForm('productDetails')}</h2>
            {renderProductFields()}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{tForm('productDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderProductFields()}
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )

  function renderProductFields() {
    return (
      <>
            {/* Generative gallery SSOT (Upload | Generate) */}
            <div className="space-y-2">
              <Label>{tForm('photo')} *</Label>
              <p className="text-xs text-muted-foreground">{tForm('photoHint')}</p>
              <GenerativeMediaField
                name="productPrimaryImage"
                imagesFieldName="productImages"
                scope="product"
                fieldId="photos"
                pageSlug="vendor-product"
                purpose="product-image"
                maxItems={5}
                entityId={existingProduct?.id ? String(existingProduct.id) : undefined}
                actionUrl={mode === 'edit' && existingProduct?.id
                  ? (variant === 'admin'
                    ? `/${locale}/admin/store/products/${existingProduct.id}/edit`
                    : `/${locale}/vendor/products/${existingProduct.id}/edit`)
                  : `/${locale}/vendor/products/new`}
                context={{
                  name: existingProduct?.name,
                  category: selectedCategory || existingProduct?.category,
                  description: existingProduct?.description,
                  vendorName: vendorEntity?.name,
                }}
                value={gallery}
                onChange={setGallery}
              />
            </div>

            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{tForm('name')} *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={existingProduct?.name || ''}
                placeholder={tForm('namePlaceholder')}
                disabled={isPending}
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">{tForm('category')} *</Label>
              <Select
                name="category"
                defaultValue={existingProduct?.category || selectedCategory || ''}
                disabled={isPending}
                required
                onValueChange={(val) => setSelectedCategory(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tForm('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {tCat(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Per-product promotions (BOGO / % / amount) */}
            <ProductPromotionsFields
              initial={
                Array.isArray(existingProduct?.promotions)
                  ? existingProduct.promotions
                  : Array.isArray(existingProduct?.data?.promotions)
                    ? existingProduct.data.promotions
                    : []
              }
              disabled={isPending}
            />

            {/* Custom Product Fields (injected via sql migrations on deploy per ring-store-niche preset) */}
            {HAS_NICHE_PRODUCT_FIELDS && (
              <div className="pt-4 border-t">
                <NicheProductFieldsSection
                  isPending={isPending}
                  existingData={existingProduct?.data}
                  category={selectedCategory}
                />
              </div>
            )}

            {/* Add product parameter — vendor custom fields CRUD */}
            <div className="space-y-2 pt-4 border-t">
              {!isPending && (
                <button
                  type="button"
                  onClick={() => setCustomFields((prev) => [...prev, { id: crypto.randomUUID(), fieldName: '', fieldValue: '', fieldType: 'text' }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {tForm('addProductParameter')}
                </button>
              )}
              {customFields.map((cf) => (
                <div key={cf.id} className="flex items-start gap-2">
                  <input type="hidden" name={`customField_${cf.id}_name`} value={cf.fieldName} />
                  <input type="hidden" name={`customField_${cf.id}_value`} value={cf.fieldValue} />
                  <input type="hidden" name={`customField_${cf.id}_type`} value={cf.fieldType} />
                  <input type="hidden" name={`customField_${cf.id}_category`} value={selectedCategory} />
                  <Input
                    placeholder={tForm('parameterName')}
                    value={cf.fieldName}
                    onChange={(e) => setCustomFields((prev) => prev.map(p => p.id === cf.id ? { ...p, fieldName: e.target.value } : p))}
                    disabled={isPending}
                    className="h-9 text-sm flex-1"
                  />
                  <Input
                    placeholder={tForm('parameterValue')}
                    value={cf.fieldValue}
                    onChange={(e) => setCustomFields((prev) => prev.map(p => p.id === cf.id ? { ...p, fieldValue: e.target.value } : p))}
                    disabled={isPending}
                    className="h-9 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => prev.filter(p => p.id !== cf.id))}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive/80 p-1"
                    aria-label={tForm('removeParameter')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Referral commission (optional per-product override) */}
            <div className="space-y-2">
              <Label htmlFor="referralCommission">{tForm('referralCommission')}</Label>
              <Input
                id="referralCommission"
                name="referralCommission"
                type="number"
                step="0.1"
                min="0"
                max="50"
                defaultValue={
                  existingProduct?.referralCommission ??
                  existingProduct?.data?.referralCommission ??
                  ''
                }
                placeholder={tForm('referralCommissionPlaceholder', {
                  percent: inheritedReferralPercent,
                })}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{tForm('referralCommissionHint')}</p>
            </div>

            {/* Price and Stock */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceUAH">
                  {tForm('priceLabel', { currency })}
                </Label>
                <div className="relative">
                  <Input
                    id="priceUAH"
                    name="priceUAH"
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder={tForm('pricePlaceholder')}
                    disabled={isPending}
                    required
                    className="pr-14"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stock">{tForm('stock')} *</Label>
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue={existingProduct?.stock_quantity || ''}
                  placeholder={tForm('stockPlaceholder')}
                  disabled={isPending}
                  required
                />
              </div>
            </div>

            {/* Product representative */}
            <div className="space-y-2">
              <Label htmlFor="rep">{tForm('rep')}</Label>
              <ProductRepSelect
                value={repUsername}
                onChange={setRepUsername}
                placeholder={tForm('repPlaceholder')}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{tForm('repHint')}</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{tForm('description')}</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={existingProduct?.description || ''}
                placeholder={tForm('descriptionPlaceholder')}
                maxLength={200}
                disabled={isPending}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="activeInMyStore">{tForm('activeInMyStore')}</Label>
                  <p className="text-xs text-muted-foreground">{tForm('activeInMyStoreHint')}</p>
                </div>
                <Switch
                  id="activeInMyStore"
                  checked={activeInMyStore}
                  onCheckedChange={setActiveInMyStore}
                  disabled={isPending}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="submitToMainStore">{tForm('submitToMainStore')}</Label>
                  <p className="text-xs text-muted-foreground">{tForm('submitToMainStoreHint')}</p>
                </div>
                <Switch
                  id="submitToMainStore"
                  checked={submitToMainStore}
                  onCheckedChange={setSubmitToMainStore}
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="productAudience">{tForm('productAudience')}</Label>
                  <p className="text-xs text-muted-foreground">{tForm('productAudienceHint')}</p>
                </div>
                <Switch
                  id="productAudience"
                  checked={productAudience === 'member'}
                  onCheckedChange={(checked) => setProductAudience(checked ? 'member' : 'public')}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Error Display */}
            {state?.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/30 rounded-lg p-4"
              >
                <p className="text-sm text-destructive font-medium">⚠️ {state.error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <div className="flex items-center gap-4 pt-4">
              <Button
                type="submit"
                disabled={isPending || !primaryGalleryUrl(gallery)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-700 hover:to-lime-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === 'create' ? tForm('submitting') : tForm('updating')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {mode === 'create' ? tForm('submit') : tForm('update')}
                  </>
                )}
              </Button>
              
              <Link href={backHref}>
                <Button type="button" variant="outline" disabled={isPending}>
                  {tForm('cancel')}
                </Button>
              </Link>
            </div>
      </>
    )
  }
}

