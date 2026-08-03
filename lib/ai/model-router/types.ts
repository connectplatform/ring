/**
 * Global model-router SSOT types — selection catalog only (1A).
 * Executors (LLMClient, conductors, SDK callers) keep performing HTTP/SDK calls.
 */

export type ProviderId = 'openai' | 'anthropic' | 'xai' | 'google' | 'openrouter' | 'suno'

export type Modality = 'text' | 'image' | 'video' | 'audio' | 'embedding'

export type MethodName =
  | 'chat'
  | 'messages'
  | 'responses'
  | 'models.list'
  | 'images.generate'
  | 'images.edit'
  | 'videos.generate'
  | 'videos.edit'
  | 'videos.extend'
  | 'tts'
  | 'music'
  | 'embeddings'

export type TaskClass =
  // Conversational / agents
  | 'chat_stream'
  | 'tool_use_agent'
  | 'admin_bot_agent'
  | 'ringization'
  // Text generation
  | 'ghost_write'
  | 'research_web'
  | 'structured_extract'
  | 'news_article_draft'
  | 'news_translate'
  | 'docs_summarize'
  | 'moderation_summary'
  | 'citation_validate'
  | 'opportunity_autofill'
  | 'platform_llm_probe'
  // Scoring / classify
  | 'news_moderation_score'
  | 'matcher_score'
  | 'email_intent'
  | 'email_sentiment'
  | 'email_injection_classify'
  | 'email_batch_analytics'
  | 'email_reply'
  // Image
  | 'image_generate'
  | 'image_edit'
  // Video
  | 'video_generate'
  | 'video_i2v'
  | 'video_edit'
  | 'video_remaster'
  | 'video_extend'
  // Audio
  | 'tts'
  | 'music_generate'
  // Vectors / future
  | 'embedding'
  // Reserved
  | 'vendor_onboarding_extract'
  | 'vision_describe'
  | 'code_assist'

export interface ModelMethod {
  name: MethodName
  http: 'POST' | 'GET'
  path: string
  notes?: string
}

export interface ModelPricing {
  unit: 'per_mtok' | 'per_image' | 'per_video_second' | 'per_request' | 'per_minute'
  inputUsd?: number
  outputUsd?: number
  cachedInputUsd?: number
  flatUsd?: number
  asOf: string
  source: string
}

export interface ModelCapabilities {
  tools?: boolean
  stream?: boolean
  vision?: boolean
  webSearch?: boolean
  structuredOutput?: boolean
  imageInput?: boolean
  reasoningEffort?: boolean
}

export interface ModelEntry {
  provider: ProviderId
  modelId: string
  displayName: string
  modalities: Modality[]
  methods: ModelMethod[]
  capabilities: ModelCapabilities
  contextWindow?: number
  maxOutput?: number
  pricing: ModelPricing
  /** Ordered env var chain — first resolvable wins */
  keyEnv: string[]
  baseUrlEnv?: string
  defaultBaseUrl: string
  status: 'active' | 'preview' | 'deprecated'
}

export interface TaskClassRoute {
  taskClass: TaskClass
  requiredMethod: MethodName
  /** If set, entry must expose ANY of these methods (cross-provider text). */
  acceptedMethods?: MethodName[]
  requiredCapabilities?: Array<keyof ModelCapabilities>
  preferred: Array<{ provider: ProviderId; modelId: string }>
  fallbackClass?: TaskClass
  notes?: string
}

export interface ResolvedModel {
  provider: ProviderId
  modelId: string
  method: MethodName
  endpoint: { http: 'POST' | 'GET'; path: string; baseUrl: string }
  pricing: ModelPricing
  keyEnv: string
  apiKey: string
  entry: ModelEntry
}

export interface ResolveModelOptions {
  /** Override env lookup (tests / DB-merged secrets). Keys are env var names. */
  availableKeys?: Record<string, string | undefined>
  preferred?: Array<{ provider: ProviderId; modelId: string }>
  /** Skip env MODEL_ROUTER_<TASKCLASS> override */
  ignoreEnvOverride?: boolean
}

export class ModelRouterError extends Error {
  taskClass: TaskClass
  triedKeyEnvs: string[]

  constructor(message: string, taskClass: TaskClass, triedKeyEnvs: string[] = []) {
    super(message)
    this.name = 'ModelRouterError'
    this.taskClass = taskClass
    this.triedKeyEnvs = triedKeyEnvs
  }
}
