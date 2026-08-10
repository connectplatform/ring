import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { loadToolCatalog } from './mcp/catalog.js';
import type { McpServerConfig } from './mcp/types.js';
import { callAnthropicWithTools } from './providers/anthropic.js';
import { callXaiWithTools } from './providers/xai.js';

const port = Number(process.env.PORT || 4000);
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
const systemPrompt =
  process.env.BOSS_SYSTEM_PROMPT ||
  'You are the Ringdom PR-Ops conductor. Route work through available tools and require human approval for risky actions.';

/** Anthropic fallback — Launch policy: Haiku for all Anthropic calls */
const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
/** Preferred when XAI_API_KEY is set */
const xaiModel = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-3';

/**
 * Provider-agnostic local MCP tools (ClusterIP-safe).
 * ENABLE_ANTHROPIC_MCP remains a deprecated alias that also turns this on.
 */
const enableMcpTools =
  process.env.ENABLE_MCP_TOOLS === 'true' || process.env.ENABLE_ANTHROPIC_MCP === 'true';
/** Experimental only — Anthropic cloud cannot reach ClusterIP MCP URLs */
const enableAnthropicRemoteMcp = process.env.ENABLE_ANTHROPIC_REMOTE_MCP === 'true';
const maxToolSteps = Number(process.env.XAI_TOOL_MAX_STEPS || process.env.TOOL_MAX_STEPS || 8);
const maxTokens = Number(process.env.XAI_MAX_TOKENS || process.env.ANTHROPIC_MAX_TOKENS || 4096);

const preferXai = Boolean(xaiApiKey);
const provider: 'xai' | 'anthropic' = preferXai ? 'xai' : 'anthropic';
const activeModel = provider === 'xai' ? xaiModel : anthropicModel;

if (provider === 'anthropic' && !anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is required when XAI_API_KEY is not set');
}
if (provider === 'xai' && !xaiApiKey) {
  throw new Error('XAI_API_KEY is required for xAI provider');
}

const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
const xai = preferXai
  ? new OpenAI({
      apiKey: xaiApiKey,
      baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
    })
  : null;

const mcpServers: McpServerConfig[] = [
  {
    name: 'twenty-crm',
    url: process.env.TWENTY_MCP_URL || 'http://twenty-mcp.pr-ops.svc.cluster.local:5008/mcp'
  },
  ...(process.env.PLANE_MCP_URL && process.env.PLANE_MCP_URL !== 'off'
    ? [
        {
          name: 'plane-tasks',
          url: process.env.PLANE_MCP_URL,
          authorizationToken: process.env.PLANE_API_TOKEN || ''
        } satisfies McpServerConfig
      ]
    : []),
  {
    name: 'outline-wiki',
    url: process.env.OUTLINE_MCP_URL || 'http://outline-mcp.pr-ops.svc.cluster.local:3100/mcp'
  },
  {
    name: 'mattermost-comms',
    url: process.env.MATTERMOST_MCP_URL || 'http://mattermost-mcp.pr-ops.svc.cluster.local:3200/mcp'
  },
  {
    name: 'temporal-workflows',
    url: process.env.TEMPORAL_MCP_URL || 'http://temporal-mcp.pr-ops.svc.cluster.local:3300/mcp'
  }
];

const remoteMcpServers = mcpServers.map((server) => ({
  type: 'url' as const,
  url: server.url,
  name: server.name,
  ...(server.authorizationToken ? { authorization_token: server.authorizationToken } : {})
}));

const INPUT_TYPES = [
  'press_release_draft',
  'pitch_email_draft',
  'social_post_batch',
  'journalist_research_note',
  'brand_monitoring_alert',
  'campaign_brief',
  'newsletter_section',
  'crisis_signal',
  'coverage_confirmed',
  'investor_update_draft',
  'content_repurpose_job',
  'okr_metric_update',
  'auto_classify',
  'newsletter_assembly',
  'weekly_content_batch',
  'approval_signal',
  'pitch_replied'
] as const;

function routeSystemSuffix(inputType: string) {
  return [
    '',
    '## CONDUCTOR ROUTE CONTRACT',
    `input_type=${inputType}`,
    'Classify against the 12-type taxonomy if input_type is auto_classify.',
    'Canonical types: press_release_draft | pitch_email_draft | social_post_batch | journalist_research_note | brand_monitoring_alert | campaign_brief | newsletter_section | crisis_signal | coverage_confirmed | investor_update_draft | content_repurpose_job | okr_metric_update',
    'If confidence < 0.8, recommend a Plane @blocked issue and halt risky routing.',
    'CHECK INSTRUMENTS FIRST (Twenty, Plane, Outline) via tools before inventing work.',
    'HUMAN GATES: wire / investor / crisis / third-party naming → Mattermost #pr-approvals tools.',
    'CRISIS: pause scheduled content, notify #crisis-watch.'
  ].join('\n');
}

async function conductorMessage(input: unknown, mode: 'route' | 'boss') {
  const userContent =
    mode === 'route' ? JSON.stringify(input) : String((input as { message?: unknown }).message ?? input);
  const inputType =
    mode === 'route'
      ? String((input as { input_type?: string }).input_type || 'auto_classify')
      : 'boss';
  const system = mode === 'route' ? `${systemPrompt}${routeSystemSuffix(inputType)}` : systemPrompt;

  const catalog = enableMcpTools
    ? await loadToolCatalog(mcpServers)
    : { tools: [], statuses: [], loadedAt: new Date().toISOString() };

  if (provider === 'xai') {
    if (!xai) throw new Error('xAI client not configured');
    return callXaiWithTools({
      client: xai,
      model: xaiModel,
      system,
      userContent,
      servers: mcpServers,
      catalog: catalog.tools,
      enableTools: enableMcpTools,
      maxSteps: maxToolSteps,
      maxTokens
    });
  }

  if (!anthropic) throw new Error('Anthropic client not configured');
  return callAnthropicWithTools({
    client: anthropic,
    model: anthropicModel,
    system,
    userContent,
    servers: mcpServers,
    catalog: catalog.tools,
    enableTools: enableMcpTools,
    enableRemoteMcp: enableAnthropicRemoteMcp && !enableMcpTools,
    remoteMcpServers,
    maxSteps: maxToolSteps,
    maxTokens
  });
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', async (_req, res) => {
  const catalog = enableMcpTools
    ? await loadToolCatalog(mcpServers).catch((error) => ({
        tools: [],
        statuses: mcpServers.map((server) => ({
          name: server.name,
          url: server.url,
          ok: false,
          toolCount: 0,
          error: error instanceof Error ? error.message : String(error)
        })),
        loadedAt: new Date().toISOString()
      }))
    : { tools: [], statuses: [], loadedAt: new Date().toISOString() };

  res.json({
    status: 'ok',
    service: 'conductor-gateway',
    provider,
    model: activeModel,
    anthropicModel,
    xaiModel,
    preferXai,
    enableMcpTools,
    enableAnthropicRemoteMcp,
    mcpNote: enableMcpTools
      ? 'Local ClusterIP MCP client + provider function calling (Grok Responses / Anthropic tools)'
      : enableAnthropicRemoteMcp
        ? 'Experimental Anthropic remote MCP (ClusterIP URLs will fail from Anthropic cloud)'
        : 'MCP tools disabled — prompt-only routing',
    mcpCatalogLoadedAt: catalog.loadedAt,
    mcpToolCount: catalog.tools.length,
    mcpServers: catalog.statuses.length
      ? catalog.statuses
      : mcpServers.map((server) => ({ name: server.name, url: server.url, ok: null, toolCount: null })),
    inputTypes: INPUT_TYPES,
    maxToolSteps
  });
});

app.post('/route', async (req, res) => {
  try {
    const inputType = req.body?.input_type || 'auto_classify';
    if (inputType !== 'auto_classify' && !(INPUT_TYPES as readonly string[]).includes(inputType)) {
      res.status(400).json({
        error: `Unknown input_type: ${inputType}`,
        allowed: INPUT_TYPES
      });
      return;
    }
    const response = await conductorMessage(
      {
        input_type: inputType,
        content: req.body?.content,
        metadata: req.body?.metadata || {}
      },
      'route'
    );
    res.json({
      routing_result: response.content,
      usage: response.usage,
      stop_reason: response.stop_reason,
      provider: response.provider,
      model: response.model,
      tool_trace: response.tool_trace
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/boss', async (req, res) => {
  try {
    const response = await conductorMessage(req.body, 'boss');
    res.json({
      response: response.content,
      usage: response.usage,
      stop_reason: response.stop_reason,
      provider: response.provider,
      model: response.model,
      tool_trace: response.tool_trace
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(port, () => {
  console.log(
    `conductor-gateway listening on :${port} provider=${provider} model=${activeModel} mcpTools=${enableMcpTools} remoteAnthropicMcp=${enableAnthropicRemoteMcp}`
  );
});
