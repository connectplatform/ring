import { z } from 'zod'

export const futureFeatureWidgetSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  implementationCost: z.number().int().min(0),
  labels: z.array(z.string().min(1)).default([]),
  /** @deprecated Live count from public_pools — kept for MDX compat */
  voteCount: z.number().int().min(0).default(0).optional(),
  poolSlug: z.string().min(1).optional(),
})

export type FutureFeatureWidgetData = z.infer<typeof futureFeatureWidgetSchema>
