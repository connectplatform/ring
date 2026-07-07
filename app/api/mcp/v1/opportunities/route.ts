import { z } from 'zod'
import { assertKnownUserRole } from '@/features/auth/user-role'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { createOpportunity } from '@/features/opportunities/services/create-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// ---------------------------------------------------------------------------
// Create-opportunity schema — validates required fields at the route layer
// before they reach the service.  Fields with service defaults are optional;
// fields the client MUST send are required.  .passthrough() allows extras.
//
// Required by NewOpportunityData (no service default):
//   title, briefDescription, organizationId, category, location, visibility,
//   contactInfo { linkedEntity, contactAccount }
//
// Optional (service provides defaults):
//   type (→'offer'), isConfidential (→false), tags (→[]), requiredSkills (→[]),
//   requiredDocuments (→[]), attachments (→[]), applicantCount (→0), status
// ---------------------------------------------------------------------------
const createOpportunitySchema = z.object({
  // Required — no service default
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

  // Optional — service provides defaults
  type: z.string().optional(),
  isConfidential: z.boolean().optional(),
  fullDescription: z.string().optional(),
  status: z.enum(['draft', 'pending', 'active', 'closed', 'expired', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  requiredDocuments: z.array(z.string()).optional(),
  attachments: z.array(z.object({ url: z.string(), name: z.string() })).optional(),
  budget: z.object({
    min: z.number().optional(),
    max: z.number(),
    currency: z.string().optional(),
  }).optional(),
  priority: z.enum(['urgent', 'normal', 'low']).optional(),
  maxApplicants: z.number().optional(),
  isPrivate: z.boolean().optional(),
}).passthrough()

// Handles GET requests to fetch opportunities according to the requesting user's role and query params.
export const GET = withMcpGuard(async (request, actor) => {
  // Validate the user role; throws if the role is not recognized
  const userRole = assertKnownUserRole(actor.role)

  // Parse query parameters for pagination and search
  const limit = queryInt(request, 'limit', 20)
  const startAfter = queryString(request, 'startAfter')
  const query = queryString(request, 'search')

  // Fetch the list of opportunities available to the given role and query
  const result = await getOpportunitiesForRole({
    userRole,
    limit,
    startAfter,
    query,
  })

  return mcpOk(result)
})

// Handles POST requests to create a new opportunity from the request body.
export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const parsed = createOpportunitySchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  // Cast is safe — Zod verified required fields; service handles deeper validation
  const opportunity = await createOpportunity(parsed.data as Parameters<typeof createOpportunity>[0])
  return mcpOk(opportunity, 201)
})
