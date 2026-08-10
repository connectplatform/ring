import type OpenAI from 'openai';
import { dispatchCatalogTool } from '../mcp/client.js';
import { toXaiFunctionTools } from '../mcp/catalog.js';
import type { CatalogTool, ConductorResult, McpServerConfig, ToolTraceEntry } from '../mcp/types.js';

function extractOutputText(response: OpenAI.Responses.Response): string {
  const chunks: string[] = [];
  for (const item of response.output || []) {
    if (item.type === 'message') {
      for (const part of item.content || []) {
        if (part.type === 'output_text') chunks.push(part.text);
      }
    }
  }
  if (chunks.length) return chunks.join('\n');
  return response.output_text || '';
}

export async function callXaiWithTools(params: {
  client: OpenAI;
  model: string;
  system: string;
  userContent: string;
  servers: McpServerConfig[];
  catalog: CatalogTool[];
  enableTools: boolean;
  maxSteps: number;
  maxTokens: number;
}): Promise<ConductorResult> {
  const tool_trace: ToolTraceEntry[] = [];
  const tools =
    params.enableTools && params.catalog.length > 0 ? toXaiFunctionTools(params.catalog) : undefined;

  let response = await params.client.responses.create({
    model: params.model,
    max_output_tokens: params.maxTokens,
    instructions: params.system,
    input: [{ role: 'user', content: params.userContent }],
    ...(tools ? { tools } : {})
  });

  let steps = 0;
  while (steps < params.maxSteps) {
    const functionCalls = (response.output || []).filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call'
    );
    if (!functionCalls.length) break;
    steps += 1;

    const outputs: Array<{
      type: 'function_call_output';
      call_id: string;
      output: string;
    }> = [];

    for (const call of functionCalls) {
      const dispatched = await dispatchCatalogTool(
        params.servers,
        params.catalog,
        call.name,
        call.arguments || '{}'
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
      outputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: dispatched.output
      });
    }

    response = await params.client.responses.create({
      model: params.model,
      max_output_tokens: params.maxTokens,
      previous_response_id: response.id,
      input: outputs,
      ...(tools ? { tools } : {})
    });
  }

  const text = extractOutputText(response);
  return {
    content: [{ type: 'text', text }],
    usage: response.usage,
    stop_reason: response.status ?? null,
    provider: 'xai',
    model: params.model,
    tool_trace
  };
}
