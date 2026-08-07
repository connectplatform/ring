import { parseUserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
// Provides helper functions for parsing and resolving user roles

import { createUser } from '@/features/auth/services/create-user'
// Service to create a new user

import { db } from '@/lib/database'
// Database client abstraction

import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
// Higher-order function to protect the route with MCP guard logic

import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
// Helpers to create response objects tailored to MCP API spec

import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'
// Utilities for reading query params and JSON body from Request object

/**
 * Handles GET requests for listing users.
 * Supports optional filtering by role and custom pagination limit.
 * Responds with a list of user objects and total count, ordered by creation date descending.
 */
export const GET = withMcpGuard(async (request) => {
  // Read optional 'role' filter from query parameters
  const role = queryString(request, 'role')

  // Read 'limit' from query params, defaulting to 50 if missing or invalid
  const limit = queryInt(request, 'limit', 50) || 50

  // Construct Firestore-style filter to search by role if query provided, empty otherwise
  const filters = role
    ? [{ field: 'role', operator: '==' as const, value: role }]
    : []

  // Query users collection in database with specified filters, pagination, and ordering
  const result = await db().queryDocs({
    collection: 'users',
    filters,
    pagination: { limit },
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  })

  // If query fails, send error response
  if (!result.success) return mcpError(result.error?.message || 'Failed to list users', 500)

  // Fallback to empty list if database returned no data
  const items = result.data ?? []

  // Respond with the list of found users and count
  return mcpOk({ items, total: items.length })
})

/**
 * Handles POST requests to create a new user.
 * Requires 'email' and 'name' in the request body. 
 * Attempts to parse-role as array, or resolve single role if not array.
 * Returns created user object or an error message.
 */
export const POST = withMcpGuard(async (request) => {
  // Parse JSON body from request
  const body = await readJsonBody(request)
  // Validate presence of required fields
  if (!body?.email || !body?.name) return mcpError('email and name are required', 400)

  // Parse role, using array variant first, falling back to resolving a single role
  // TODO: Unify 'role' handling to ensure consistent array vs string single source-of-truth in API contract.
  const role = parseUserRolesArray(body.role) ?? resolveSessionUserRole(body.role)

  // Create the user through the service abstraction
  // TODO: Consider enforcing email normalization and validation with zod or Next.js server actions middleware
  const user = await createUser({
    email: String(body.email), // Ensure type safety
    name: String(body.name),   // Ensure type safety
    role,
  })

  // If creation failed, return error
  if (!user) return mcpError('Failed to create user', 400)
  // Return the created user with status 201
  return mcpOk(user, 201)
})
