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

import React, { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Upload, X, Loader2, Save, ArrowLeft, Link as LinkIcon } from 'lucide-react'
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
import ProductRepSelect from '@/components/store/product-rep-select'
import { useCurrency } from '@/features/store/currency-context'
import { displayPriceFromUah, getCurrencySymbol } from '@/lib/zod/store-product'
import ringConfig from '@/ring-config.json'

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
const HAS_NICHE_PRODUCT_FIELDS = ringConfig.productFields?.preset === 'agricultural'

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
  const { currency } = useCurrency()
  const currencySymbol = getCurrencySymbol(currency)

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

  // React 19 useTransition for non-blocking file upload handling
  const [isFilePending, startFileTransition] = useTransition()

  // Form state
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(existingProduct?.images || [])
  const [video, setVideo] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(existingProduct?.data?.videoUrl || null)
  const [activeInMyStore, setActiveInMyStore] = useState<boolean>(existingProduct?.status === 'active' || true)
  const [submitToMainStore, setSubmitToMainStore] = useState(false)
  const [repUsername, setRepUsername] = useState<string>(existingProduct?.rep ?? '')
  const [priceInput, setPriceInput] = useState(() => {
    if (!existingProduct?.price) return ''
    return String(displayPriceFromUah(Number(existingProduct.price), currency))
  })

  React.useEffect(() => {
    if (existingProduct?.price) {
      setPriceInput(String(displayPriceFromUah(Number(existingProduct.price), currency)))
    }
  }, [currency, existingProduct?.price])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (photos.length + files.length > 5) {
      alert(tProducts('validation.photoCountExceeded'))
      return
    }
    
    // Validate each file
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(tProducts('validation.photoSizeExceeded'))
        return
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert(tProducts('validation.photoInvalidType'))
        return
      }
    }
    
    // Wrap file handling in useTransition for non-blocking UI updates
    startFileTransition(() => {
      // Add to photos array
      setPhotos(prev => [...prev, ...files])

      // Create previews
      files.forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPhotoPreviews(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    })
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

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
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>{tForm('photo')} *</Label>
              <p className="text-xs text-muted-foreground">{tForm('photoHint')}</p>
              
              <div className="grid grid-cols-3 gap-4">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-border">
                    <Image src={preview} alt={`Product ${index + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-white text-xs py-1 text-center">
                        {tForm('mainPhoto')}
                      </div>
                    )}
                  </div>
                ))}
                
                {photos.length + photoPreviews.length < 5 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">{tForm('addPhoto')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      className="hidden"
                      disabled={isPending}
                    />
                  </label>
                )}
              </div>
              
              {/* Hidden inputs for form submission */}
              {photos.map((photo, index) => (
                <input key={index} type="hidden" name={`photo-${index}`} value="file-attached" />
              ))}
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
              <Select name="category" defaultValue={existingProduct?.category || ''} disabled={isPending} required>
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

            {/* Agricultural ERP Fields (Optional — agricultural preset only) */}
            {HAS_NICHE_PRODUCT_FIELDS && (
              <div className="pt-4 border-t">
                <NicheProductFieldsSection 
                  isPending={isPending}
                  existingData={existingProduct?.data}
                />
              </div>
            )}

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
                disabled={isPending || photoPreviews.length === 0}
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

