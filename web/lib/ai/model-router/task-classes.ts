import type { TaskClass, TaskClassRoute } from './types'

/**
 * Task-class routes: preferred-order lists of provider/model.
 * Empty preferred → resolve by price among capable available models.
 * fallbackClass inherits preferred when own list is empty.
 */
export const TASK_CLASS_ROUTES: Record<TaskClass, TaskClassRoute> = {
  chat_stream: {
    taskClass: 'chat_stream',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    requiredCapabilities: ['stream'],
    preferred: [
      { provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
      { provider: 'openai', modelId: 'gpt-5.6-terra' },
      { provider: 'xai', modelId: 'grok-4.3' },
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4-5' },
    ],
  },
  tool_use_agent: {
    taskClass: 'tool_use_agent',
    requiredMethod: 'messages',
    acceptedMethods: ['messages', 'chat'],
    requiredCapabilities: ['tools'],
    preferred: [
      { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' },
      { provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
    ],
  },
  admin_bot_agent: {
    taskClass: 'admin_bot_agent',
    requiredMethod: 'messages',
    acceptedMethods: ['messages', 'chat'],
    requiredCapabilities: ['tools'],
    preferred: [{ provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' }],
  },
  ringization: {
    taskClass: 'ringization',
    requiredMethod: 'messages',
    acceptedMethods: ['messages', 'chat'],
    preferred: [
      { provider: 'anthropic', modelId: 'claude-opus-4-20250514' },
      { provider: 'openai', modelId: 'gpt-5.6-sol' },
      { provider: 'xai', modelId: 'grok-4.3' },
    ],
    notes: 'Prefer Opus-class for settler/clone recipes',
  },

  ghost_write: {
    taskClass: 'ghost_write',
    requiredMethod: 'chat',
    preferred: [{ provider: 'xai', modelId: 'grok-4.3' }],
  },
  research_web: {
    taskClass: 'research_web',
    requiredMethod: 'chat',
    requiredCapabilities: ['webSearch'],
    preferred: [{ provider: 'xai', modelId: 'grok-4.3' }],
  },
  structured_extract: {
    taskClass: 'structured_extract',
    requiredMethod: 'chat',
    requiredCapabilities: ['structuredOutput'],
    preferred: [
      { provider: 'xai', modelId: 'grok-4.3' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
      { provider: 'openai', modelId: 'gpt-5.6-luna' },
    ],
  },
  news_article_draft: {
    taskClass: 'news_article_draft',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'research_web',
  },
  news_translate: {
    taskClass: 'news_translate',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'structured_extract',
  },
  docs_summarize: {
    taskClass: 'docs_summarize',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'ghost_write',
  },
  moderation_summary: {
    taskClass: 'moderation_summary',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'structured_extract',
  },
  citation_validate: {
    taskClass: 'citation_validate',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'structured_extract',
  },
  opportunity_autofill: {
    taskClass: 'opportunity_autofill',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'structured_extract',
  },
  platform_llm_probe: {
    taskClass: 'platform_llm_probe',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'chat_stream',
  },

  news_moderation_score: {
    taskClass: 'news_moderation_score',
    requiredMethod: 'chat',
    preferred: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4-5' },
      { provider: 'openrouter', modelId: 'openai/gpt-4o-mini' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
    ],
  },
  matcher_score: {
    taskClass: 'matcher_score',
    requiredMethod: 'chat',
    preferred: [
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
      { provider: 'openai', modelId: 'gpt-5.6-luna' },
      { provider: 'xai', modelId: 'grok-4.3' },
    ],
  },
  email_intent: {
    taskClass: 'email_intent',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    preferred: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
    ],
  },
  email_sentiment: {
    taskClass: 'email_sentiment',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    preferred: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
    ],
  },
  email_injection_classify: {
    taskClass: 'email_injection_classify',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    preferred: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
    ],
  },
  email_batch_analytics: {
    taskClass: 'email_batch_analytics',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    preferred: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
    ],
  },
  email_reply: {
    taskClass: 'email_reply',
    requiredMethod: 'chat',
    acceptedMethods: ['chat', 'messages'],
    preferred: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-chat' },
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
      { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' },
    ],
  },

  image_generate: {
    taskClass: 'image_generate',
    requiredMethod: 'images.generate',
    preferred: [
      { provider: 'xai', modelId: 'grok-imagine-image-quality' },
      { provider: 'google', modelId: 'imagen-4.0-generate-001' },
    ],
  },
  image_edit: {
    taskClass: 'image_edit',
    requiredMethod: 'images.edit',
    preferred: [{ provider: 'xai', modelId: 'grok-imagine-image-quality' }],
  },

  video_generate: {
    taskClass: 'video_generate',
    requiredMethod: 'videos.generate',
    preferred: [
      { provider: 'xai', modelId: 'grok-imagine-video-1.5' },
      { provider: 'xai', modelId: 'grok-imagine-video' },
    ],
    notes: 'xAI over openai; no anthropic',
  },
  video_i2v: {
    taskClass: 'video_i2v',
    requiredMethod: 'videos.generate',
    preferred: [
      { provider: 'xai', modelId: 'grok-imagine-video-1.5' },
      { provider: 'xai', modelId: 'grok-imagine-video' },
    ],
  },
  video_edit: {
    taskClass: 'video_edit',
    requiredMethod: 'videos.edit',
    preferred: [
      { provider: 'xai', modelId: 'grok-imagine-video-1.5' },
      { provider: 'xai', modelId: 'grok-imagine-video' },
    ],
  },
  video_remaster: {
    taskClass: 'video_remaster',
    requiredMethod: 'videos.edit',
    preferred: [
      { provider: 'xai', modelId: 'grok-imagine-video' },
      { provider: 'xai', modelId: 'grok-imagine-video-1.5' },
    ],
  },
  video_extend: {
    taskClass: 'video_extend',
    requiredMethod: 'videos.extend',
    preferred: [{ provider: 'xai', modelId: 'grok-imagine-video-1.5' }],
  },

  tts: {
    taskClass: 'tts',
    requiredMethod: 'tts',
    preferred: [{ provider: 'xai', modelId: 'grok-tts-eve' }],
  },
  music_generate: {
    taskClass: 'music_generate',
    requiredMethod: 'music',
    preferred: [{ provider: 'suno', modelId: 'V4' }],
  },

  embedding: {
    taskClass: 'embedding',
    requiredMethod: 'embeddings',
    preferred: [{ provider: 'openai', modelId: 'text-embedding-3-small' }],
  },

  vendor_onboarding_extract: {
    taskClass: 'vendor_onboarding_extract',
    requiredMethod: 'chat',
    preferred: [],
    fallbackClass: 'structured_extract',
    notes: 'Reserved — not live yet',
  },
  vision_describe: {
    taskClass: 'vision_describe',
    requiredMethod: 'chat',
    requiredCapabilities: ['vision'],
    preferred: [
      { provider: 'anthropic', modelId: 'claude-haiku-4-5-20250514' },
      { provider: 'openai', modelId: 'gpt-5.6-luna' },
    ],
    notes: 'Reserved',
  },
  code_assist: {
    taskClass: 'code_assist',
    requiredMethod: 'messages',
    preferred: [
      { provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
      { provider: 'openai', modelId: 'gpt-5.6-sol' },
    ],
    notes: 'Reserved',
  },
}
