import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PORT || 3200);
const botToken = process.env.MATTERMOST_BOT_TOKEN;
const mattermostUrl = (process.env.MATTERMOST_URL || 'https://chat.ringdom.org').replace(/\/$/, '');
const webhookMap = {
  approvals: process.env.MATTERMOST_APPROVAL_WEBHOOK,
  crisis: process.env.MATTERMOST_CRISIS_WEBHOOK,
  agent_log: process.env.MATTERMOST_AGENT_LOG_WEBHOOK
};
const signals = new Map<string, { decision: string; payload: unknown; createdAt: string }>();

function asContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

async function postWebhook(url: string | undefined, message: Record<string, unknown>) {
  if (!url) throw new Error('Mattermost webhook URL is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  if (!response.ok) {
    throw new Error(`Mattermost webhook ${response.status}: ${await response.text()}`);
  }
  return { ok: true };
}

function createServer() {
  const server = new McpServer(
    { name: 'mattermost-comms', version: '0.1.1' },
    {
      instructions:
        'Use Mattermost tools for approval requests, crisis alerts, and immutable agent action logs. Investor or crisis communications must go through approvals.'
    }
  );

  server.registerTool(
    'mm_post_approval_request',
    {
      title: 'Post Approval Request',
      description: 'Post a human approval request to Mattermost #pr-approvals.',
      inputSchema: {
        title: z.string(),
        summary: z.string(),
        consequence: z.string().optional(),
        approve_payload: z.record(z.string(), z.unknown()).optional(),
        reject_payload: z.record(z.string(), z.unknown()).optional()
      }
    },
    async ({ title, summary, consequence, approve_payload, reject_payload }) => {
      const requestId = randomUUID();
      await postWebhook(webhookMap.approvals, {
        text: `### Approval Required: ${title}\n\n${summary}\n\n${consequence ? `Consequence: ${consequence}\n\n` : ''}Request ID: \`${requestId}\``,
        props: { requestId, approve_payload, reject_payload }
      });
      return asContent({ requestId, posted: true });
    }
  );

  server.registerTool(
    'mm_post_alert',
    {
      title: 'Post Alert',
      description: 'Post an alert to crisis-watch or media-coverage-alerts via configured webhook.',
      inputSchema: {
        tier: z.enum(['info', 'warning', 'crisis']).default('info'),
        message: z.string()
      }
    },
    async ({ tier, message }) =>
      asContent(
        await postWebhook(tier === 'crisis' ? webhookMap.crisis : webhookMap.agent_log, {
          text: `[${tier.toUpperCase()}] ${message}`
        })
      )
  );

  server.registerTool(
    'mm_post_agent_log',
    {
      title: 'Post Agent Log',
      description: 'Log an autonomous agent action to Mattermost #agent-log.',
      inputSchema: {
        action: z.string(),
        result: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional()
      }
    },
    async ({ action, result, metadata }) =>
      asContent(
        await postWebhook(webhookMap.agent_log, {
          text: `Agent action: **${action}**\nResult: ${result}`,
          props: metadata
        })
      )
  );

  server.registerTool(
    'mm_await_signal',
    {
      title: 'Await Mattermost Signal',
      description: 'Return a previously captured callback signal by request id.',
      inputSchema: {
        request_id: z.string()
      }
    },
    async ({ request_id }) => asContent(signals.get(request_id) ?? { request_id, found: false })
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'mattermost-mcp' }));
app.post('/callback', (req, res) => {
  const requestId = String(req.body?.request_id || req.body?.context?.requestId || randomUUID());
  signals.set(requestId, {
    decision: String(req.body?.decision || req.body?.context?.action || 'unknown'),
    payload: req.body,
    createdAt: new Date().toISOString()
  });
  res.json({ ok: true, requestId });
});
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
  console.log(
    `mattermost-mcp listening on :${port}; Mattermost base ${mattermostUrl}; bot token configured=${Boolean(botToken)}`
  );
});
