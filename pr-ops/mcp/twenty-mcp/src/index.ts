import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PORT || 5008);
const twentyBaseUrl = (process.env.TWENTY_API_URL || 'http://twenty-crm-server.pr-ops.svc.cluster.local:3000').replace(/\/$/, '');
const twentyApiKey = process.env.TWENTY_API_KEY;

if (!twentyApiKey) {
  throw new Error('TWENTY_API_KEY is required');
}

async function twentyRequest(path: string, init: RequestInit = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${twentyBaseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${twentyApiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`Twenty API ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function asContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer(
    { name: 'twenty-crm', version: '0.1.1' },
    {
      instructions:
        'Use Twenty CRM tools for PR media contacts, opportunities, coverage, and generic Twenty API access. Prefer explicit paths returned by Twenty metadata when available.'
    }
  );

  server.registerTool(
    'twenty_api_request',
    {
      title: 'Twenty API Request',
      description: 'Call an arbitrary Twenty REST API path using the configured API key.',
      inputSchema: {
        method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).default('GET'),
        path: z.string().describe('Path such as /rest/people or /rest/metadata/objects'),
        body: z.record(z.string(), z.unknown()).optional()
      }
    },
    async ({ method, path, body }) =>
      asContent(
        await twentyRequest(path, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body)
        })
      )
  );

  server.registerTool(
    'twenty_search_metadata',
    {
      title: 'Twenty Metadata Search',
      description: 'Fetch Twenty metadata objects so the conductor can discover custom PR objects and fields.',
      inputSchema: {
        query: z.string().optional()
      }
    },
    async ({ query }) => {
      const metadata = await twentyRequest('/rest/metadata/objects');
      if (!query) return asContent(metadata);
      const lower = query.toLowerCase();
      return asContent(
        JSON.parse(JSON.stringify(metadata)).filter?.((item: Record<string, unknown>) =>
          JSON.stringify(item).toLowerCase().includes(lower)
        ) ?? metadata
      );
    }
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'twenty-mcp' }));
app.post('/mcp', async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
});

app.listen(port, () => {
  console.log(`twenty-mcp listening on :${port}`);
});
