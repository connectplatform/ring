/**
 * Shared docs media status types (safe for client + server imports).
 * Implementation lives in docs-article-enrichment.ts (server-only).
 */

export type MediaReadyState = 'ready' | 'generating' | 'missing'

export type DocsArticleLlmText = {
  schema_version: '1.0'
  object_type: 'docs_article'
  name: string
  description: string
  locale: string
  slug: string
  core_concepts: string[]
  facts: string[]
  keywords: string[]
  relationships: string[]
  audible_text?: string
  tts_audio_url?: string
  source_content_hash: string
  updated: string
}

export type DocsArticleMediaStatus = {
  locale: string
  slug: string[]
  title: string
  contentSha256: string
  audible: MediaReadyState
  agent: MediaReadyState
  visual: MediaReadyState
  audioUrl?: string
  videoUrl?: string
  audibleText?: string
  nodusUrl: string
  llmText?: DocsArticleLlmText
  shouldEnrich: boolean
}
