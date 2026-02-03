/**
 * GreenFood.live Agricultural Product Schema
 * 
 * Comprehensive product schema with 80+ fields for:
 * - Origin & Traceability (FSMA 204 compliant)
 * - Certifications & Standards
 * - Farming Methods & Sustainability
 * - Freshness & Quality Control
 * - Token Economy (DAAR/DAARION)
 * - AI Insights
 */

import { StoreProduct } from '@/features/store/types'

// ============================================================================
// AGRICULTURAL PRODUCT SCHEMA (80+ fields)
// ============================================================================

export interface AgriculturalProduct extends StoreProduct {
  // ============================================================================
  // ORIGIN & TRACEABILITY (10 fields) - FSMA 204 Compliant
  // ============================================================================
  origin: {
    farm: string // Farm/producer name
    farmId: string // GreenFood.live farm entity ID
    location: {
      lat: number
      lng: number
      address: string
      region: string
      country: string
    }
    harvestDate: string // ISO date
    batchNumber: string // Internal batch tracking
    traceabilityCode: string // FSMA 204 TLC (Traceability Lot Code)
    globalLocationNumber: string // GLN (13-digit)
    blockchainHash?: string // Blockchain transaction hash
    iotDeviceId?: string // IoT sensor device ID
    distanceFromBuyer?: number // Calculated dynamically (km)
  }

  // ============================================================================
  // CERTIFICATIONS (8 fields)
  // ============================================================================
  certifications: {
    organic?: 'USDA' | 'EU-Organic' | 'Biodynamic' | 'Other'
    organicCertNumber?: string
    fairTrade?: boolean
    fairTradeCertNumber?: string
    gmo: 'Non-GMO' | 'GMO-Free-Verified' | 'Conventional'
    locallyGrown?: boolean // < 100km from market
    regenerative?: boolean // Regenerative agriculture certified
    animalWelfare?: 'Certified-Humane' | 'Animal-Welfare-Approved' | null
    globalGAP?: boolean // GlobalG.A.P. certification
    kosher?: boolean
    halal?: boolean
    glutenFree?: boolean
  }

  // ============================================================================
  // FARMING METHODS (5 fields)
  // ============================================================================
  farmingMethods: (
    | 'Organic'
    | 'Conventional'
    | 'Regenerative'
    | 'Biodynamic'
    | 'Permaculture'
    | 'Hydroponic'
    | 'Aquaponic'
    | 'Vertical-Farm'
  )[]
  pesticidesUsed: boolean
  syntheticFertilizers: boolean
  grazingMethod?: 'Rotational' | 'Continuous' | 'Holistic' | 'Pasture-Raised'
  irrigationMethod?: 'Drip' | 'Sprinkler' | 'Flood' | 'Rain-fed' | 'Mixed'

  // ============================================================================
  // FRESHNESS (8 fields)
  // ============================================================================
  freshness: {
    harvestedAt: Date // Exact harvest timestamp
    processingDate?: Date // If processed
    bestBefore: Date // Best before date
    shelfLifeDays: number // Shelf life in days
    storageTemp?: number // Celsius
    storageHumidity?: number // Percent
    storageInstructions: string // Storage instructions
    perishable: boolean // Is perishable?
    daysFromHarvest?: number // Calculated field
  }

  // ============================================================================
  // NUTRITION (10 fields)
  // ============================================================================
  nutrition?: {
    calories: number // Per serving
    servingSize: string // e.g., "100g"
    protein: number // grams
    carbohydrates: number // grams
    fats: number // grams
    fiber: number // grams
    sugar?: number // grams
    sodium?: number // mg
    vitamins: Record<string, string> // e.g., { "A": "15% DV", "C": "80% DV" }
    minerals: Record<string, string> // e.g., { "Iron": "10% DV", "Calcium": "20% DV" }
    ingredients: string[] // List of ingredients
    allergens: string[] // Allergen warnings
    nutritionScore?: number // 0-100 calculated score
  }

  // ============================================================================
  // SUSTAINABILITY (10 fields)
  // ============================================================================
  sustainability: {
    carbonFootprint: number // kg CO2
    carbonFootprintPerKg: number // kg CO2 per kg of product
    waterUsage: number // liters
    waterUsagePerKg: number // liters per kg
    soilHealthImpact: number // -100 (negative) to +100 (positive)
    biodiversityImpact: number // -100 to +100
    packaging: 'Plastic-free' | 'Recyclable' | 'Compostable' | 'Reusable' | 'Mixed'
    packagingMaterial: string // Description of packaging
    transportEmissions: number // kg CO2 from transport
    localImpact: string // Description of local community impact
    carbonNegative?: boolean // Carbon negative product?
    renewableEnergyUsed?: boolean // Produced with renewable energy?
  }

  // ============================================================================
  // SEASONALITY (6 fields)
  // ============================================================================
  seasonality: {
    inSeason: boolean // Currently in season?
    peakSeason: string[] // Months e.g., ["June", "July", "August"]
    availability: 'year-round' | 'seasonal' | 'limited'
    nextHarvest?: Date // Next expected harvest
    preOrderAvailable: boolean // Can pre-order for next season?
    seasonalPrice: boolean // Price varies by season?
  }

  // ============================================================================
  // QUALITY (8 fields)
  // ============================================================================
  quality: {
    grade: 'A' | 'B' | 'C' | 'Premium' | 'Standard' // Quality grade
    appearance: string // Visual quality description
    taste: string // Taste profile description
    texture: string // Texture description
    aiQualityScore?: number // 0-100 AI-calculated quality
    inspectionDate?: Date // Last quality inspection
    qualityNotes?: string // Additional quality notes
    customerRating?: number // 1-5 average customer rating
    defectRate?: number // % of defects (lower is better)
  }

  // ============================================================================
  // FSMA 204 TRACEABILITY (15 fields)
  // ============================================================================
  traceability: {
    // Critical Tracking Events (CTEs)
    traceabilityLotCode: string // TLC (YYYY-MM-DD-FARM-BATCH)
    globalLocationNumber: string // GLN (13-digit)
    harvestDate: Date // Date of harvest
    harvestCoordinates: { lat: number; lng: number } // GPS coordinates
    harvesterInfo: {
      name: string
      license?: string
      contact: string
    }

    // Key Data Elements (KDEs)
    productDescription: string // Full product description
    quantity: number // Quantity harvested/processed
    unit: string // Unit of measurement
    packagingDate?: Date // Date of packaging
    coolDate?: Date // Initial cooling date
    shipDate?: Date // Shipping date
    receiveDate?: Date // Receiving date
    transformationDate?: Date // Processing/transformation date

    // Temperature Log (Cold Chain)
    temperatureLog?: Array<{
      timestamp: Date
      temperature: number // Celsius
      location: string
    }>

    // Blockchain Integration
    blockchainHash?: string // Transaction hash on blockchain
    blockchainNetwork?: 'ethereum' | 'polygon' | 'arbitrum' | 'optimism'
    smartContractAddress?: string // Traceability smart contract
    blockNumber?: number // Block number
    transactionIndex?: number // Transaction index in block

    // Compliance
    fsmaCompliant: boolean // FSMA 204 compliant?
    complianceVerified: boolean // Verified by authority?
    complianceDate?: Date // Date of compliance verification
  }

  // ============================================================================
  // TOKEN ECONOMY (8 fields) - DAAR/DAARION Integration
  // ============================================================================
  tokenEconomy: {
    daarPrice: number // Price in DAAR tokens
    daarionPrice: number // Price in DAARION tokens
    usdtPrice: number // Price in USDT stablecoin
    usdPrice: number // Price in USD (fiat)
    acceptsTokens: boolean // Accepts token payments?
    tokenDiscountPercent?: number // e.g., 5% off with DAAR
    regenerativeBonus?: number // Bonus DAAR for regenerative products
    stakingRewards?: number // DAARION rewards for purchases
    carbonOffsetTokens?: number // Auto-generated carbon credits
    daarRewardReason?: string // Why DAAR rewards given
    daarionRewardReason?: string // Why DAARION rewards given
  }

  // ============================================================================
  // AI INSIGHTS (5 fields)
  // ============================================================================
  aiInsights?: {
    demandForecast: 'high' | 'medium' | 'low' // AI demand prediction
    priceRecommendation: number // AI price recommendation
    similarProducts: string[] // Similar product IDs
    recommendedPairings: string[] // Recommended product pairings
    marketTrends: string // Market trend analysis
    optimalHarvestWindow?: string // AI-calculated optimal harvest
    yieldPrediction?: number // AI yield prediction
  }

  // ============================================================================
  // VENDOR INTEGRATION (5 fields)
  // ============================================================================
  vendor: {
    vendorId: string // GreenFood.live vendor ID
    vendorName: string // Farm/producer name
    vendorType: 'farm' | 'food-producer' | 'farmers-market' | 'artisan' | 'cooperative'
    dagiAgentId?: string // DAARION.city DAGI agent ID
    dagiAgentTier?: 1 | 2 | 3 // DAGI agent tier
    verificationStatus: 'unverified' | 'pending' | 'verified' | 'premium'
    verificationBadges: string[] // e.g., ["Organic Certified", "Fair Trade", "Carbon Negative"]
    memberSince: Date // Vendor member since date
    responseTime?: number // Average response time (hours)
    fulfillmentRate?: number // Order fulfillment rate (%)
  }

  // ============================================================================
  // SUPPLY CHAIN (8 fields)
  // ============================================================================
  supplyChain: {
    distributionRadius: number // km
    deliveryMethods: ('Own transport' | 'Third-party courier' | 'Farmers market' | 'Pickup' | 'Mail')[]
    minimumOrder?: number // Minimum order quantity
    leadTime: number // Order lead time (days)
    coldChainRequired: boolean // Requires cold chain?
    packagingOptions: string[] // Available packaging options
    bulkAvailable: boolean // Bulk orders available?
    wholesaleAvailable: boolean // Wholesale pricing available?
    csaProgram?: boolean // CSA program available?
    farmPickupAvailable?: boolean // Farm pickup available?
  }

  // ============================================================================
  // COMMUNITY & IMPACT (6 fields)
  // ============================================================================
  community: {
    localJobsSupported: number // Jobs supported by this product
    communityImpactScore: number // 0-100 community impact
    farmVisitsEnabled: boolean // Farm tours available?
    educationalContent?: string // Educational content about product
    story?: string // Producer's story
    farmingPractices?: string // Detailed farming practices
    socialMediaLinks?: {
      facebook?: string
      instagram?: string
      twitter?: string
      website?: string
    }
  }

  // ============================================================================
  // REVIEW & RATINGS (5 fields)
  // ============================================================================
  reviews: {
    averageRating: number // 1-5 stars
    totalReviews: number // Total number of reviews
    fiveStarCount: number
    fourStarCount: number
    threeStarCount: number
    twoStarCount: number
    oneStarCount: number
    verifiedPurchaseReviews: number // Reviews from verified purchases
    lastReviewDate?: Date // Date of last review
  }
}

// ============================================================================
// TOKEN REWARD CALCULATION
// ============================================================================

export interface TokenRewards {
  daarBonus: number // DAAR token bonus
  daarionBonus: number // DAARION token bonus
  reasonCodes: string[] // Why rewards given
  expiresAt: Date // Reward expiry date
}

export function calculateRegenerativeBonus(
  product: AgriculturalProduct,
  purchaseAmount: number
): TokenRewards {
  let daarBonus = 0
  let daarionBonus = 0
  const reasonCodes: string[] = []

  // Organic farming: 5% DAAR bonus
  if (product.certifications.organic) {
    daarBonus += purchaseAmount * 0.05
    reasonCodes.push('ORGANIC_FARMING_5PCT')
  }

  // Regenerative agriculture: 10% DAAR bonus
  if (product.farmingMethods.includes('Regenerative')) {
    daarBonus += purchaseAmount * 0.10
    reasonCodes.push('REGENERATIVE_AGRICULTURE_10PCT')
  }

  // Local supply chain (<100km): 3% DAAR bonus
  if (product.origin.distanceFromBuyer && product.origin.distanceFromBuyer < 100) {
    daarBonus += purchaseAmount * 0.03
    reasonCodes.push('LOCAL_SUPPLY_CHAIN_3PCT')
  }

  // Zero waste packaging: 7% DAAR bonus
  if (
    product.sustainability.packaging === 'Compostable' ||
    product.sustainability.packaging === 'Reusable'
  ) {
    daarBonus += purchaseAmount * 0.07
    reasonCodes.push('ZERO_WASTE_PACKAGING_7PCT')
  }

  // Carbon negative farming: 15% DAAR bonus
  if (product.sustainability.carbonNegative) {
    daarBonus += purchaseAmount * 0.15
    reasonCodes.push('CARBON_NEGATIVE_15PCT')
  }

  // Blockchain traceability: 100 DAARION bonus
  if (product.traceability.blockchainHash) {
    daarionBonus += 100
    reasonCodes.push('BLOCKCHAIN_TRACEABILITY_100DAARION')
  }

  // IoT sensor integration: 50 DAARION bonus
  if (product.origin.iotDeviceId) {
    daarionBonus += 50
    reasonCodes.push('IOT_SENSORS_50DAARION')
  }

  // FSMA 204 compliance: 75 DAARION bonus
  if (product.traceability.fsmaCompliant) {
    daarionBonus += 75
    reasonCodes.push('FSMA_204_COMPLIANCE_75DAARION')
  }

  // Fair Trade: 5% DAAR bonus
  if (product.certifications.fairTrade) {
    daarBonus += purchaseAmount * 0.05
    reasonCodes.push('FAIR_TRADE_5PCT')
  }

  // Animal Welfare: 3% DAAR bonus
  if (product.certifications.animalWelfare) {
    daarBonus += purchaseAmount * 0.03
    reasonCodes.push('ANIMAL_WELFARE_3PCT')
  }

  // Renewable energy: 4% DAAR bonus
  if (product.sustainability.renewableEnergyUsed) {
    daarBonus += purchaseAmount * 0.04
    reasonCodes.push('RENEWABLE_ENERGY_4PCT')
  }

  return {
    daarBonus,
    daarionBonus,
    reasonCodes,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }
}

// ============================================================================
// FSMA 204 TRACEABILITY LOT CODE GENERATION
// ============================================================================

export function generateTraceabilityLotCode(product: AgriculturalProduct): string {
  // Format: YYYY-MM-DD-FARM-BATCH
  const date = new Date(product.origin.harvestDate)
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const farmCode = product.origin.farmId.slice(0, 6).toUpperCase()
  const batch = product.origin.batchNumber.padStart(4, '0')

  return `${dateStr}-${farmCode}-${batch}`
}

// ============================================================================
// PRODUCT FILTERING & SEARCH
// ============================================================================

export interface AgriculturalProductFilters {
  // Origin filters
  maxDistance?: number // Max distance from buyer (km)
  region?: string[]
  country?: string[]

  // Certification filters
  organic?: boolean
  fairTrade?: boolean
  nonGMO?: boolean
  locallyGrown?: boolean
  regenerative?: boolean
  animalWelfare?: boolean

  // Farming method filters
  farmingMethods?: string[]
  noPesticides?: boolean
  noSyntheticFertilizers?: boolean

  // Sustainability filters
  carbonNegative?: boolean
  plasticFreePackaging?: boolean
  renewableEnergy?: boolean
  minBiodiversityIndex?: number
  minSoilHealthScore?: number

  // Seasonality filters
  inSeasonOnly?: boolean
  availability?: ('year-round' | 'seasonal' | 'limited')[]

  // Quality filters
  minGrade?: 'A' | 'B' | 'C'
  minCustomerRating?: number
  minQualityScore?: number

  // Traceability filters
  blockchainTraceability?: boolean
  fsmaCompliant?: boolean
  iotSensors?: boolean

  // Token economy filters
  acceptsTokens?: boolean
  hasRegenerativeBonus?: boolean

  // Price filters
  minPrice?: number
  maxPrice?: number
  currency?: 'USD' | 'DAAR' | 'DAARION' | 'USDT'

  // Vendor filters
  vendorTypes?: ('farm' | 'food-producer' | 'farmers-market' | 'artisan' | 'cooperative')[]
  verifiedVendorsOnly?: boolean
  hasDagiAgent?: boolean

  // Supply chain filters
  maxLeadTime?: number
  deliveryMethods?: string[]
  bulkAvailable?: boolean
  wholesaleAvailable?: boolean
}

// ============================================================================
// PRODUCT STATISTICS
// ============================================================================

export interface AgriculturalProductStats {
  totalProducts: number
  organicProducts: number
  regenerativeProducts: number
  carbonNegativeProducts: number
  blockchainTracedProducts: number
  fsmaCompliantProducts: number
  averageDistance: number // km
  averageQualityScore: number
  totalCarbonOffset: number // kg CO2
  totalWaterSaved: number // liters
  farmersSupported: number
  jobsCreated: number
}

export default AgriculturalProduct

