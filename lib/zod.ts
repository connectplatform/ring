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

// Store schemas
export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(['DAAR', 'DAARION']),
  quantity: z.number().int().positive(),
})

export const checkoutInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')).optional(),
  notes: z.string().max(500).optional().or(z.literal('')).optional(),
})

export const shippingLocationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  address: z.string(),
  settlement: z.object({ name: z.string() }).partial().optional(),
}).partial().passthrough()

export const orderCreateSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  totals: z.object({ DAAR: z.number().nonnegative().optional(), DAARION: z.number().nonnegative().optional() }),
  checkoutInfo: checkoutInfoSchema,
  shipping: z.object({ provider: z.enum(['nova-post', 'manual', 'pickup']), location: shippingLocationSchema.nullable().optional() }).optional(),
  payment: z.object({ method: z.enum(['stripe', 'crypto']), status: z.enum(['pending', 'paid', 'failed']) }),
  status: z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'])
})
