import { z } from 'zod'

export const STORE_CURRENCIES = ['UAH', 'DAAR'] as const
export type StoreCurrency = (typeof STORE_CURRENCIES)[number]

/** 1 UAH = 0.025 DAAR — matches features/store/currency-context.tsx */
const DAAR_PER_UAH = 0.025

export function getCurrencySymbol(currency: StoreCurrency): string {
  return currency === 'UAH' ? '₴' : 'DAAR'
}

/** Normalize entered price to canonical UAH storage. */
export function normalizePriceToUah(price: number, currency: StoreCurrency): number {
  if (currency === 'UAH') return price
  return price / DAAR_PER_UAH
}

/** Display price in the user's selected currency from stored UAH. */
export function displayPriceFromUah(priceUah: number, currency: StoreCurrency): number {
  if (currency === 'UAH') return priceUah
  return priceUah * DAAR_PER_UAH
}

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]*$/, 'Invalid username')
  .max(64)

export const STORE_PRODUCT_CATEGORIES = [
  'organic-produce',
  'honey-sweets',
  'essential-oils',
  'dairy-eggs',
  'meat-poultry',
  'herbs-spices',
  'grains-legumes',
  'baked-goods',
  'preserves-pickles',
  'beverages',
  'nuts-seeds',
  'handmade-crafts',
] as const

export const storeProductCategorySchema = z.enum(STORE_PRODUCT_CATEGORIES)

export const storeProductFormFieldsSchema = z.object({
  name: z.string().trim().min(3).max(100),
  category: storeProductCategorySchema,
  priceUAH: z.coerce.number().positive(),
  currency: z.enum(STORE_CURRENCIES).default('UAH'),
  stock: z.coerce.number().int().min(0),
  description: z.string().trim().max(200).optional().default(''),
  activeInMyStore: z.coerce.boolean(),
  submitToMainStore: z.coerce.boolean(),
  referralCommission: z.coerce.number().min(0).max(50).optional(),
  daarPrice: z.coerce.number().positive().optional().nullable(),
  rep: usernameSchema.optional().default(''),
})

export type StoreProductFormFields = z.infer<typeof storeProductFormFieldsSchema>

export const adminStoreProductListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  approvalStatus: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
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
  const currencyRaw = (formData.get('currency') as string | null)?.trim() || 'UAH'
  const currency = currencyRaw === 'DAAR' ? 'DAAR' : 'UAH'
  const rawPrice = Number(formData.get('priceUAH'))
  const priceUAH = normalizePriceToUah(rawPrice, currency)

  return storeProductFormFieldsSchema.parse({
    name: formData.get('name'),
    category: formData.get('category'),
    priceUAH,
    currency,
    stock: formData.get('stock'),
    description: formData.get('description') ?? '',
    activeInMyStore: formData.get('activeInMyStore') === 'true',
    submitToMainStore: formData.get('submitToMainStore') === 'true',
    referralCommission: referralRaw ? referralRaw : undefined,
    daarPrice: formData.get('daarPrice') || undefined,
    rep: (formData.get('rep') as string | null)?.trim() ?? '',
  })
}
