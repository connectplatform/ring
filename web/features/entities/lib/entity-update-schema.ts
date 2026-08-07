import { z } from 'zod'

/** Shared partial-update schema for PATCH /api/entities/{id}. */
export const entityPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    shortDescription: z.string().min(1).optional(),
    visibility: z.enum(['public', 'subscriber', 'member', 'confidential']).optional(),
    isConfidential: z.boolean().optional(),
  })
  .passthrough()
