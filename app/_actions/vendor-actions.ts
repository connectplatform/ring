'use server'

/**
 * Vendor Server Actions
 * 
 * All vendor-related server actions for GreenFood.live multi-vendor marketplace:
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
import { redirect } from 'next/navigation'
import { file } from '@/lib/file'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { createVendorProfile } from '@/features/store/services/vendor-lifecycle'
import type { Locale } from '@/i18n-config'

// ============================================================================
// VENDOR ONBOARDING
// ============================================================================

export async function createVendorStore(prevState: any, formData: FormData) {
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
    const locale = (formData.get('locale') as Locale) || 'en'

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
        addRandomSuffix: false
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Logo upload failed')
      }

      logoUrl = result.url
    }

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

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

    const entityResult = await db.create('entities', entityDataWithProfile)

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
    const userResult = await db.read('users', session.user.id)
    if (userResult.success && userResult.data) {
      const userData = userResult.data.data || userResult.data
      const currentRole = userData.role || 'user'
      const roles = currentRole.split(',').map((r: string) => r.trim())
      
      if (!roles.includes('vendor')) {
        roles.push('vendor')
        await db.update('users', session.user.id, {
          role: roles.join(','),
          updatedAt: new Date()
        })
      }
    }

    // Success - redirect to vendor dashboard
    try {
      redirect(`/${locale}/vendor/dashboard`)
    } catch (redirectError) {
      // NEXT_REDIRECT is expected behavior - don't log as error
      if (!(redirectError instanceof Error && redirectError.message.includes('NEXT_REDIRECT'))) {
        console.error('Unexpected redirect error:', redirectError)
      }
      throw redirectError // Re-throw to maintain Next.js behavior
    }

  } catch (error) {
    // Only log actual errors, not redirect exceptions
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

    // Extract form data
    const name = (formData.get('name') as string)?.trim()
    const category = formData.get('category') as string
    const priceUAH = parseFloat(formData.get('priceUAH') as string)
    const stock = parseInt(formData.get('stock') as string, 10)
    const daarPrice = formData.get('daarPrice') ? parseFloat(formData.get('daarPrice') as string) : null
    const description = (formData.get('description') as string)?.trim() || ''
    const activeInMyStore = formData.get('activeInMyStore') === 'true'
    const submitToMainStore = formData.get('submitToMainStore') === 'true'
    const locale = (formData.get('locale') as Locale) || 'en'

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

    // Handle photo uploads (Vercel Blob)
    const photoFiles: File[] = []
    let photoIndex = 0
    while (formData.has(`photo-${photoIndex}`)) {
      const file = formData.get(`photo-${photoIndex}`) as File
      if (file && file.size > 0) {
        photoFiles.push(file)
      }
      photoIndex++
    }

    if (photoFiles.length === 0) {
      return { error: 'At least one photo is required' }
    }
    if (photoFiles.length > 5) {
      return { error: 'Maximum 5 photos allowed' }
    }

    // Validate photos
    for (const photo of photoFiles) {
      if (photo.size > 5 * 1024 * 1024) {
        return { error: 'Photo size must be less than 5MB' }
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(photo.type)) {
        return { error: 'Photos must be JPG, PNG, or WebP' }
      }
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

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Create product ID
    const productId = `product_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Upload photos using our file abstraction layer
    const photoUrls = await Promise.all(
      photoFiles.map(async (photo, index) => {
        const ext = photo.name.split('.').pop() || 'webp'
        const result = await file().upload(`products/${productId}/photo-${index}.${ext}`, photo, {
          access: 'public',
          addRandomSuffix: false
        })
        if (!result.success) {
          throw new Error(result.error || `Failed to upload photo ${index}`)
        }
        return result.url
      })
    )

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

    // Prepare product data
    const productData = {
      id: productId,
      name: name,
      description: description,
      price: priceUAH,
      currency: 'UAH',
      category: category,
      images: photoUrls,
      stock_quantity: stock,
      status: activeInMyStore ? 'active' : 'inactive',
      vendor_id: session.user.id,
      entity_id: vendorEntity.id,
      data: {
        vendorId: vendorEntity.id,
        vendorName: vendorEntity.name,
        vendorTier: (vendorEntity as any).vendorTier || 'NEW',
        commissionRate: (vendorEntity as any).commission || 20,
        daarPrice: daarPrice,
        videoUrl: videoUrl,
        listStores: submitToMainStore ? ['1'] : [], // '1' = Main Store
        approvalStatus: submitToMainStore ? 'pending' : null, // Auto-pending for Main Store
        activeInVendorStore: activeInMyStore,
        slug: `${vendorEntity.storeSlug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        longDescription: '', // Future: AI enrichment
        tags: [], // Future: AI enrichment
        
        // Phase 2: Agricultural ERP fields
        agriculturalData: agriculturalData,
        certifications: certifications,
        sustainabilityMetrics: sustainabilityMetrics,
        freshness: freshness,
        tokenEconomy: tokenEconomy,
        
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      created_at: new Date(),
      updated_at: new Date()
    }

    // Create product in database
    const result = await db.create('store_products', productData)
    
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

    // Success - redirect to products list
    redirect(`/${locale}/vendor/products`)
    
  } catch (error) {
    console.error('Error creating product:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Re-throw redirect errors
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

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Get existing product
    const productResult = await db.read('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const existingProduct = productResult.data.data || productResult.data

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || existingProduct.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized: This product does not belong to you' }
    }

    // Extract updated data
    const name = (formData.get('name') as string)?.trim()
    const category = formData.get('category') as string
    const priceUAH = parseFloat(formData.get('priceUAH') as string)
    const stock = parseInt(formData.get('stock') as string, 10)
    const daarPrice = formData.get('daarPrice') ? parseFloat(formData.get('daarPrice') as string) : null
    const description = (formData.get('description') as string)?.trim() || ''
    const activeInMyStore = formData.get('activeInMyStore') === 'true'
    const submitToMainStore = formData.get('submitToMainStore') === 'true'

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

    // Handle new photo uploads (if any)
    let photoUrls = existingProduct.images || []
    const newPhotoFiles: File[] = []
    let newPhotoIndex = 0
    
    while (formData.has(`new-photo-${newPhotoIndex}`)) {
      const file = formData.get(`new-photo-${newPhotoIndex}`) as File
      if (file && file.size > 0) {
        newPhotoFiles.push(file)
      }
      newPhotoIndex++
    }

    // Upload new photos
    if (newPhotoFiles.length > 0) {
      const newUrls = await Promise.all(
        newPhotoFiles.map(async (photo, index) => {
          const ext = photo.name.split('.').pop() || 'webp'
          const result = await file().upload(
            `products/${productId}/photo-${Date.now()}-${index}.${ext}`,
            photo,
            { access: 'public', addRandomSuffix: false }
          )
          if (!result.success) {
            throw new Error(result.error || `Failed to upload new photo ${index}`)
          }
          return result.url
        })
      )
      photoUrls = [...photoUrls, ...newUrls]
    }

    // Handle photo deletions (if specified)
    const deletedPhotos = formData.get('deletedPhotos') as string
    if (deletedPhotos) {
      const deletedUrls = JSON.parse(deletedPhotos)
      photoUrls = photoUrls.filter((url: string) => !deletedUrls.includes(url))
      
      // Delete using our file abstraction layer
      await Promise.all(deletedUrls.map((url: string) => file().delete(url).catch(e => console.error('Delete failed:', e))))
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

    // Update product data
    const updatedData = {
      name: name,
      description: description,
      price: priceUAH,
      category: category,
      images: photoUrls,
      stock_quantity: stock,
      status: activeInMyStore ? 'active' : 'inactive',
      data: {
        ...existingProduct.data,
        daarPrice: recalculatedDaarPrice,
        videoUrl: videoUrl,
        listStores: submitToMainStore ? ['1'] : [],
        approvalStatus: submitToMainStore ? (existingProduct.data?.approvalStatus || 'pending') : null,
        activeInVendorStore: activeInMyStore,
        
        // Phase 2: Agricultural ERP fields
        agriculturalData: agriculturalData,
        certifications: certifications,
        sustainabilityMetrics: sustainabilityMetrics,
        freshness: freshness,
        tokenEconomy: tokenEconomy,
        
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date()
    }

    const updateResult = await db.update('store_products', productId, updatedData)
    
    if (!updateResult.success) {
      return { error: updateResult.error || 'Failed to update product' }
    }

    // Success - redirect to products list
    redirect(`/${locale}/vendor/products`)
    
  } catch (error) {
    console.error('Error updating product:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }
    return { error: error instanceof Error ? error.message : 'Failed to update product' }
  }
}

export async function deleteVendorProduct(productId: string, locale: Locale = 'en') {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Get product
    const productResult = await db.read('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const product = productResult.data.data || productResult.data

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || product.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized: This product does not belong to you' }
    }

    // Soft delete - set status to 'discontinued'
    const updateResult = await db.update('store_products', productId, {
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

export async function duplicateVendorProduct(productId: string, locale: Locale = 'en') {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: 'Unauthorized: Please sign in' }
    }

    await initializeDatabase()
    const db = getDatabaseService()

    // Get original product
    const productResult = await db.read('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const originalProduct = productResult.data.data || productResult.data

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

    const result = await db.create('store_products', duplicateData)
    
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

    await initializeDatabase()
    const db = getDatabaseService()

    // Get product
    const productResult = await db.read('store_products', productId)
    if (!productResult.success || !productResult.data) {
      return { error: 'Product not found' }
    }

    const product = productResult.data.data || productResult.data

    // Verify ownership
    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity || product.entity_id !== vendorEntity.id) {
      return { error: 'Unauthorized' }
    }

    // Toggle status
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    
    const updateResult = await db.update('store_products', productId, {
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

