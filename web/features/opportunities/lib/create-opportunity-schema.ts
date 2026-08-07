import { z } from 'zod'

/**
 * Shared create-opportunity body schema for REST + MCP.
 * Service applies deeper business rules after this gate.
 */
export const createOpportunityBodySchema = z
  .object({
    title: z.string().min(1, 'title is required'),
    briefDescription: z.string().min(1, 'briefDescription is required'),
    organizationId: z.string().min(1, 'organizationId is required'),
    category: z.string().min(1, 'category is required'),
    location: z.string().min(1, 'location is required'),
    visibility: z.enum(['public', 'subscriber', 'member', 'confidential']),
    contactInfo: z.object({
      linkedEntity: z.string().min(1, 'contactInfo.linkedEntity is required'),
      contactAccount: z.string().min(1, 'contactInfo.contactAccount is required'),
    }),
    type: z.string().optional(),
    isConfidential: z.boolean().optional(),
    fullDescription: z.string().optional(),
    status: z.enum(['draft', 'pending', 'active', 'closed', 'expired', 'archived']).optional(),
    tags: z.array(z.string()).optional(),
    requiredSkills: z.array(z.string()).optional(),
    requiredDocuments: z.array(z.string()).optional(),
    attachments: z.array(z.object({ url: z.string(), name: z.string() })).optional(),
    budget: z
      .object({
        min: z.number().optional(),
        max: z.number(),
        currency: z.string().optional(),
      })
      .optional(),
    priority: z.enum(['urgent', 'normal', 'low']).optional(),
    maxApplicants: z.number().optional(),
    isPrivate: z.boolean().optional(),
  })
  .passthrough()

export type CreateOpportunityBody = z.infer<typeof createOpportunityBodySchema>
