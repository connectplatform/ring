import { listServerTools } from './client.js';
import type { CatalogTool, McpServerConfig, McpServerStatus } from './types.js';

export type CatalogSnapshot = {
  tools: CatalogTool[];
  statuses: McpServerStatus[];
  loadedAt: string;
};

let cache: CatalogSnapshot | null = null;
let cacheExpiresAt = 0;

export async function loadToolCatalog(
  servers: McpServerConfig[],
  options?: { force?: boolean; ttlMs?: number }
): Promise<CatalogSnapshot> {
  const ttlMs = options?.ttlMs ?? Number(process.env.MCP_CATALOG_TTL_MS || 60_000);
  const now = Date.now();
  if (!options?.force && cache && now < cacheExpiresAt) {
    return cache;
  }

  const statuses: McpServerStatus[] = [];
  const tools: CatalogTool[] = [];

  await Promise.all(
    servers.map(async (server) => {
      try {
        const listed = await listServerTools(server);
        tools.push(...listed);
        statuses.push({
          name: server.name,
          url: server.url,
          ok: true,
          toolCount: listed.length
        });
      } catch (error) {
        statuses.push({
          name: server.name,
          url: server.url,
          ok: false,
          toolCount: 0,
          error: error instanceof Error ? error.message : String(error)
        });
        console.warn(
          `[conductor] MCP catalog skip ${server.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );

  cache = { tools, statuses, loadedAt: new Date().toISOString() };
  cacheExpiresAt = now + ttlMs;
  return cache;
}

export function toXaiFunctionTools(tools: CatalogTool[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false as const
  }));
}

export function toAnthropicTools(tools: CatalogTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
}
