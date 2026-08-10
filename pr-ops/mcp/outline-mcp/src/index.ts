import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PORT || 3100);
const outlineBaseUrl = (process.env.OUTLINE_API_URL || 'http://outline.pr-ops.svc.cluster.local:3000').replace(/\/$/, '');
const outlineApiToken = process.env.OUTLINE_API_TOKEN;

if (!outlineApiToken) {
  throw new Error('OUTLINE_API_TOKEN is required');
}

async function outlineRequest(endpoint: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${outlineBaseUrl}/api/${endpoint.replace(/^\/?api\/?/, '')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${outlineApiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Error(`Outline API ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  return payload;
}

function asContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer(
    { name: 'outline-wiki', version: '0.1.1' },
    {
      instructions:
        'Use Outline tools for PR knowledge-base documents, PARA collections, campaign briefs, and generated draft storage. Outline is not a task manager; tasks live in Plane.'
    }
  );

  server.registerTool(
    'outline_create_document',
    {
      title: 'Create Outline Document',
      description: 'Create a document in Outline.',
      inputSchema: {
        title: z.string(),
        text: z.string(),
        collectionId: z.string(),
        parentDocumentId: z.string().optional(),
        publish: z.boolean().default(true)
      }
    },
    async (input) => asContent(await outlineRequest('documents.create', input))
  );

  server.registerTool(
    'outline_search_documents',
    {
      title: 'Search Outline Documents',
      description: 'Search Outline documents by query.',
      inputSchema: {
        query: z.string(),
        collectionId: z.string().optional()
      }
    },
    async (input) => asContent(await outlineRequest('documents.search', input))
  );

  server.registerTool(
    'outline_update_document',
    {
      title: 'Update Outline Document',
      description: 'Update or append content to an Outline document.',
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        text: z.string().optional(),
        append: z.boolean().optional()
      }
    },
    async (input) => asContent(await outlineRequest('documents.update', input))
  );

  server.registerTool(
    'outline_move_document',
    {
      title: 'Move Outline Document',
      description: 'Move an Outline document between collections or parents.',
      inputSchema: {
        id: z.string(),
        collectionId: z.string(),
        parentDocumentId: z.string().optional()
      }
    },
    async (input) => asContent(await outlineRequest('documents.move', input))
  );

  server.registerTool(
    'outline_list_collections',
    {
      title: 'List Outline Collections',
      description: 'List Outline collections.',
      inputSchema: {}
    },
    async () => asContent(await outlineRequest('collections.list'))
  );

  server.registerTool(
    'outline_get_collection',
    {
      title: 'Get Outline Collection',
      description: 'Get one Outline collection by id.',
      inputSchema: {
        id: z.string()
      }
    },
    async (input) => asContent(await outlineRequest('collections.info', input))
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '4mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'outline-mcp' }));
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
  console.log(`outline-mcp listening on :${port}`);
});
