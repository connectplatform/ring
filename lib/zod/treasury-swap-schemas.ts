import { z } from 'zod'

export const TreasurySwapQuoteRequestSchema = z.object({
  fromTokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amountIn: z
    .string()
    .refine((v) => {
      const n = parseFloat(v)
      return Number.isFinite(n) && n > 0
    }, 'Amount must be a positive number'),
  signInAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sign-in address'),
})

export const TreasurySwapExecuteRequestSchema = z.object({
  quoteToken: z.string().min(10),
  depositTxHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid deposit tx hash'),
  signInAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid sign-in address'),
})

export type TreasurySwapQuoteRequest = z.infer<typeof TreasurySwapQuoteRequestSchema>
export type TreasurySwapExecuteRequest = z.infer<typeof TreasurySwapExecuteRequestSchema>
