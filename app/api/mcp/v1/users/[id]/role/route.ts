import { parseUserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { updateUserRole } from '@/features/auth/services/update-user-role'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

// PATCH endpoint is exported, wrapped with withMcpGuard to ensure user authentication & authorization.
export const PATCH = withMcpGuard(
  async (request, _actor, context?: Ctx) => {
    // Extract the user ID from the params in the context.
    // Ensures backwards compatibility by defaulting to empty string if not provided.
    const { id } = await (context?.params || Promise.resolve({ id: '' }))

    // Read and parse the JSON body from the incoming request.
    const body = await readJsonBody(request)

    // Check for 'confirm' flag to explicitly acknowledge the role update action.
    if (body?.confirm !== true) {
      return mcpError('set-role requires confirm: true in body', 400)
    }

    // Ensure 'role' field is provided in request body.
    if (!body?.role) {
      return mcpError('role is required', 400)
    }

    // Parse and resolve the provided role using helper functions.
    // parseUserRolesArray handles role as array; resolveSessionUserRole as fallback for single string.
    const newRole = parseUserRolesArray(body.role) ?? resolveSessionUserRole(body.role)
    if (!newRole) {
      return mcpError('Invalid role', 400)
    }

    // Update the user's role using the service function.
    // TODO: If updateUserRole throws, this will fail silently - consider try/catch for improved error handling.
    const ok = await updateUserRole(id, newRole)
    if (!ok) {
      return mcpError('Failed to update role', 400)
    }

    // Return a success response containing the user id and new role.
    return mcpOk({ id, role: newRole })
  }
)

/*
TODO:
- Consider switching to the Next.js 16 native API Route Handlers (`export async function PATCH(request: Request) { ... }`)
  - This would enable improved typing, error handling, and caching strategies with built-in Next features.
  - Refactor to use NextResponse for standardized response format.
  - Use zod or similar schema validation for request body validation.
  - Add explicit error logging for traceability.
- Example for immediate upgrade:
    import { NextRequest, NextResponse } from 'next/server';
    export async function PATCH(request: NextRequest) {
      // ... handler code here ...
    }

- If parseUserRolesArray or resolveSessionUserRole are stubs:
    // STUB: Implement parseUserRolesArray to parse a list/string of roles into internal enum/string
    // STUB: Implement resolveSessionUserRole to resolve a user's session to a role string
- If updateUserRole is a stub:
    // STUB: Implement updateUserRole to update the user's role in database
*/
