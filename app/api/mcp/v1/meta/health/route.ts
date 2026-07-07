// Import guard function that protects the route (adds authentication/authorization logic)
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
// Import utility to format a standard successful (OK) response
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

// Define the GET endpoint for the health check, wrapping with access control guard
export const GET = withMcpGuard(async () => {
  // Return an OK response with service health metadata.
  // Uses the current timestamp in ISO format.
  // TODO: In future, consider moving version string to a constants/config file for maintainability.
  return mcpOk({
    status: 'ok', // Service is up
    service: 'ring-mcp-gateway', // Name of the service reporting health
    version: 'v1', // API/service version
    timestamp: new Date().toISOString(), // The time this response was generated
  })
})
