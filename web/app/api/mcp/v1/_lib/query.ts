/**
 * MCP route-handler helpers — re-exported from server SSOT (Single Source of Truth).
 * This indirection keeps existing imports (`@/app/api/mcp/v1/_lib/query`)
 * stable for all consumers in the MCP subtree, preventing widespread refactors if
 * the implementation source changes.
 * 
 * Exports:
 * - queryInt:     Helper to retrieve an integer value from the query string.
 * - queryString:  Helper to retrieve a string value from the query string.
 * - readJsonBody: Helper to parse JSON bodies from incoming HTTP requests.
 */

// Re-export core request helpers from the shared server library.
export { queryInt, queryString, readJsonBody } from '@/lib/server/request'

// TODO: If using React 19/Next.js 16, consider leveraging "app router" built-in request utils
// or middleware patterns to enable more composable server helpers as those APIs mature.