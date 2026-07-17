'use server'

/**
 * Vendor Server Actions
 * 
 * Vendor server actions for Ring Platform multi-vendor marketplace:
 * - Vendor onboarding (create vendor entity and profile)
 * - Product CRUD operations
 * - Vercel Blob uploads for store logos and product media
 * - Main Store submission workflow
 * - Authorization and validation
 * 
 * Tech Stack:
 * - Next.js 15 Server Actions
 * - Vercel Blob for file storage
 * - DatabaseService for data persistence
 * - Auth.js for authentication
 */

import { auth } from '@/auth'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { file } from '@/lib/file'
import { ringbaseDerivativeUploadOptions } from '@/lib/file/derivatives-profile'
import { db } from '@/lib/database'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { createVendorProfile } from '@/features/store/services/vendor-lifecycle'
import { buildMainStoreListingPatch, flattenProductDocumentForWrite, resolveVendorEntityId } from '@/features/store/lib/product-document'
import { normalizePriceToUah, type StoreCurrency } from '@/lib/zod/store-product'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import { resolveProductImagesFromForm } from '@/features/generative-media/parse-product-images'
import { getVendorProfile } from '@/features/store/services/vendor-profile'
import type { VendorProfile } from '@/features/store/types/vendor'
import type {
  FreeShippingMode,
  ProductPromotion,
  VendorStorePromotions,
} from '@/features/store/types/promotions'

function parseProductPromotionsFromForm(formData: FormData): ProductPromotion[] {
  const raw = (formData.get('promotionsJson') as string)?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ProductPromotion[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p) => p && typeof p === 'object' && p.type && p.id)
      .map((p) => ({
        id: String(p.id),
        type: p.type,
        enabled: Boolean(p.enabled),
        label: p.label ? String(p.label) : undefined,
        buyQty: typeof p.buyQty === 'number' ? p.buyQty : p.type === 'bogo' ? 2 : undefined,
        getQty: typeof p.getQty === 'number' ? p.getQty : p.type === 'bogo' ? 1 : undefined,
        percentOff: typeof p.percentOff === 'number' ? p.percentOff : undefined,
        amountOff: typeof p.amountOff === 'number' ? p.amountOff : undefined,
        currency: p.currency ? String(p.currency) : undefined,
        startsAt: p.startsAt ? String(p.startsAt) : undefined,
        endsAt: p.endsAt ? String(p.endsAt) : undefined,
      }))
  } catch {
    return []
  }
}

// ============================================================================
// VENDOR ONBOARDING
// ============================================================================

export async function createVendorStore(prevState: any, formData: FormData) {

  const locale = (formData.get('locale') as Locale) || defaultLocale as Locale

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    // Check if user already has vendor entity
    const existingVendor = await getVendorEntity(session.user.id)
    if (existingVendor) {
      return { error: 'You already have a vendor store' }
    }

    // Extract form data
    const storeSlug = (formData.get('storeSlug') as string)?.trim()
    const storeName = (formData.get('storeName') as string)?.trim()
    const storeDescription = (formData.get('storeDescription') as string)?.trim()
    const storeCategoriesRaw = formData.get('storeCategories') as string
    const storeCategories = storeCategoriesRaw ? JSON.parse(storeCategoriesRaw) : []

    // Validation
    if (!storeSlug || storeSlug.length < 3 || storeSlug.length > 50) {
      return { error: 'Store slug must be 3-50 characters' }
    }
    if (!/^[a-z0-9-]+$/.test(storeSlug)) {
      return { error: 'Store slug can only contain lowercase letters, numbers, and hyphens' }
    }
    if (!storeName || storeName.length < 3 || storeName.length > 100) {
      return { error: 'Store name must be 3-100 characters' }
    }
    if (!storeDescription || storeDescription.length > 500) {
      return { error: 'Store description is required and must be less than 500 characters' }
    }
    if (!Array.isArray(storeCategories) || storeCategories.length === 0) {
      return { error: 'Please select at least one category' }
    }

    // Handle store logo upload (if provided)
    let logoUrl: string | null = null
    const logoFile = formData.get('storeLogo') as File | null
    
    if (logoFile && logoFile.size > 0) {
      // Validate logo
      if (logoFile.size > 5 * 1024 * 1024) {
        return { error: 'Logo file size must be less than 5MB' }
      }

      // More robust MIME type and extension validation
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
      const fileExtension = logoFile.name.toLowerCase().substring(logoFile.name.lastIndexOf('.'))

      // Check both MIME type and file extension for better reliability
      const isValidType = allowedTypes.includes(logoFile.type)
      const isValidExtension = allowedExtensions.includes(fileExtension)

      if (!isValidType && !isValidExtension) {
        return { error: 'Logo must be JPG, PNG, or WebP format' }
      }

      // Additional check: if MIME type is missing but extension is valid, accept it
      if (!isValidType && isValidExtension) {
        console.warn('File has valid extension but unknown MIME type, proceeding with upload')
      }

      // Generate temporary entity ID for upload path
      const tempEntityId = `temp_${Date.now()}_${session.user.id.slice(0, 8)}`
      const ext = logoFile.name.split('.').pop() || 'webp'
      
      // Upload using our file abstraction layer
      const result = await file().upload(`vendors/${tempEntityId}/logo.${ext}`, logoFile, {
        access: 'public',
        addRandomSuffix: false,
        contentType: logoFile.type || undefined,
        ...ringbaseDerivativeUploadOptions('vendor:logo', logoFile.type, 'public'),
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Logo upload failed')
      }

      logoUrl = result.url
    }

    // Create vendor Entity
    const entityId = `entity_vendor_${Date.now()}`
    
    const entityData = {
      id: entityId,
      name: storeName,
      description: storeDescription,
      addedBy: session.user.id,
      modifiedBy: session.user.id,
      category: 'vendor',
      type: 'vendor-store',
      storeActivated: true,
      storeStatus: 'open',
      vendorTier: 'NEW', // Start at NEW tier (20% commission)
      vendorRating: 0,
      vendorTotalSales: 0,
      vendorTotalOrders: 0,
      commission: 20, // 20% for NEW vendors
      storeSlug: storeSlug,
      storeCategories: storeCategories,
      storeLogo: logoUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Create vendor profile data inline (avoid read-after-write consistency issues)
    const now = new Date()
    const vendorProfile = {
      id: `vendor_${entityId}`,
      entityId,
      userId: session.user.id,
      onboardingStatus: 'started' as const,
      onboardingStartedAt: now,
      trustLevel: 'NEW' as const,
      trustScore: 50, // Starting trust score
      performanceMetrics: {
        orderFulfillmentRate: 100,
        onTimeShipmentRate: 100,
        customerSatisfactionScore: 5,
        returnProcessingTime: 24,
        totalOrders: 0,
        totalRevenue: 0
      },
      complianceStatus: {
        taxDocumentsSubmitted: false,
        termsAccepted: false,
        dataProcessingAgreementSigned: false
      },
      suspensionHistory: [],
      tierProgressionHistory: [],
      createdAt: now,
      updatedAt: now
    }

    // Add vendor profile to entity data
    const entityDataWithProfile = {
      ...entityData,
      vendor_profile: vendorProfile,
      store_activated: true,
      store_status: 'test', // Start in test mode
      trust_score: vendorProfile.trustScore / 100, // Convert to decimal format for DB
      verification_status: 'pending'
    }

    const entityResult = await db().createDoc('entities', entityDataWithProfile, { id: entityId })

    if (!entityResult.success) {
      // Clean up uploaded logo if entity creation fails
      if (logoUrl) {
        try {
          await file().delete(logoUrl)
        } catch (e) {
          console.error('Failed to cleanup logo:', e)
        }
      }
      return { error: entityResult.error || 'Failed to create vendor entity' }
    }

    // Update user role to include 'vendor' (if not already)
    const userResult = await db().readDoc<Record<string, unknown> & { id: string }>('users', session.user.id)
    if (userResult.success && userResult.data) {
      const userData = userResult.data
      const currentRole = (userData.role as string) || 'user'
      const roles = currentRole.split(',').map((r: string) => r.trim())
      
      if (!roles.includes('vendor')) {
        roles.push('vendor')
        await db().updateDoc('users', session.user.id, {
          role: roles.join(','),
          updatedAt: new Date()
        })
      }
    }

    try {
      localizedRedirect({ locale, href: '/vendor/dashboard' })
    } catch (redirectError) {
      if (!(redirectError instanceof Error && redirectError.message.includes('NEXT_REDIRECT'))) {
        console.error('Unexpected redirect error:', redirectError)
      }
      throw redirectError
    }

  } catch (error) {
    if (!(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('Error creating vendor store:', error)
    }
    return { error: error instanceof Error ? error.message : 'Failed to create vendor store' }
  }
}

// ============================================================================
// VENDOR STATUS CHECK
// ============================================================================

export async function checkVendorStatus() {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { isVendor: false }
    }

    const vendorEntity = await getVendorEntity(session.user.id)
    return { isVendor: !!vendorEntity, vendorEntity }
    
  } catch (error) {
    console.error('Error checking vendor status:', error)
    return { isVendor: false }
  }
}

// ============================================================================
// PRODUCT CRUD OPERATIONS
// ============================================================================

export async function createVendorProduct(prevState: any, formData: FormData) {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    // Get vendor entity
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity) {
      return { error: 'Unauthorized: Vendor access required' }
    }

    // Extract form data — using centralized schema from store-product
    const { isStoreCurrency } = await import('@/lib/zod/store-product')
    const name = (formData.get('name') as string)?.trim()
    const category = formData.get('category') as string
    const currencyRaw = (formData.get('currency') as string)?.trim() || 'UAH'
    const currency = isStoreCurrency(currencyRaw) ? currencyRaw : 'UAH'
    const rawPrice = parseFloat(formData.get('priceUAH') as string)
    const priceUAH = normalizePriceToUah(rawPrice, currency)
    const stock = parseInt(formData.get('stock') as string, 10)
    const daarPrice = formData.get('daarPrice') ? parseFloat(formData.get('daarPrice') as string) : null
    const description = (formData.get('description') as string)?.trim() || ''
    const rep = ((formData.get('rep') as string) ?? '').trim()
    const activeInMyStore = formData.get('activeInMyStore') === 'true'
    const submitToMainStore = formData.get('submitToMainStore') === 'true'
    const productAudience = (formData.get('productAudience') as string) || 'public'
    const locale = (formData.get('locale') as Locale) || defaultLocale as Locale
    const referralCommissionRaw = (formData.get('referralCommission') as string)?.trim()
    let referralCommission: number | undefined
    if (referralCommissionRaw) {
      referralCommission = parseFloat(referralCommissionRaw)
      if (Number.isNaN(referralCommission) || referralCommission < 0 || referralCommission > 50) {
        return { error: 'Referral commission must be between 0 and 50 percent' }
      }
    }

    // Validation
    if (!name || name.length < 3 || name.length > 100) {
      return { error: 'Product name must be 3-100 characters' }
    }
    if (!category) {
      return { error: 'Category is required' }
    }
    if (isNaN(priceUAH) || priceUAH <= 0) {
      return { error: 'Price must be a positive number' }
    }
    if (isNaN(stock) || stock < 0) {
      return { error: 'Stock must be a non-negative number' }
    }
    if (description.length > 200) {
      return { error: 'Description must be less than 200 characters' }
    }

    // Handle video upload (optional)
    let videoUrl: string | null = null
    const videoFile = formData.get('video') as File | null
    
    if (videoFile && videoFile.size > 0) {
      if (videoFile.size > 50 * 1024 * 1024) {
        return { error: 'Video size must be less than 50MB' }
      }
      const allowedVideoTypes = ['video/mp4', 'video/webm']
      if (!allowedVideoTypes.includes(videoFile.type)) {
        return { error: 'Video must be MP4 or WebM' }
      }
    }

    // Create product ID
    const productId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Prefer GenerativeMediaField pre-uploaded URLs (SSOT); fall back to legacy File photo-*
    const resolved = resolveProductImagesFromForm(formData)
    let photoUrls = resolved.photoUrls
    const generativeGallery = resolved.gallery

    if (photoUrls.length === 0) {
      const photoFiles: File[] = []
      let photoIndex = 0
      while (formData.has(`photo-${photoIndex}`)) {
        const photoFile = formData.get(`photo-${photoIndex}`) as File
        if (photoFile && photoFile.size > 0) {
          photoFiles.push(photoFile)
        }
        photoIndex++
      }
      if (photoFiles.length === 0) {
        return { error: 'At least one photo is required' }
      }
      if (photoFiles.length > 5) {
        return { error: 'Maximum 5 photos allowed' }
      }
      for (const photo of photoFiles) {
        if (photo.size > 5 * 1024 * 1024) {
          return { error: 'Photo size must be less than 5MB' }
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(photo.type)) {
          return { error: 'Photos must be JPG, PNG, or WebP' }
        }
      }
      photoUrls = await Promise.all(
        photoFiles.map(async (photo, index) => {
          const ext = photo.name.split('.').pop() || 'webp'
          const result = await file().upload(`products/${productId}/photo-${index}.${ext}`, photo, {
            access: 'public',
            addRandomSuffix: false,
            contentType: photo.type || undefined,
            ...ringbaseDerivativeUploadOptions('vendor:product-media', photo.type, 'public'),
          })
          if (!result.success) {
            throw new Error(result.error || `Failed to upload photo ${index}`)
          }
          return result.url
        })
      )
    }
    if (photoUrls.length > 5) {
      return { error: 'Maximum 5 photos allowed' }
    }

    // Upload video if provided
    if (videoFile && videoFile.size > 0) {
      const ext = videoFile.name.split('.').pop() || 'mp4'
      const result = await file().upload(`products/${productId}/video.${ext}`, videoFile, {
        access: 'public',
        addRandomSuffix: false
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to upload video')
      }
      videoUrl = result.url
    }

    // Extract agricultural fields (optional - Phase 2)
    const agriculturalData = {
      origin: {
        farm: vendorEntity.name,
        farmId: vendorEntity.id,
        location: {
          lat: 0,
          lng: 0,
          address: formData.get('farmLocation') as string || '',
          region: '',
          country: 'Ukraine'
        },
        harvestDate: formData.get('harvestDate') as string || new Date().toISOString(),
        batchNumber: formData.get('batchNumber') as string || '',
        traceabilityCode: '',
        globalLocationNumber: ''
      },
      farmingMethods: [],
      pesticidesUsed: false,
      syntheticFertilizers: false,
      irrigationMethod: null
    }

    const certifications = {
      organic: (formData.get('organicCert') as string || 'None') !== 'None' ? formData.get('organicCert') as string : null,
      organicCertNumber: formData.get('organicCertNumber') as string || null,
      fairTrade: formData.get('fairTrade') === 'on',
      gmo: 'Conventional' as const,
      locallyGrown: formData.get('locallyGrown') === 'on',
      regenerative: formData.get('regenerative') === 'on',
      animalWelfare: null,
      globalGAP: false,
      kosher: false,
      halal: false,
      glutenFree: false
    }

    const sustainabilityMetrics = {
      carbonFootprint: parseFloat(formData.get('carbonFootprint') as string || '0'),
      carbonFootprintPerKg: parseFloat(formData.get('carbonFootprint') as string || '0'),
      waterUsage: parseFloat(formData.get('waterUsage') as string || '0'),
      waterUsagePerKg: parseFloat(formData.get('waterUsage') as string || '0'),
      soilHealthImpact: 0,
      biodiversityImpact: 0,
      packaging: formData.get('packaging') as string || 'Mixed',
      packagingMaterial: '',
      transportEmissions: 0,
      localImpact: '',
      carbonNegative: formData.get('carbonNegative') === 'on',
      renewableEnergyUsed: formData.get('renewableEnergy') === 'on'
    }

    const freshness = {
      harvestedAt: formData.get('harvestDate') as string || new Date().toISOString(),
      bestBefore: null,
      shelfLifeDays: parseInt(formData.get('shelfLifeDays') as string || '30', 10),
      storageTemp: parseFloat(formData.get('storageTemp') as string || '0') || null,
      storageHumidity: null,
      storageInstructions: formData.get('storageInstructions') as string || 'Store in a cool, dry place',
      perishable: formData.get('perishable') === 'on' || true
    }

    // Auto-calculate DAAR/DAARION prices
    const calculatedDaarPrice = daarPrice || priceUAH * 10 // 1 UAH ≈ 10 DAAR
    const daarionPrice = priceUAH * 0.5 // 1 UAH ≈ 0.5 DAARION
    const usdtPrice = priceUAH / 41 // 1 USD ≈ 41 UAH

    const tokenEconomy = {
      daarPrice: daarPrice,
      daarionPrice: daarionPrice,
      usdtPrice: usdtPrice,
      usdPrice: usdtPrice,
      acceptsTokens: true,
      tokenDiscountPercent: 5,
      regenerativeBonus: certifications.regenerative ? 10 : 0,
      stakingRewards: 0,
      daarRewardReason: certifications.regenerative ? 'REGENERATIVE_AGRICULTURE_10PCT' : null,
      daarionRewardReason: null
    }

    // Prepare flat JSONB product document (SSOT — no nested data.approvalStatus)
    const listingPatch = buildMainStoreListingPatch({ submitToMainStore, existing: null })

    const productData: Record<string, unknown> = {
      id: productId,
      name,
      description,
      price: priceUAH,
      currency,
      category,
      images: photoUrls,
      stock_quantity: stock,
      stock,
      status: activeInMyStore ? 'active' : 'inactive',
      vendor_id: session.user.id,
      entity_id: vendorEntity.id,
      vendorId: vendorEntity.id,
      vendorName: vendorEntity.name,
      vendorTier: (vendorEntity as any).vendorTier || 'NEW',
      commissionRate: (vendorEntity as any).commission || 20,
      daarPrice: calculatedDaarPrice,
      videoUrl,
      ...(generativeGallery ? { generativeGallery } : {}),
      activeInVendorStore: activeInMyStore,
      slug: `${(vendorEntity as any).storeSlug ?? vendorEntity.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      longDescription: '',
      tags: [],
      agriculturalData,
      certifications,
      sustainabilityMetrics,
      freshness,
      tokenEconomy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...listingPatch,
    }

    if (referralCommission !== undefined) {
      productData.referralCommission = referralCommission
    }
    if (rep) {
      productData.rep = rep
    }
    if (productAudience) {
      productData.productAudience = productAudience
    }
    const productPromotions = parseProductPromotionsFromForm(formData)
    if (productPromotions.length > 0) {
      productData.promotions = productPromotions
    }

    // Create product in database
    const result = await db().createDoc('store_products', productData, { id: productId })
    
    if (!result.success) {
      // Clean up uploaded files on failure
      try {
        await Promise.all(photoUrls.map(url => file().delete(url)))
        if (videoUrl) await file().delete(videoUrl)
      } catch (e) {
        console.error('Failed to cleanup uploaded files:', e)
      }
      return { error: result.error || 'Failed to create product' }
    }

    localizedRedirect({ locale, href: '/vendor/products' })
    
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('Error creating product:', error)
    }
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }
    return { error: error instanceof Error ? error.message : 'Failed to create product' }
  }
}

export async function updateVendorProduct(prevState: any, formData: FormData) {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    const productId = formData.get('productId') as string
    const locale = (formData.get('locale') as Locale) || 'en'
    
    if (!productId) {
      return { error: 'Product ID is required' }
    }

    // Get existing product
    const productResult = await db().readDoc<Record<string, unknown> & { id: string }>('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const existingProduct = productResult.data as Record<string, any>

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || resolveVendorEntityId(existingProduct) !== vendorEntity.id) {
      return { error: 'Unauthorized: This product does not belong to you' }
    }

    // Extract updated data
    const name = (formData.get('name') as string)?.trim()
    const category = formData.get('category') as string
    const { isStoreCurrency } = await import('@/lib/zod/store-product')
    const currencyRaw = (formData.get('currency') as string)?.trim() || 'UAH'
    const currency = isStoreCurrency(currencyRaw) ? currencyRaw : 'UAH'
    const rawPrice = parseFloat(formData.get('priceUAH') as string)
    const priceUAH = normalizePriceToUah(rawPrice, currency)
    const stock = parseInt(formData.get('stock') as string, 10)
    const daarPrice = formData.get('daarPrice') ? parseFloat(formData.get('daarPrice') as string) : null
    const description = (formData.get('description') as string)?.trim() || ''
    const rep = ((formData.get('rep') as string) ?? '').trim()
    const activeInMyStore = formData.get('activeInMyStore') === 'true'
    const submitToMainStore = formData.get('submitToMainStore') === 'true'
    const productAudience = (formData.get('productAudience') as string) || 'public'
    const referralCommissionRaw = (formData.get('referralCommission') as string)?.trim()
    let referralCommission: number | undefined
    if (referralCommissionRaw) {
      referralCommission = parseFloat(referralCommissionRaw)
      if (Number.isNaN(referralCommission) || referralCommission < 0 || referralCommission > 50) {
        return { error: 'Referral commission must be between 0 and 50 percent' }
      }
    }

    // Validation
    if (!name || name.length < 3 || name.length > 100) {
      return { error: 'Product name must be 3-100 characters' }
    }
    if (!category) {
      return { error: 'Category is required' }
    }
    if (isNaN(priceUAH) || priceUAH <= 0) {
      return { error: 'Price must be a positive number' }
    }
    if (isNaN(stock) || stock < 0) {
      return { error: 'Stock must be a non-negative number' }
    }

    // Prefer GenerativeMediaField gallery URLs; fall back to legacy new-photo-* files
    const resolved = resolveProductImagesFromForm(
      formData,
      Array.isArray(existingProduct.images) ? existingProduct.images : [],
    )
    let photoUrls = resolved.photoUrls
    const generativeGallery = resolved.gallery

    const newPhotoFiles: File[] = []
    let newPhotoIndex = 0
    while (formData.has(`new-photo-${newPhotoIndex}`)) {
      const photoFile = formData.get(`new-photo-${newPhotoIndex}`) as File
      if (photoFile && photoFile.size > 0) {
        newPhotoFiles.push(photoFile)
      }
      newPhotoIndex++
    }

    if (newPhotoFiles.length > 0 && !generativeGallery) {
      const newUrls = await Promise.all(
        newPhotoFiles.map(async (photo, index) => {
          const ext = photo.name.split('.').pop() || 'webp'
          const result = await file().upload(
            `products/${productId}/photo-${Date.now()}-${index}.${ext}`,
            photo,
            {
              access: 'public',
              addRandomSuffix: false,
              contentType: photo.type || undefined,
              ...ringbaseDerivativeUploadOptions('vendor:product-media', photo.type, 'public'),
            },
          )
          if (!result.success) {
            throw new Error(result.error || `Failed to upload new photo ${index}`)
          }
          return result.url
        })
      )
      photoUrls = [...photoUrls, ...newUrls]
    }

    if (!generativeGallery) {
      const deletedPhotos = formData.get('deletedPhotos') as string
      if (deletedPhotos) {
        const deletedUrls = JSON.parse(deletedPhotos)
        photoUrls = photoUrls.filter((url: string) => !deletedUrls.includes(url))
        await Promise.all(deletedUrls.map((url: string) => file().delete(url).catch(e => console.error('Delete failed:', e))))
      }
    }

    if (photoUrls.length === 0) {
      return { error: 'At least one photo is required' }
    }

    // Handle video update
    let videoUrl = existingProduct.data?.videoUrl || null
    const newVideoFile = formData.get('new-video') as File | null
    const deleteVideo = formData.get('deleteVideo') === 'true'
    
    if (deleteVideo && videoUrl) {
      await file().delete(videoUrl).catch(e => console.error('Video delete failed:', e))
      videoUrl = null
    }
    
    if (newVideoFile && newVideoFile.size > 0) {
      // Delete old video if exists
      if (videoUrl) {
        await file().delete(videoUrl).catch(e => console.error('Old video delete failed:', e))
      }
      
      const ext = newVideoFile.name.split('.').pop() || 'mp4'
      const result = await file().upload(`products/${productId}/video.${ext}`, newVideoFile, {
        access: 'public',
        addRandomSuffix: false
      })
      if (!result.success) {
        throw new Error(result.error || 'Failed to upload new video')
      }
      videoUrl = result.url
    }

    // Extract agricultural fields (Phase 2 - preserve existing or update)
    const agriculturalData = {
      ...existingProduct.data?.agriculturalData,
      origin: {
        ...(existingProduct.data?.agriculturalData?.origin || {}),
        harvestDate: formData.get('harvestDate') as string || existingProduct.data?.agriculturalData?.origin?.harvestDate || new Date().toISOString(),
        batchNumber: formData.get('batchNumber') as string || existingProduct.data?.agriculturalData?.origin?.batchNumber || '',
        location: {
          ...(existingProduct.data?.agriculturalData?.origin?.location || {}),
          address: formData.get('farmLocation') as string || existingProduct.data?.agriculturalData?.origin?.location?.address || ''
        }
      }
    }

    const certifications = {
      ...(existingProduct.data?.certifications || {}),
      organic: (formData.get('organicCert') as string || 'None') !== 'None' ? formData.get('organicCert') as string : existingProduct.data?.certifications?.organic || null,
      organicCertNumber: formData.get('organicCertNumber') as string || existingProduct.data?.certifications?.organicCertNumber || null,
      fairTrade: formData.has('fairTrade') ? formData.get('fairTrade') === 'on' : existingProduct.data?.certifications?.fairTrade || false,
      locallyGrown: formData.has('locallyGrown') ? formData.get('locallyGrown') === 'on' : existingProduct.data?.certifications?.locallyGrown || false,
      regenerative: formData.has('regenerative') ? formData.get('regenerative') === 'on' : existingProduct.data?.certifications?.regenerative || false
    }

    const sustainabilityMetrics = {
      ...(existingProduct.data?.sustainabilityMetrics || {}),
      carbonFootprintPerKg: parseFloat(formData.get('carbonFootprint') as string || existingProduct.data?.sustainabilityMetrics?.carbonFootprintPerKg || '0'),
      waterUsagePerKg: parseFloat(formData.get('waterUsage') as string || existingProduct.data?.sustainabilityMetrics?.waterUsagePerKg || '0'),
      packaging: formData.get('packaging') as string || existingProduct.data?.sustainabilityMetrics?.packaging || 'Mixed',
      carbonNegative: formData.has('carbonNegative') ? formData.get('carbonNegative') === 'on' : existingProduct.data?.sustainabilityMetrics?.carbonNegative || false,
      renewableEnergyUsed: formData.has('renewableEnergy') ? formData.get('renewableEnergy') === 'on' : existingProduct.data?.sustainabilityMetrics?.renewableEnergyUsed || false
    }

    const freshness = {
      ...(existingProduct.data?.freshness || {}),
      harvestedAt: formData.get('harvestDate') as string || existingProduct.data?.freshness?.harvestedAt || new Date().toISOString(),
      shelfLifeDays: parseInt(formData.get('shelfLifeDays') as string || existingProduct.data?.freshness?.shelfLifeDays || '30', 10),
      storageTemp: parseFloat(formData.get('storageTemp') as string || '0') || existingProduct.data?.freshness?.storageTemp || null,
      storageInstructions: formData.get('storageInstructions') as string || existingProduct.data?.freshness?.storageInstructions || 'Store in a cool, dry place',
      perishable: formData.has('perishable') ? formData.get('perishable') === 'on' : existingProduct.data?.freshness?.perishable || true
    }

    // Recalculate token prices
    const recalculatedDaarPrice = daarPrice || priceUAH * 10
    const recalculatedDaarionPrice = priceUAH * 0.5
    const recalculatedUsdtPrice = priceUAH / 41

    const tokenEconomy = {
      ...(existingProduct.data?.tokenEconomy || {}),
      daarPrice: recalculatedDaarPrice,
      daarionPrice: recalculatedDaarionPrice,
      usdtPrice: recalculatedUsdtPrice,
      usdPrice: recalculatedUsdtPrice,
      acceptsTokens: true,
      tokenDiscountPercent: 5,
      regenerativeBonus: certifications.regenerative ? 10 : 0,
      daarRewardReason: certifications.regenerative ? 'REGENERATIVE_AGRICULTURE_10PCT' : null
    }

    const listingPatch = buildMainStoreListingPatch({
      submitToMainStore,
      existing: existingProduct,
    })

    const updatedData = flattenProductDocumentForWrite(existingProduct, {
      name,
      description,
      price: priceUAH,
      currency,
      category,
      images: photoUrls,
      stock_quantity: stock,
      stock,
      status: activeInMyStore ? 'active' : 'inactive',
      daarPrice: recalculatedDaarPrice,
      videoUrl,
      ...(generativeGallery ? { generativeGallery } : {}),
      activeInVendorStore: activeInMyStore,
      agriculturalData,
      certifications,
      sustainabilityMetrics,
      freshness,
      tokenEconomy,
      promotions: parseProductPromotionsFromForm(formData),
      ...listingPatch,
      ...(referralCommissionRaw === ''
        ? { referralCommission: undefined }
        : referralCommission !== undefined
          ? { referralCommission }
          : {}),
      ...(rep ? { rep } : { rep: undefined }),
      ...(productAudience ? { productAudience } : {}),
    })

    const updateResult = await db().updateDoc('store_products', productId, updatedData)
    
    if (!updateResult.success) {
      return { error: updateResult.error || 'Failed to update product' }
    }

    localizedRedirect({ locale, href: '/vendor/products' })
    
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('Error updating product:', error)
    }
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }
    return { error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

export async function deleteVendorProduct(productId: string, locale: Locale = defaultLocale as Locale) {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    // Get product
    const productResult = await db().readDoc<Record<string, unknown> & { id: string }>('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const product = productResult.data as Record<string, any>

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || product.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized: This product does not belong to you' }
    }

    // Soft delete - set status to 'discontinued'
    const updateResult = await db().updateDoc('store_products', productId, {
      status: 'discontinued',
      data: {
        ...product.data,
        deletedAt: new Date().toISOString()
      },
      updated_at: new Date()
    })

    if (!updateResult.success) {
      return { error: 'Failed to delete product' }
    }

    // Clean up media files from Vercel Blob (optional - can keep for recovery)
    // Commented out to allow product recovery
    // try {
    //   if (product.images && Array.isArray(product.images)) {
    //     await Promise.all(product.images.map((url: string) => del(url).catch(e => console.error('Cleanup failed:', e))))
    //   }
    //   if (product.data?.videoUrl) {
    //     await del(product.data.videoUrl).catch(e => console.error('Video cleanup failed:', e))
    //   }
    // } catch (e) {
    //   console.error('Media cleanup error:', e)
    // }

    return { success: true, message: 'Product deleted successfully' }
    
  } catch (error) {
    console.error('Error deleting product:', error)
    return { error: error instanceof Error ? error.message : 'Failed to delete product' }
  }
}

  export async function duplicateVendorProduct(productId: string, locale: Locale = defaultLocale) {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    // Get original product
    const productResult = await db().readDoc<Record<string, unknown> & { id: string }>('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const originalProduct = productResult.data as Record<string, any>

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || originalProduct.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized' }
    }

    // Create duplicate
    const newProductId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    
    const duplicateData = {
      ...originalProduct,
      id: newProductId,
      name: `${originalProduct.name} (Copy)`,
      status: 'inactive', // Duplicates start inactive
      data: {
        ...originalProduct.data,
        approvalStatus: null, // Reset approval status
        listStores: [], // Not submitted to Main Store
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      created_at: new Date(),
      updated_at: new Date()
    }

    const result = await db().createDoc('store_products', duplicateData, { id: newProductId })
    
    if (!result.success) {
      return { error: 'Failed to duplicate product' }
    }

    return { success: true, productId: newProductId }
    
  } catch (error) {
    console.error('Error duplicating product:', error)
    return { error: error instanceof Error ? error.message : 'Failed to duplicate product' }
  }
}

export async function toggleProductActive(productId: string) {

  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized' }
    }

    // Get product
    const productResult = await db().readDoc<Record<string, unknown> & { id: string }>('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const product = productResult.data as Record<string, any>

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || product.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized' }
    }

    // Toggle status
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    
    const updateResult = await db().updateDoc('store_products', productId, {
      status: newStatus,
      data: {
        ...product.data,
        activeInVendorStore: newStatus === 'active',
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date()
    })

    if (!updateResult.success) {
      return { error: 'Failed to toggle product status' }
    }

    return { success: true, newStatus }
    
  } catch (error) {
    console.error('Error toggling product status:', error)
    return { error: error instanceof Error ? error.message : 'Failed to toggle status' }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate slug from store name
 * (Helper function, not exported - internal use only)
 */
function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .slice(0, 50) // Max 50 chars
}


// ============================================================================
// Product Custom Fields CRUD — Per-category custom product parameters
// ============================================================================
// User Story: Allow vendors to add custom product fields per-category.
// The CRUD block is shown below the category droplist on the vendor product form.
// All known product custom fields and categories are shipped with SQL migrations
// per preset (see data/migrations/026_product_custom_fields_schema.sql).
// ============================================================================

export interface ProductCustomField {
  id: string
  productId?: string | null
  category: string
  fieldName: string
  fieldValue: string
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select'
  createdAt?: string
  updatedAt?: string
}

/**
 * Create a custom field for a product.
 * The vendor must be the owner of the product (or admin).
 */
/**
 * Create a custom field for a product.
 * The caller must be the vendor who owns the product (or a platform admin).
 * If no productId is provided, the field is created without product linkage
 * (useful for pre-creating category templates before product save).
 */
export async function createProductCustomField(params: {
  productId?: string | null
  category: string
  fieldName: string
  fieldValue: string
  fieldType?: ProductCustomField['fieldType']
}): Promise<{ success: boolean; field?: ProductCustomField; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Vendor access check: only vendors (or admins) can create custom fields.
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity) {
      return { success: false, error: 'Unauthorized: Vendor access required' }
    }

    // If a productId is provided, verify the vendor owns this product.
    if (params.productId) {
      const productResult = await db().readDoc<Record<string, unknown> & { id: string }>('store_products', params.productId)
      if (!productResult.success || !productResult.data) {
        return { success: false, error: 'Product not found' }
      }
      if (resolveVendorEntityId(productResult.data) !== vendorEntity.id) {
        return { success: false, error: 'Unauthorized: This product does not belong to your vendor store' }
      }
    }

    const id = `pcf_${crypto.randomUUID()}`
    const now = new Date().toISOString()
    const field: ProductCustomField = {
      id,
      productId: params.productId ?? null,
      category: params.category,
      fieldName: params.fieldName,
      fieldValue: params.fieldValue,
      fieldType: params.fieldType ?? 'text',
      createdAt: now,
      updatedAt: now,
    }

    const result = await db().createDoc('product_custom_fields', { ...field }, { id })
    if (!result.success) {
      return { success: false, error: result.error?.message ?? 'Failed to create custom field' }
    }

    return { success: true, field }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create custom field' }
  }
}

/**
 * Update an existing custom field.
 * The caller must own the parent product (verified via field → product → vendor chain).
 */
export async function updateProductCustomField(params: {
  fieldId: string
  fieldName?: string
  fieldValue?: string
  fieldType?: ProductCustomField['fieldType']
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Load the existing custom field to verify ownership chain.
    const fieldResult = await db().readDoc<ProductCustomField & Record<string, unknown>>('product_custom_fields', params.fieldId)
    if (!fieldResult.success || !fieldResult.data) {
      return { success: false, error: 'Custom field not found' }
    }
    const existingField = fieldResult.data as ProductCustomField

    // If the field is linked to a product, verify vendor ownership.
    if (existingField.productId) {
      const productResult = await db().readDoc<Record<string, unknown>>('store_products', existingField.productId)
      if (!productResult.success || !productResult.data) {
        return { success: false, error: 'Parent product not found' }
      }
      const vendorEntity = await getVendorEntity(session.user.id)
      if (!vendorEntity || resolveVendorEntityId(productResult.data) !== vendorEntity.id) {
        return { success: false, error: 'Unauthorized: This custom field belongs to another vendor\'s product' }
      }
    } else {
      // Unlinked fields: require vendor access.
      const vendorEntity = await getVendorEntity(session.user.id)
      if (!vendorEntity) {
        return { success: false, error: 'Unauthorized: Vendor access required' }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (params.fieldName !== undefined) updates.fieldName = params.fieldName
    if (params.fieldValue !== undefined) updates.fieldValue = params.fieldValue
    if (params.fieldType !== undefined) updates.fieldType = params.fieldType

    const result = await db().updateDoc('product_custom_fields', params.fieldId, updates)
    if (!result.success) {
      return { success: false, error: result.error?.message ?? 'Failed to update custom field' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update custom field' }
  }
}

/**
 * Delete a custom field.
 * The caller must own the parent product (verified via field → product → vendor chain).
 */
export async function deleteProductCustomField(fieldId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Load the field to verify ownership chain.
    const fieldResult = await db().readDoc<ProductCustomField & Record<string, unknown>>('product_custom_fields', fieldId)
    if (!fieldResult.success || !fieldResult.data) {
      return { success: false, error: 'Custom field not found' }
    }
    const existingField = fieldResult.data as ProductCustomField

    // Verify vendor owns the parent product.
    if (existingField.productId) {
      const productResult = await db().readDoc<Record<string, unknown>>('store_products', existingField.productId)
      if (!productResult.success || !productResult.data) {
        // Orphaned field (product was deleted) — allow deletion.
      } else {
        const vendorEntity = await getVendorEntity(session.user.id)
        if (!vendorEntity || resolveVendorEntityId(productResult.data) !== vendorEntity.id) {
          return { success: false, error: 'Unauthorized: This custom field belongs to another vendor\'s product' }
        }
      }
    } else {
      const vendorEntity = await getVendorEntity(session.user.id)
      if (!vendorEntity) {
        return { success: false, error: 'Unauthorized: Vendor access required' }
      }
    }

    const result = await db().deleteDoc('product_custom_fields', fieldId)
    if (!result.success) {
      return { success: false, error: result.error?.message ?? 'Failed to delete custom field' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete custom field' }
  }
}

/**
 * List custom fields scoped to the caller's vendor store.
 * - If productId is provided, returns only fields for that product
 *   (and verifies the caller owns the product).
 * - Otherwise returns all fields in the given category for the caller's store.
 */
export async function listProductCustomFields(params: {
  productId?: string
  category?: string
  limit?: number
}): Promise<ProductCustomField[]> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity) {
      return []
    }

    // If productId is provided, verify vendor ownership before listing.
    if (params.productId) {
      const productResult = await db().readDoc<Record<string, unknown>>('store_products', params.productId)
      if (!productResult.success || !productResult.data) {
        return []
      }
      if (resolveVendorEntityId(productResult.data) !== vendorEntity.id) {
        return [] // Product not owned by this vendor — return empty
      }
    }

    const filters: Array<{ field: string; operator: string; value: string }> = []
    if (params.productId) {
      filters.push({ field: 'product_id', operator: '==', value: params.productId })
    }
    if (params.category) {
      filters.push({ field: 'category', operator: '==', value: params.category })
    }

    const result = await db().queryDocs<ProductCustomField & Record<string, unknown>>({
      collection: 'product_custom_fields',
      filters: filters.length > 0 ? filters : undefined,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: params.limit ?? 100 },
    })

    if (!result.success || !result.data) {
      return []
    }

    return result.data as ProductCustomField[]
  } catch {
    return []
  }
}

// ============================================================================
// VENDOR PROMOTIONS (checkout special offer)
// ============================================================================

/**
 * Toggle checkout special-offer popup for the authenticated vendor's store.
 * Legacy boolean API — also syncs freeShipping.mode when enabling (always) / disabling (off).
 */
export async function setVendorCheckoutSpecialOffer(
  enabled: boolean,
): Promise<{ success: boolean; error?: string; enabled?: boolean }> {
  return setVendorStorePromotions({
    checkoutSpecialOfferEnabled: Boolean(enabled),
    freeShipping: {
      mode: enabled ? 'always' : 'off',
    },
  })
}

/**
 * Persist vendor storefront promotions (DB JSONB on vendor_profiles).
 * Prefer this over the legacy boolean toggle when setting conditional free shipping.
 */
export async function setVendorStorePromotions(
  patch: VendorStorePromotions,
): Promise<{ success: boolean; error?: string; promotions?: VendorStorePromotions }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity?.id) {
      return { success: false, error: 'Vendor store not found' }
    }
    const profileId = `vendor_${vendorEntity.id}`
    const existing = await db().findDocById<VendorProfile & Record<string, unknown>>(
      STORE_COLLECTIONS.vendorProfiles,
      profileId,
    )
    if (!existing.success || !existing.data) {
      return { success: false, error: 'Vendor profile not found' }
    }

    const prev = (existing.data.promotions || {}) as VendorStorePromotions
    const nextFree = patch.freeShipping
      ? {
          ...(prev.freeShipping || {}),
          ...patch.freeShipping,
          mode: (patch.freeShipping.mode || prev.freeShipping?.mode || 'off') as FreeShippingMode,
        }
      : prev.freeShipping

    const promotions: VendorStorePromotions = {
      ...prev,
      ...patch,
      freeShipping: nextFree,
      checkoutSpecialOfferEnabled:
        patch.checkoutSpecialOfferEnabled !== undefined
          ? Boolean(patch.checkoutSpecialOfferEnabled)
          : nextFree?.mode === 'always' || nextFree?.mode === 'conditional'
            ? true
            : prev.checkoutSpecialOfferEnabled,
    }

    await db().updateDoc(STORE_COLLECTIONS.vendorProfiles, profileId, {
      promotions,
      updatedAt: new Date().toISOString(),
    })
    return { success: true, promotions, enabled: Boolean(promotions.checkoutSpecialOfferEnabled) } as {
      success: boolean
      error?: string
      promotions?: VendorStorePromotions
      enabled?: boolean
    }
  } catch (error) {
    console.error('setVendorStorePromotions failed:', error)
    return { success: false, error: 'Failed to update promotions' }
  }
}

/**
 * True when any listed cart seller has checkout special offer enabled
 * (modal gate and/or free-shipping mode always/conditional).
 * Owner refs may be entity IDs (`ownerEntityId`) or user IDs (`productOwner` /
 * `vendorId`) — same resolution path as store payment routes.
 */
export async function isCheckoutSpecialOfferEnabledForVendors(
  ownerRefs: string[],
): Promise<boolean> {
  const refs = [...new Set(ownerRefs.map((id) => id.trim()).filter(Boolean))]
  if (refs.length === 0) return false

  for (const ref of refs) {
    try {
      const asEntityId = ref.replace(/^vendor_/, '')
      let profile = await getVendorProfile(asEntityId)
      if (!profile) {
        const vendorEntity = await getVendorEntity(ref)
        if (vendorEntity?.id) {
          profile = await getVendorProfile(vendorEntity.id)
        }
      }
      const promo = profile?.promotions
      if (!promo) continue
      if (promo.checkoutSpecialOfferEnabled) return true
      const mode = promo.freeShipping?.mode
      if (mode === 'always' || mode === 'conditional') return true
    } catch {
      /* continue */
    }
  }
  return false
}
