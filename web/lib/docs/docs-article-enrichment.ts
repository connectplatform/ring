/**
 * Docs article enrichment SSOT — audible-text, tts-audio, llm-text (NODUS).
 * MDX remains human SSOT; derived cache invalidated by full content SHA-256.
 *
 * TODO(gc): garbage-collect invalidated audibles + audible-text (+ nodus history)
 * older than 1 year from docs_article_enrichment.history / ring-filebase objects.
 */
import 'server-only'

import { createHash } from 'crypto'
import { db } from '@/lib/database'
import { TextConductor } from '@/lib/text'
import { AudioConductor } from '@/lib/audio'
import { getAudioStoragePrefix } from '@/lib/audio/audio.config'
import { readDocMatter } from '@/lib/docs/docs-article'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import { buildDocsHref } from '@/lib/docs/docs-path-url'
import { logger } from '@/lib/logger'
import type {
  DocsArticleLlmText,
  DocsArticleMediaStatus,
  MediaReadyState,
} from '@/lib/docs/docs-media-types'

export type { DocsArticleLlmText, DocsArticleMediaStatus, MediaReadyState } from '@/lib/docs/docs-media-types'

export type TtsAudioMeta = {
  url: string
  objectKey: string
  /** Full SHA-256 of article plain content (filename stem). */
  contentSha256: string
  voiceId?: string
  provider?: string
  generatedAt: string
}

export type InvalidatedAudibleRecord = {
  objectKey: string
  contentSha256: string
  url?: string
  audibleText?: string
  invalidatedAt: string
  status: 'invalidated'
}

export type InvalidatedLlmRecord = {
  contentSha256: string
  llmText?: DocsArticleLlmText
  invalidatedAt: string
  status: 'invalidated'
}

export type DocsArticleEnrichment = {
  id: string
  locale: string
  slug: string
  /** Full SHA-256 of locale:slug:plain */
  contentSha256: string
  audibleText?: string
  ttsAudio?: TtsAudioMeta
  llmText?: DocsArticleLlmText
  /** Optional Visual walkthrough media (member+), keyed by article SHA */
  visualMedia?: {
    videoUrl?: string
    audioUrl?: string
    contentSha256: string
    generatedAt: string
  }
  /** In-flight flags for page-load / Create flows */
  generatingAudible?: boolean
  generatingLlm?: boolean
  generatingVisual?: boolean
  history?: {
    audibles: InvalidatedAudibleRecord[]
    llmTexts: InvalidatedLlmRecord[]
  }
  created_at: string
  updated_at: string
}

/** Stale lock TTL — crashed workers leave generating* true forever without this. */
const GENERATING_STALE_MS = 10 * 60 * 1000

function isFreshFlag(updatedAt: string | undefined, flag: boolean | undefined): boolean {
  if (!flag) return false
  const ts = Date.parse(updatedAt || '')
  if (!Number.isFinite(ts)) return true
  return Date.now() - ts < GENERATING_STALE_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function enrichmentId(locale: string, slug: string[]): string {
  const slugKey = slug.join('/') || 'index'
  return `docs-enrich-${locale}-${createHash('sha256').update(slugKey).digest('hex').slice(0, 24)}`.slice(
    0,
    200,
  )
}

/** Full content SHA-256 — also used as ring-filebase audio filename stem. */
export function hashArticleContentSha256(locale: string, slug: string[], plain: string): string {
  return createHash('sha256').update(`${locale}:${slug.join('/')}:${plain}`).digest('hex')
}

function docsAudioObjectKey(sha256: string): string {
  return `${getAudioStoragePrefix()}/docs/${sha256}.mp3`
}

function stripMdxForSpeech(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{`[\s\S]*?`\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/[#*_>`\[\]]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHeadings(mdx: string): string[] {
  const headings: string[] = []
  for (const line of mdx.split('\n')) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (m) headings.push(m[2].replace(/[*_`]/g, '').trim())
  }
  return headings.slice(0, 24)
}

function extractFacts(mdx: string): string[] {
  const facts: string[] = []
  const envHits: string[] = mdx.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []
  const uniqEnv = [...new Set(envHits.filter((e) => e.includes('_')))].slice(0, 12)
  for (const e of uniqEnv) facts.push(`Env: ${e}`)
  const cmdHits: string[] = mdx.match(/`([^`]{3,80})`/g) ?? []
  for (const c of cmdHits.slice(0, 10)) {
    const inner = c.slice(1, -1)
    if (/npm |npx |yarn |pnpm |kubectl |psql |git /.test(inner)) {
      facts.push(`Command: ${inner}`)
    }
  }
  return facts.slice(0, 20)
}

function extractRelated(mdx: string): string[] {
  const rel: string[] = []
  const linkRe = /\[([^\]]+)\]\(\/docs\/([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(mdx)) !== null) {
    rel.push(`${m[1]} → /docs/${m[2].replace(/\.mdx?$/, '')}`)
  }
  return [...new Set(rel)].slice(0, 12)
}

function keywordsFromFrontmatter(
  kw: string[] | string | undefined,
  title: string,
  headings: string[],
): string[] {
  const fromFm = Array.isArray(kw)
    ? kw
    : typeof kw === 'string'
      ? kw.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return [...new Set([...fromFm, ...title.split(/\s+/).slice(0, 4), ...headings.slice(0, 4)])]
    .map((k) => k.toLowerCase())
    .filter((k) => k.length > 2)
    .slice(0, 16)
}

function radioHostInstructions(locale: string): string {
  const lang =
    locale === 'uk'
      ? 'Ukrainian'
      : locale === 'ru'
        ? 'Russian'
        : locale === 'es'
          ? 'Spanish'
          : locale === 'de'
            ? 'German'
            : 'English'
  return [
    `ROLE: radio host. LANGUAGE: ${lang}. OUTPUT: spoken prose only.`,
    'FORMAT: (1) cold-open use-case, (2) gist 2–4 sentences, (3) vital params as spoken phrases, (4) typical org use cases, (5) pitfalls + related materials, (6) soft close with next step.',
    'CONSTRAINTS: no markdown, no tables, no code fences, no UI widget names. Max 500 words. Prefer listener attention over exhaustive heading dumps.',
  ].join(' ')
}

/**
 * Machine-first align prompt when a prior audible exists for an older SHA.
 * Goal: seamless insert of new facts; silent removal of obsolete facts; fresh script per SHA-256.
 */
function alignAudibleInstructions(locale: string, existingAudibleText: string, articleText: string): string {
  return [
    radioHostInstructions(locale),
    'TASK_MODE: ALIGN_EXISTING_AUDIBLE',
    `PRIOR_AUDIBLE (concepts + use cases already spoken):\n${existingAudibleText.slice(0, 4500)}`,
    `CURRENT_ARTICLE (source of truth):\n${articleText.slice(0, 5000)}`,
    'COMPARE prior audible against CURRENT_ARTICLE.',
    'INSERT: only missing facts that must be spoken — weave edits seamlessly into radio-host flow (no "update:" or append-style seams).',
    'DELETE: obsolete or false facts — remove without trace; do not announce removals; keep listener focus on current subject truth.',
    'OUTPUT: one complete replacement audible script for the new content SHA. Do not summarize the diff.',
  ].join('\n\n')
}

async function loadEnrichment(id: string): Promise<DocsArticleEnrichment | null> {
  try {
    const found = await db().findDocById<DocsArticleEnrichment>('docs_article_enrichment', id)
    if (found.success && found.data) {
      return { ...found.data, id }
    }
  } catch (e) {
    logger.warn('[docs-enrichment] load failed', { id, error: e })
  }
  return null
}

async function saveEnrichment(record: DocsArticleEnrichment): Promise<void> {
  try {
    const existing = await db().findDocById('docs_article_enrichment', record.id)
    if (existing.success && existing.data) {
      await db().updateDoc('docs_article_enrichment', record.id, {
        ...record,
        created_at: (existing.data as DocsArticleEnrichment).created_at ?? record.created_at,
      })
      return
    }
    const created = await db().createDoc('docs_article_enrichment', record, { id: record.id })
    if (!created.success) {
      logger.warn('[docs-enrichment] create failed', { id: record.id, error: created.error })
    }
  } catch (e) {
    logger.warn('[docs-enrichment] save failed', { id: record.id, error: e })
  }
}

function loadArticlePlain(locale: string, slug: string[]) {
  const { filePath } = resolveDocFilePath(locale, slug)
  if (!filePath) return null
  const matter = readDocMatter(filePath)
  if (!matter) return null
  const title = matter.data.title || slug[slug.length - 1] || 'Untitled'
  const plain = stripMdxForSpeech(matter.content)
  const contentSha256 = hashArticleContentSha256(locale, slug, plain)
  return { filePath, matter, title: String(title), plain, contentSha256 }
}

function invalidatePriorAudible(
  existing: DocsArticleEnrichment | null,
  nextSha: string,
): { history: DocsArticleEnrichment['history']; keepAudibleText: boolean } {
  const history = {
    audibles: [...(existing?.history?.audibles ?? [])],
    llmTexts: [...(existing?.history?.llmTexts ?? [])],
  }
  // Reuse radio-host script for same SHA even when TTS object is still missing
  const keepAudibleText =
    !!existing && existing.contentSha256 === nextSha && !!existing.audibleText?.trim()

  if (existing?.ttsAudio && existing.contentSha256 !== nextSha) {
    history.audibles.push({
      objectKey: existing.ttsAudio.objectKey,
      contentSha256: existing.ttsAudio.contentSha256 || existing.contentSha256,
      url: existing.ttsAudio.url,
      audibleText: existing.audibleText,
      invalidatedAt: new Date().toISOString(),
      status: 'invalidated',
    })
  }
  return { history, keepAudibleText }
}

function invalidatePriorLlm(
  existing: DocsArticleEnrichment | null,
  nextSha: string,
): DocsArticleEnrichment['history'] {
  const history = {
    audibles: [...(existing?.history?.audibles ?? [])],
    llmTexts: [...(existing?.history?.llmTexts ?? [])],
  }
  if (existing?.llmText && existing.contentSha256 !== nextSha) {
    history.llmTexts.push({
      contentSha256: existing.contentSha256,
      llmText: existing.llmText,
      invalidatedAt: new Date().toISOString(),
      status: 'invalidated',
    })
  }
  return history
}

/** Snapshot status for Play / Agent / Visual buttons (no generation). */
export async function getDocsArticleMediaStatus(input: {
  locale: string
  slug: string[]
}): Promise<DocsArticleMediaStatus | null> {
  const article = loadArticlePlain(input.locale, input.slug)
  if (!article) return null

  const id = enrichmentId(input.locale, input.slug)
  let existing = await loadEnrichment(id)
  const nodusUrl = `${buildDocsHref(input.locale, input.slug)}/nodus.json`

  // Clear crashed/stale generating locks so buttons are not stuck forever
  if (existing) {
    const audibleStale =
      !!existing.generatingAudible && !isFreshFlag(existing.updated_at, existing.generatingAudible)
    const llmStale =
      !!existing.generatingLlm && !isFreshFlag(existing.updated_at, existing.generatingLlm)
    const visualStale =
      !!existing.generatingVisual && !isFreshFlag(existing.updated_at, existing.generatingVisual)
    if (audibleStale || llmStale || visualStale) {
      await saveEnrichment({
        ...existing,
        generatingAudible: audibleStale ? false : existing.generatingAudible,
        generatingLlm: llmStale ? false : existing.generatingLlm,
        generatingVisual: visualStale ? false : existing.generatingVisual,
        updated_at: new Date().toISOString(),
      })
      existing = await loadEnrichment(id)
    }
  }

  const shaMatch = existing?.contentSha256 === article.contentSha256
  const audibleGenerating = isFreshFlag(existing?.updated_at, existing?.generatingAudible)
  const agentGenerating = isFreshFlag(existing?.updated_at, existing?.generatingLlm)
  const visualGenerating = isFreshFlag(existing?.updated_at, existing?.generatingVisual)

  const audibleReady =
    shaMatch &&
    !!existing?.audibleText &&
    !!existing?.ttsAudio?.url &&
    existing.ttsAudio.contentSha256 === article.contentSha256 &&
    !audibleGenerating
  const agentReady =
    shaMatch &&
    !!existing?.llmText?.name &&
    existing.llmText.source_content_hash === article.contentSha256 &&
    !agentGenerating
  const visualReady =
    shaMatch &&
    !!existing?.visualMedia?.videoUrl &&
    existing.visualMedia.contentSha256 === article.contentSha256 &&
    !visualGenerating

  const audible: MediaReadyState = audibleGenerating
    ? 'generating'
    : audibleReady
      ? 'ready'
      : 'missing'
  const agent: MediaReadyState = agentGenerating
    ? 'generating'
    : agentReady
      ? 'ready'
      : 'missing'
  const visual: MediaReadyState = visualGenerating
    ? 'generating'
    : visualReady
      ? 'ready'
      : 'missing'

  return {
    locale: input.locale,
    slug: input.slug,
    title: article.title,
    contentSha256: article.contentSha256,
    audible,
    agent,
    visual,
    audioUrl: audibleReady ? existing?.ttsAudio?.url : undefined,
    videoUrl: visualReady ? existing?.visualMedia?.videoUrl : undefined,
    audibleText: audibleReady ? existing?.audibleText : undefined,
    nodusUrl,
    llmText: agentReady ? existing?.llmText : undefined,
    shouldEnrich: audible === 'missing' || agent === 'missing',
  }
}

/**
 * Ensure audible-text exists for this article SHA (TextConductor radio-host).
 * When prior audible exists for another SHA, align via compare/edit prompt.
 */
export async function ensureAudibleText(input: {
  locale: string
  slug: string[]
  title?: string
}): Promise<{ audibleText: string; contentSha256: string; cached: boolean }> {
  const article = loadArticlePlain(input.locale, input.slug)
  if (!article) throw new Error('Document not found')

  const id = enrichmentId(input.locale, input.slug)
  const existing = await loadEnrichment(id)
  const { history, keepAudibleText } = invalidatePriorAudible(existing, article.contentSha256)

  if (keepAudibleText && existing?.audibleText) {
    return { audibleText: existing.audibleText, contentSha256: article.contentSha256, cached: true }
  }

  const priorAudible =
    existing?.audibleText && existing.contentSha256 !== article.contentSha256
      ? existing.audibleText
      : undefined

  let audibleText = ''
  const structured = await TextConductor.generateStructured<{ audibleText: string }>(
    {
      input: priorAudible
        ? `Title: ${article.title}`
        : `Title: ${article.title}\n\nDocumentation source (facts only):\n${article.plain.slice(0, 5000)}`,
      instructions: priorAudible
        ? alignAudibleInstructions(input.locale, priorAudible, article.plain)
        : radioHostInstructions(input.locale),
    },
    {
      name: 'docs_audible_text',
      schema: {
        type: 'object',
        properties: {
          audibleText: { type: 'string', description: 'Radio-host narration script' },
        },
        required: ['audibleText'],
        additionalProperties: false,
      },
    },
  )

  if (structured.success && structured.structured?.audibleText?.trim()) {
    audibleText = structured.structured.audibleText.trim().slice(0, 6000)
  } else {
    logger.warn('[docs-enrichment] TextConductor audible failed — fallback strip', {
      error: structured.error,
      slug: input.slug,
    })
    audibleText = `${article.title}. ${article.plain}`.slice(0, 3500)
  }

  const now = new Date().toISOString()
  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256: article.contentSha256,
    audibleText,
    ttsAudio: keepAudibleText ? existing?.ttsAudio : undefined,
    llmText:
      existing?.contentSha256 === article.contentSha256 ? existing?.llmText : undefined,
    visualMedia:
      existing?.contentSha256 === article.contentSha256 ? existing?.visualMedia : undefined,
    generatingAudible: existing?.generatingAudible,
    generatingLlm: existing?.generatingLlm,
    generatingVisual: existing?.generatingVisual,
    history,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  })

  return { audibleText, contentSha256: article.contentSha256, cached: false }
}

/** Synthesize TTS; object key = docs/{sha256}.mp3. Verify SHA before reuse. */
export async function ensureTtsAudio(input: {
  locale: string
  slug: string[]
  title?: string
  /** When true, skip work if another worker already claimed generation. */
  background?: boolean
}): Promise<{ audioUrl: string; audibleText: string; contentSha256: string; cached: boolean }> {
  const article = loadArticlePlain(input.locale, input.slug)
  if (!article) throw new Error('Document not found')

  const id = enrichmentId(input.locale, input.slug)
  let existing = await loadEnrichment(id)

  const ttsReady = (row: DocsArticleEnrichment | null) =>
    !!row &&
    row.contentSha256 === article.contentSha256 &&
    !!row.ttsAudio?.url &&
    row.ttsAudio.contentSha256 === article.contentSha256 &&
    row.ttsAudio.objectKey === docsAudioObjectKey(article.contentSha256) &&
    !!row.audibleText

  if (ttsReady(existing)) {
    return {
      audioUrl: existing!.ttsAudio!.url,
      audibleText: existing!.audibleText!,
      contentSha256: article.contentSha256,
      cached: true,
    }
  }

  // Concurrent after()+client: await in-flight job instead of double TTS spend
  if (isFreshFlag(existing?.updated_at, existing?.generatingAudible)) {
    if (input.background) {
      return {
        audioUrl: existing?.ttsAudio?.url || '',
        audibleText: existing?.audibleText || '',
        contentSha256: article.contentSha256,
        cached: true,
      }
    }
    for (let i = 0; i < 45; i++) {
      await sleep(2000)
      existing = await loadEnrichment(id)
      if (ttsReady(existing)) {
        return {
          audioUrl: existing!.ttsAudio!.url,
          audibleText: existing!.audibleText!,
          contentSha256: article.contentSha256,
          cached: true,
        }
      }
      if (!isFreshFlag(existing?.updated_at, existing?.generatingAudible)) break
    }
  }

  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256: article.contentSha256,
    audibleText: existing?.audibleText,
    ttsAudio: existing?.ttsAudio,
    llmText: existing?.llmText,
    visualMedia: existing?.visualMedia,
    generatingAudible: true,
    generatingLlm: existing?.generatingLlm,
    generatingVisual: existing?.generatingVisual,
    history: existing?.history,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const { audibleText, contentSha256 } = await ensureAudibleText(input)
  existing = await loadEnrichment(id)

  const lang =
    input.locale === 'uk'
      ? 'uk'
      : input.locale === 'ru'
        ? 'ru'
        : input.locale === 'es'
          ? 'es'
          : input.locale === 'de'
            ? 'de'
            : 'en'

  const objectKey = docsAudioObjectKey(contentSha256)
  const audio = await AudioConductor.synthesize({
    text: audibleText,
    language: lang,
    objectKey,
  })

  if (!audio.success || !audio.url) {
    await saveEnrichment({
      id,
      locale: input.locale,
      slug: input.slug.join('/') || 'index',
      contentSha256,
      audibleText,
      ttsAudio: existing?.ttsAudio,
      llmText: existing?.llmText,
      visualMedia: existing?.visualMedia,
      generatingAudible: false,
      generatingLlm: existing?.generatingLlm,
      generatingVisual: existing?.generatingVisual,
      history: existing?.history,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    throw new Error(audio.error || 'Narration failed')
  }

  const now = new Date().toISOString()
  const { history } = invalidatePriorAudible(existing, contentSha256)
  const ttsAudio: TtsAudioMeta = {
    url: audio.url,
    objectKey: audio.objectKey || objectKey,
    contentSha256,
    provider: audio.provider,
    generatedAt: now,
  }

  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256,
    audibleText,
    ttsAudio,
    llmText: existing?.contentSha256 === contentSha256 ? existing?.llmText : undefined,
    visualMedia: existing?.contentSha256 === contentSha256 ? existing?.visualMedia : undefined,
    generatingAudible: false,
    generatingLlm: existing?.generatingLlm,
    generatingVisual: existing?.generatingVisual,
    history,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  })

  return { audioUrl: audio.url, audibleText, contentSha256, cached: false }
}

/** Build / return minimized NODUS llm-text for agents (SHA-keyed, with invalidate history). */
export async function ensureLlmText(input: {
  locale: string
  slug: string[]
  title?: string
  background?: boolean
}): Promise<DocsArticleLlmText> {
  const article = loadArticlePlain(input.locale, input.slug)
  if (!article) throw new Error('Document not found')

  const id = enrichmentId(input.locale, input.slug)
  let existing = await loadEnrichment(id)

  const llmReady = (row: DocsArticleEnrichment | null) =>
    !!row &&
    row.contentSha256 === article.contentSha256 &&
    !!row.llmText?.name &&
    row.llmText.source_content_hash === article.contentSha256

  if (llmReady(existing)) {
    return existing!.llmText!
  }

  if (isFreshFlag(existing?.updated_at, existing?.generatingLlm)) {
    if (input.background) {
      if (existing?.llmText) return existing.llmText
      throw new Error('NODUS generation already in progress')
    }
    for (let i = 0; i < 45; i++) {
      await sleep(2000)
      existing = await loadEnrichment(id)
      if (llmReady(existing)) return existing!.llmText!
      if (!isFreshFlag(existing?.updated_at, existing?.generatingLlm)) break
    }
  }

  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256: article.contentSha256,
    audibleText: existing?.audibleText,
    ttsAudio: existing?.ttsAudio,
    llmText: existing?.llmText,
    visualMedia: existing?.visualMedia,
    generatingAudible: existing?.generatingAudible,
    generatingLlm: true,
    generatingVisual: existing?.generatingVisual,
    history: existing?.history,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  existing = await loadEnrichment(id)
  const history = invalidatePriorLlm(existing, article.contentSha256)

  let audibleText =
    existing?.contentSha256 === article.contentSha256 ? existing.audibleText : undefined
  let ttsUrl =
    existing?.contentSha256 === article.contentSha256 ? existing.ttsAudio?.url : undefined

  const headings = extractHeadings(article.matter.content)
  const facts = extractFacts(article.matter.content)
  const relationships = extractRelated(article.matter.content)
  const description =
    (typeof article.matter.data.description === 'string' && article.matter.data.description) ||
    article.plain.slice(0, 280)

  const llmText: DocsArticleLlmText = {
    schema_version: '1.0',
    object_type: 'docs_article',
    name: article.title,
    description,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    core_concepts: headings.length ? headings : [article.title],
    facts: facts.length ? facts : [`Article: ${article.title}`],
    keywords: keywordsFromFrontmatter(article.matter.data.keywords, article.title, headings),
    relationships,
    audible_text: audibleText,
    tts_audio_url: ttsUrl,
    source_content_hash: article.contentSha256,
    updated: new Date().toISOString().slice(0, 10),
  }

  const now = new Date().toISOString()
  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256: article.contentSha256,
    audibleText,
    ttsAudio: existing?.contentSha256 === article.contentSha256 ? existing.ttsAudio : undefined,
    llmText,
    visualMedia: existing?.contentSha256 === article.contentSha256 ? existing.visualMedia : undefined,
    generatingAudible: existing?.generatingAudible,
    generatingLlm: false,
    generatingVisual: existing?.generatingVisual,
    history,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  })

  return llmText
}

/** Persist Visual walkthrough URLs onto enrichment (SHA-keyed ready state). */
export async function recordDocsVisualMedia(input: {
  locale: string
  slug: string[]
  videoUrl?: string
  audioUrl?: string
}): Promise<void> {
  const article = loadArticlePlain(input.locale, input.slug)
  if (!article) return
  const id = enrichmentId(input.locale, input.slug)
  const existing = await loadEnrichment(id)
  const now = new Date().toISOString()
  await saveEnrichment({
    id,
    locale: input.locale,
    slug: input.slug.join('/') || 'index',
    contentSha256: article.contentSha256,
    audibleText: existing?.audibleText,
    ttsAudio: existing?.ttsAudio,
    llmText: existing?.llmText,
    visualMedia: {
      videoUrl: input.videoUrl,
      audioUrl: input.audioUrl,
      contentSha256: article.contentSha256,
      generatedAt: now,
    },
    generatingAudible: existing?.generatingAudible,
    generatingLlm: existing?.generatingLlm,
    generatingVisual: false,
    history: existing?.history,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  })
}

/**
 * Background enrichment for page load: audible+TTS and NODUS when missing for current SHA.
 * Safe to call from `after()` — errors are logged, not thrown to the page.
 */
export async function ensureDocsArticleEnrichmentBackground(input: {
  locale: string
  slug: string[]
  title?: string
}): Promise<void> {
  try {
    const article = loadArticlePlain(input.locale, input.slug)
    if (!article) return
    const id = enrichmentId(input.locale, input.slug)
    const existing = await loadEnrichment(id)
    const status = await getDocsArticleMediaStatus(input)
    if (!status) return

    if (status.audible === 'missing' || status.agent === 'missing') {
      const now = new Date().toISOString()
      await saveEnrichment({
        id,
        locale: input.locale,
        slug: input.slug.join('/') || 'index',
        contentSha256: article.contentSha256,
        audibleText: existing?.audibleText,
        ttsAudio: existing?.ttsAudio,
        llmText: existing?.llmText,
        visualMedia: existing?.visualMedia,
        generatingAudible: status.audible === 'missing',
        generatingLlm: status.agent === 'missing',
        generatingVisual: existing?.generatingVisual,
        history: existing?.history,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      })
    }

    if (status.audible === 'missing') {
      await ensureTtsAudio({ ...input, background: true })
    }
    const afterAudible = await getDocsArticleMediaStatus(input)
    if (afterAudible?.agent === 'missing') {
      try {
        await ensureLlmText({ ...input, background: true })
      } catch (e) {
        // Concurrent claim is expected when after()+client overlap
        logger.warn('[docs-enrichment] background llm skipped/in-flight', {
          slug: input.slug,
          error: e instanceof Error ? e.message : e,
        })
      }
    }
  } catch (e) {
    logger.warn('[docs-enrichment] background ensure failed', {
      slug: input.slug,
      error: e instanceof Error ? e.message : e,
    })
  }
}

/** @deprecated use hashArticleContentSha256 */
export function hashArticlePlain(locale: string, slug: string[], plain: string): string {
  return hashArticleContentSha256(locale, slug, plain)
}

export function enrichmentContentDigest(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
