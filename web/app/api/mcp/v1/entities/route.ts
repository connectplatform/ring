import { z } from 'zod'
import { assertKnownUserRole } from '@/features/auth/user-role'
import { getEntitiesForRole } from '@/features/entities/services/get-entities'
import { createEntity } from '@/features/entities/services/create-entity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// ---------------------------------------------------------------------------
// Create-entity schema — validates required fields at the route layer.
//
// Required by NewEntityData (no service default):
//   name, shortDescription, type, location, visibility, locale, isConfidential
//
// Server-set (not in request body): addedBy, dateAdded, lastUpdated,
//   members (defaults to []), opportunities (defaults to [])
// ---------------------------------------------------------------------------
const createEntitySchema = z.object({
  // Required — no service default
  name: z.string().min(1, 'name is required'),
  shortDescription: z.string().min(1, 'shortDescription is required'),
  type: z.string().min(1, 'entity type is required'),
  location: z.string().min(1, 'location is required'),
  visibility: z.enum(['public', 'subscriber', 'member', 'confidential']),
  locale: z.string().min(1, 'locale is required'),
  isConfidential: z.boolean(),

  // Optional fields from Entity type
  fullDescription: z.string().optional(),
  contactEmail: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().optional(),
  logo: z.string().optional(),
  tags: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  employeeCount: z.number().optional(),
  foundedYear: z.number().optional(),
}).passthrough()

// GET handler for retrieving a paginated, optionally searched list of entities for a user role
export const GET = withMcpGuard(async (request, actor) => {
  const limit = queryInt(request, 'limit', 20)
  const startAfter = queryString(request, 'startAfter')
  const search = queryString(request, 'search')

  const result = await getEntitiesForRole({
    userRole: assertKnownUserRole(actor.role),
    limit,
    startAfter,
    filters: search ? { search } : undefined,
  })

  return mcpOk(result)
})

// POST handler for creating a new entity
export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const parsed = createEntitySchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Request body required', 400)
  }

  // Cast is safe — Zod verified the body is a valid object; service handles deeper validation
  const entity = await createEntity(parsed.data as Parameters<typeof createEntity>[0])
  return mcpOk(entity, 201)
})
