export type McpServerConfig = {
  name: string;
  url: string;
  authorizationToken?: string;
};

export type CatalogTool = {
  /** Namespaced name: `{server}__{tool}` */
  name: string;
  serverName: string;
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolTraceEntry = {
  server: string;
  tool: string;
  arguments: unknown;
  ok: boolean;
  durationMs: number;
  error?: string;
  resultPreview?: string;
};

export type McpServerStatus = {
  name: string;
  url: string;
  ok: boolean;
  toolCount: number;
  error?: string;
};

export type ConductorResult = {
  content: Array<{ type: 'text'; text: string }>;
  usage: unknown;
  stop_reason: string | null;
  provider: 'xai' | 'anthropic';
  model: string;
  tool_trace: ToolTraceEntry[];
};
