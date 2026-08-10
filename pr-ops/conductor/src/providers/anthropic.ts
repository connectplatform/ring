import type Anthropic from '@anthropic-ai/sdk';
import { dispatchCatalogTool } from '../mcp/client.js';
import { toAnthropicTools } from '../mcp/catalog.js';
import type { CatalogTool, ConductorResult, McpServerConfig, ToolTraceEntry } from '../mcp/types.js';

type ContentBlock = Anthropic.Messages.ContentBlock;
type MessageParam = Anthropic.Messages.MessageParam;

function textFromContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export async function callAnthropicWithTools(params: {
  client: Anthropic;
  model: string;
  system: string;
  userContent: string;
  servers: McpServerConfig[];
  catalog: CatalogTool[];
  enableTools: boolean;
  /** Deprecated: Anthropic cloud remote MCP — ClusterIP unreachable; keep off in Ringdom */
  enableRemoteMcp: boolean;
  remoteMcpServers: Array<{
    type: 'url';
    url: string;
    name: string;
    authorization_token?: string;
  }>;
  maxSteps: number;
  maxTokens: number;
}): Promise<ConductorResult> {
  const tool_trace: ToolTraceEntry[] = [];
  const localTools =
    params.enableTools && params.catalog.length > 0 ? toAnthropicTools(params.catalog) : undefined;

  const system: Anthropic.Messages.MessageCreateParams['system'] = [
    {
      type: 'text',
      text: params.system,
      cache_control: { type: 'ephemeral' }
    }
  ];

  const messages: MessageParam[] = [{ role: 'user', content: params.userContent }];

  // Remote MCP only for experimental public MCP URLs — not ClusterIP.
  if (params.enableRemoteMcp && !localTools) {
    const response = await (params.client.beta.messages.create as any)(
      {
        model: params.model,
        max_tokens: params.maxTokens,
        system,
        messages,
        mcp_servers: params.remoteMcpServers,
        tools: params.remoteMcpServers.map((server) => ({
          type: 'mcp_toolset',
          mcp_server_name: server.name
        }))
      },
      {
        headers: {
          'anthropic-beta': process.env.ANTHROPIC_BETA || 'mcp-client-2025-11-20'
        }
      }
    );
    return {
      content: response.content,
      usage: response.usage,
      stop_reason: response.stop_reason,
      provider: 'anthropic',
      model: params.model,
      tool_trace
    };
  }

  let response = await params.client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system,
    messages,
    ...(localTools ? { tools: localTools as Anthropic.Messages.Tool[] } : {})
  });

  let steps = 0;
  while (response.stop_reason === 'tool_use' && steps < params.maxSteps) {
    steps += 1;
    const toolUses = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
    );
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const dispatched = await dispatchCatalogTool(
        params.servers,
        params.catalog,
        use.name,
        JSON.stringify(use.input ?? {})
      );
      tool_trace.push({
        server: dispatched.server,
        tool: dispatched.tool,
        arguments: dispatched.arguments,
        ok: dispatched.ok,
        durationMs: dispatched.durationMs,
        error: dispatched.error,
        resultPreview: dispatched.resultPreview
      });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: dispatched.output,
        is_error: !dispatched.ok
      });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await params.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system,
      messages,
      ...(localTools ? { tools: localTools as Anthropic.Messages.Tool[] } : {})
    });
  }

  return {
    content: [{ type: 'text', text: textFromContent(response.content) }],
    usage: response.usage,
    stop_reason: response.stop_reason,
    provider: 'anthropic',
    model: params.model,
    tool_trace
  };
}
