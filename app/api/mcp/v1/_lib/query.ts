/**
 * MCP route-handler helpers — re-export from server SSOT.
 * Keeps existing `@/app/api/mcp/v1/_lib/query` imports stable for the MCP subtree.
 */
export { queryInt, queryString, readJsonBody } from '@/lib/server/request'
