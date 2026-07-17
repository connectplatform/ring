// /lib/zod.ts

import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password must be less than 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters long').max(50, 'Name must be less than 50 characters'),
});

export type SignUpData = z.infer<typeof signUpSchema>;

// Store schemas — SSOT for POST /api/store/orders (checkout-client + legacy checkoutInfo)
export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number()]),
  currency: z.enum(['DAAR', 'DAARION', 'UAH', 'USD', 'EUR', 'RING']),
  quantity: z.number().int().positive(),
  selectedVariants: z.record(z.string(), z.string()).optional(),
  finalPrice: z.number().optional(),
  product: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

export const checkoutInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).optional(),
  notes: z.string().max(500).optional().or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  method: z.string().optional(),
  location: z.unknown().optional(),
})

export const shippingLocationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  address: z.string(),
  settlement: z.object({ name: z.string() }).partial().optional(),
}).partial().passthrough()

export const orderCreateSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  // Live checkout-client path
  total: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  shippingInfo: checkoutInfoSchema.optional(),
  billingInfo: z.unknown().optional(),
  // Legacy / alternate path
  totals: z
    .object({
      DAAR: z.number().nonnegative().optional(),
      DAARION: z.number().nonnegative().optional(),
      UAH: z.number().nonnegative().optional(),
      USD: z.number().nonnegative().optional(),
    })
    .optional(),
  checkoutInfo: checkoutInfoSchema.optional(),
  shipping: z
    .object({
      provider: z.enum(['nova-post', 'manual', 'pickup', 'express', 'standard']),
      location: shippingLocationSchema.nullable().optional(),
    })
    .optional(),
  payment: z.object({
    method: z.enum(['wayforpay', 'stripe', 'crypto', 'credit', 'token', 'paypal', 'card']),
    status: z.enum(['pending', 'paid', 'failed', 'processing']),
  }),
  status: z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled']),
}).superRefine((data, ctx) => {
  if (!data.shippingInfo && !data.checkoutInfo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'shippingInfo or checkoutInfo is required',
      path: ['shippingInfo'],
    })
  }
})

export {
  STORE_PRODUCT_CATEGORIES,
  storeProductCategorySchema,
  storeProductFormFieldsSchema,
  adminStoreProductListQuerySchema,
  adminStoreProductApprovalSchema,
  adminStoreProductCreateSchema,
  adminStoreProductUpdateSchema,
  adminStoreProductDelistSchema,
  parseStoreProductFormData,
  type StoreProductFormFields,
} from '@/lib/zod/store-product'
