import { z } from 'zod'
import {
  convertFromMainCurrency,
  convertToMainCurrency,
  getMainCurrencySymbol,
  getSupportedCrypto,
  getSupportedCurrencies,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import { ProductFieldsPreset } from '../ring-config-types'
import type { StorePaymentMethods } from '@/features/store/types'

export type { StorePaymentMethods }

// ---------------------------------------------------------------------------
// Store payment method codes — derived from ring-config SSOT
// Fiat: supportedCurrencies (presentment) → currencies[].symbol
// Crypto: tokens.supported (NOT supportedChains — that is chain ids)
// ---------------------------------------------------------------------------

const FIAT_CURRENCIES = getSupportedCurrencies()
const TOKEN_CURRENCIES = getSupportedCrypto()
const _storePaymentCodes = [
  ...FIAT_CURRENCIES,
  ...TOKEN_CURRENCIES,
] as StorePaymentMethods[]

/** Runtime allow-list for product pricing codes. */
export const STORE_CURRENCIES = (
  _storePaymentCodes.length > 0
    ? _storePaymentCodes
    : [getMainCurrencySymbol()]
) as [StorePaymentMethods, ...StorePaymentMethods[]]

/** Validate that a currency code is in the supported store currencies list. */
export function isStorePaymentMethods(code: string): code is StorePaymentMethods {
  return (STORE_CURRENCIES as readonly string[]).includes(code)
}

/**
 * Currency display symbol. `Intl` owns the symbol table for every fiat, so a
 * clone in any currency renders correctly; tokens fall back to their ticker.
 */
export function getCurrencySymbol(currency: string): string {
  const code = String(currency || '').toUpperCase()
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {
    return code // not a fiat code — crypto tokens display their ticker
  }
}

/**
 * Products are stored in the project main currency (`store.mainCurrency`).
 * Both directions bridge through the configured `exchangeRates` — never a
 * hardcoded pair.
 */
export function normalizePriceToMainCurrency(price: number, currency: string): number {
  return convertToMainCurrency(price, currency)
}

/** Render a stored main-currency price in the buyer's selected currency. */
export function displayPriceFromMainCurrency(price: number, currency: string): number {
  return convertFromMainCurrency(price, currency)
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
  currency: z.enum(STORE_CURRENCIES).default(getMainCurrencySymbol()),
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
  currency: z.enum(STORE_CURRENCIES).default(getMainCurrencySymbol()),
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
  const currencyRaw = ((formData.get('currency') as string | null)?.trim()) || (getMainCurrencySymbol())
  const currency = isStorePaymentMethods(currencyRaw) ? currencyRaw : (getMainCurrencySymbol())

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
