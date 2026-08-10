import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CatalogTool, McpServerConfig, ToolTraceEntry } from './types.js';

function preview(value: unknown, max = 500): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function extractText(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result ?? '');
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return JSON.stringify(result);
  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text: unknown }).text);
      }
      return JSON.stringify(part);
    })
    .join('\n');
}

async function withClient<T>(
  server: McpServerConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream'
  };
  if (server.authorizationToken) {
    headers.Authorization = `Bearer ${server.authorizationToken}`;
  }
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers }
  });
  const client = new Client({ name: 'conductor-gateway', version: '0.2.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore close races */
    }
  }
}

export async function listServerTools(server: McpServerConfig): Promise<CatalogTool[]> {
  return withClient(server, async (client) => {
    const listed = await client.listTools();
    return (listed.tools || []).map((tool) => {
      const parameters =
        tool.inputSchema && typeof tool.inputSchema === 'object'
          ? (tool.inputSchema as Record<string, unknown>)
          : { type: 'object', properties: {} };
      if (!parameters.type) parameters.type = 'object';
      return {
        name: `${server.name}__${tool.name}`,
        serverName: server.name,
        toolName: tool.name,
        description: `[${server.name}] ${tool.description || tool.name}`,
        parameters
      };
    });
  });
}

export async function callServerTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ text: string; raw: unknown }> {
  return withClient(server, async (client) => {
    const raw = await client.callTool({ name: toolName, arguments: args });
    return { text: extractText(raw), raw };
  });
}

export function parseNamespacedTool(name: string): { serverName: string; toolName: string } | null {
  const idx = name.indexOf('__');
  if (idx <= 0) return null;
  return { serverName: name.slice(0, idx), toolName: name.slice(idx + 2) };
}

export async function dispatchCatalogTool(
  servers: McpServerConfig[],
  catalog: CatalogTool[],
  namespacedName: string,
  argsJson: string
): Promise<ToolTraceEntry & { output: string }> {
  const started = Date.now();
  const parsed = parseNamespacedTool(namespacedName);
  if (!parsed) {
    return {
      server: 'unknown',
      tool: namespacedName,
      arguments: argsJson,
      ok: false,
      durationMs: Date.now() - started,
      error: `Invalid namespaced tool: ${namespacedName}`,
      output: JSON.stringify({ error: `Invalid namespaced tool: ${namespacedName}` })
    };
  }
  const server = servers.find((s) => s.name === parsed.serverName);
  const inCatalog = catalog.some(
    (t) => t.serverName === parsed.serverName && t.toolName === parsed.toolName
  );
  if (!server || !inCatalog) {
    return {
      server: parsed.serverName,
      tool: parsed.toolName,
      arguments: argsJson,
      ok: false,
      durationMs: Date.now() - started,
      error: `Unknown tool ${namespacedName}`,
      output: JSON.stringify({ error: `Unknown tool ${namespacedName}` })
    };
  }
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch (error) {
    return {
      server: parsed.serverName,
      tool: parsed.toolName,
      arguments: argsJson,
      ok: false,
      durationMs: Date.now() - started,
      error: `Invalid JSON arguments: ${error instanceof Error ? error.message : String(error)}`,
      output: JSON.stringify({ error: 'Invalid JSON arguments' })
    };
  }
  try {
    const { text } = await callServerTool(server, parsed.toolName, args);
    return {
      server: parsed.serverName,
      tool: parsed.toolName,
      arguments: args,
      ok: true,
      durationMs: Date.now() - started,
      resultPreview: preview(text),
      output: text
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      server: parsed.serverName,
      tool: parsed.toolName,
      arguments: args,
      ok: false,
      durationMs: Date.now() - started,
      error: message,
      output: JSON.stringify({ error: message })
    };
  }
}
