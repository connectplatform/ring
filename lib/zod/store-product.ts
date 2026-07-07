import { z } from 'zod'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { ProductFieldsPreset } from '../ring-config-types'

// ---------------------------------------------------------------------------
// Store currencies — derived from ring-config SSOT
// ---------------------------------------------------------------------------

/** Read supported currencies from ring-config at module init time (synchronous). */
const configCurrencies = getSystemConfigSnapshot()
const TOKEN_CURRENCIES = configCurrencies.supportedChains ?? ['RING']
const FIAT_CURRENCIES = configCurrencies.supportedCurrencies ?? ['USD']
export const STORE_CURRENCIES = [...FIAT_CURRENCIES, ...TOKEN_CURRENCIES] as const
export type StoreCurrency = (typeof STORE_CURRENCIES)[number]

// ---------------------------------------------------------------------------
// Currency conversion — TODO: migrate to oracle-based rates
// Rely on the native token oracle (ring-token-oracle) for conversion rates.
// ---------------------------------------------------------------------------

/** Validate that a currency code is in the supported store currencies list. */
export function isStoreCurrency(code: string): code is StoreCurrency {
  return (STORE_CURRENCIES as readonly string[]).includes(code)
}

/** Get currency display symbol. */
export function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case 'UAH': return '₴'
    case 'USD': return '$'
    case 'EUR': return '€'
    default: return currency // crypto tokens use their ticker as display
  }
}

/**
 * Legacy helpers for currency conversion to/from canonical storage (UAH).
 * @deprecated Use StoreCurrencyContext.convertPrice() for all currency conversions.
 * These helpers assume UAH as canonical storage — which is the ring-platform default.
 */
const DAAR_PER_UAH = 0.027
const USD_PER_UAH = 0.025

/** Normalize entered price to canonical UAH storage (legacy). */
export function normalizePriceToUah(price: number, currency: string): number {
  switch (currency) {
    case 'UAH': return price
    case 'USD': return price / USD_PER_UAH
    default: return price
  }
}

/** Display price in the user's selected currency from stored UAH (legacy). */
export function displayPriceFromUah(priceUah: number, currency: string): number {
  switch (currency) {
    case 'UAH': return priceUah
    case 'USD': return priceUah * USD_PER_UAH
    default: return priceUah
  }
}

// ---------------------------------------------------------------------------
// Product form schema — canonical price stored in project base currency
// ---------------------------------------------------------------------------

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]*$/, 'Invalid username')
  .max(64)

export const STORE_PRODUCT_CATEGORIES = (
  getSystemConfigSnapshot().store?.storeCategories ??
  []
) as readonly ProductFieldsPreset[number][]

export const storeProductCategorySchema = z.enum(STORE_PRODUCT_CATEGORIES as readonly string[])

export const storeProductFormFieldsSchema = z.object({
  name: z.string().trim().min(3).max(100),
  category: storeProductCategorySchema,
  price: z.coerce.number().positive(),
  currency: z.enum(STORE_CURRENCIES).default(FIAT_CURRENCIES[0] ?? 'USD'),
  stock: z.coerce.number().int().min(0),
  description: z.string().trim().max(500).optional().default(''),
  activeInMyStore: z.coerce.boolean(),
  submitToMainStore: z.coerce.boolean(),
  referralCommission: z.coerce.number().min(0).max(50).optional(),
  priceOverride: z
    .record(z.string(), z.coerce.number().positive().optional().nullable())
    .optional()
    .default({}),
  rep: usernameSchema.optional().default(''),
})

export type StoreProductFormFields = z.infer<typeof storeProductFormFieldsSchema>

export const adminStoreProductListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  approvalStatus: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
  currency: z.enum(STORE_CURRENCIES).default(FIAT_CURRENCIES[0] ?? 'USD'),
})

export const adminStoreProductApprovalSchema = z.object({
  productId: z.string().min(1),
  approvalStatus: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().max(500).optional(),
})

export const adminStoreProductCreateSchema = storeProductFormFieldsSchema.extend({
  vendorEntityId: z.string().min(1),
})

export const adminStoreProductUpdateSchema = storeProductFormFieldsSchema.extend({
  productId: z.string().min(1),
  vendorEntityId: z.string().min(1),
})

export const adminStoreProductDelistSchema = z.object({
  productId: z.string().min(1),
})

/** Parse boolean fields from FormData string values. */
export function parseStoreProductFormData(formData: FormData) {
  const referralRaw = (formData.get('referralCommission') as string | null)?.trim()
  const currencyRaw = ((formData.get('currency') as string | null)?.trim()) || (FIAT_CURRENCIES[0] ?? 'USD')
  const currency = isStoreCurrency(currencyRaw) ? currencyRaw : (FIAT_CURRENCIES[0] ?? 'USD')

  return storeProductFormFieldsSchema.parse({
    name: formData.get('name'),
    category: formData.get('category'),
    price: formData.get('price'),
    currency,
    stock: formData.get('stock'),
    description: formData.get('description') ?? '',
    activeInMyStore: formData.get('activeInMyStore') === 'true',
    submitToMainStore: formData.get('submitToMainStore') === 'true',
    referralCommission: referralRaw ? referralRaw : undefined,
    priceOverride: {},
    rep: (formData.get('rep') as string | null)?.trim() ?? '',
  })
}
