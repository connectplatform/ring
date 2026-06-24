#!/usr/bin/env node
/**
 * Scripted media pipeline CLI — reads scripted-video-generation-request-*.json,
 * compiles prompts, POSTs each clip to /api/mcp/v1/videos/generate (VideoConductor).
 *
 * Usage:
 *   node run-scripted-video.mjs scripted-video-generation-request-hoa-nightclub.json
 *   node run-scripted-video.mjs request.json --clip 03_sf_nightclub_ring_opener
 *   node run-scripted-video.mjs request.json --remaster --source-url=https://...
 *   node run-scripted-video.mjs request.json --direct   # bypass gateway, xAI only (no thumbnail)
 *   node run-scripted-video.mjs request.json --download
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const ENV_PATH = join(ROOT, '.env.local')
const OUT_DIR = join(__dirname, 'output')
const FILES_DIR = join(OUT_DIR, 'files')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 3, requestId: null, clips: [], runs: [] }
  }
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    return {
      version: 3,
      clips: Array.isArray(parsed.clips) ? parsed.clips : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      requestId: parsed.requestId ?? null,
      ...parsed,
    }
  } catch {
    return { version: 3, requestId: null, clips: [], runs: [] }
  }
}

function clipKey(id, qualityMode) {
  return `${id}::${qualityMode}`
}

function upsertClip(manifest, entry) {
  const key = clipKey(entry.id, entry.qualityMode)
  const idx = manifest.clips.findIndex((c) => clipKey(c.id, c.qualityMode) === key)
  const row = { ...entry, _key: key, updatedAt: new Date().toISOString() }
  if (idx >= 0) manifest.clips[idx] = { ...manifest.clips[idx], ...row }
  else manifest.clips.push(row)
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

function parseArgs(argv) {
  const flags = new Set()
  const kv = {}
  const positional = []
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const body = arg.slice(2)
      const eq = body.indexOf('=')
      if (eq === -1) flags.add(body)
      else {
        const key = body.slice(0, eq)
        flags.add(key)
        kv[key] = body.slice(eq + 1)
      }
    } else positional.push(arg)
  }

  const clipFilter = kv.clip || kv['clip-id'] || (flags.has('clip') ? positional[1] : null)

  return {
    requestPath: positional[0],
    clipIds: clipFilter ? [clipFilter] : [],
    remaster: flags.has('remaster'),
    download: flags.has('download'),
    direct: flags.has('direct'),
    sourceVideoUrl: kv['source-url'] || kv.sourceUrl || '',
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getServiceToken(env) {
  const tokens = (env.RING_MCP_SERVICE_TOKENS || process.env.RING_MCP_SERVICE_TOKENS || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return tokens[0] || env.RING_SERVICE_TOKEN || process.env.RING_SERVICE_TOKEN || ''
}

async function postViaGateway(baseUrl, token, body) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/mcp/v1/videos/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Gateway HTTP ${res.status}`)
  }
  if (!data.success || !data.data?.success) {
    throw new Error(data.data?.error || data.error || 'Video generation failed')
  }
  return data.data
}

/** Minimal inline compile when running --direct without TS build */
function resolveCastPlaceholders(text, cast = []) {
  const map = new Map(cast.map((c) => [c.id, c.description]))
  return text.replace(/\{\{([a-z][a-z0-9_]*)\}\}/gi, (_, id) => map.get(id) ?? `{{${id}}}`)
}

function compileScenePrompt(clip, cast = [], setting) {
  if (clip.prompt?.trim()) return clip.prompt.trim()
  const parts = []
  if (setting?.trim()) parts.push(setting.trim())
  if (clip.scene?.camera?.trim()) parts.push(`CAMERA: ${clip.scene.camera.trim()}`)
  if (clip.scene?.action?.trim()) {
    parts.push(`ACTION: ${resolveCastPlaceholders(clip.scene.action.trim(), cast)}`)
  }
  const dialogue = clip.scene?.dialogue ?? []
  if (dialogue.length > 0) {
    const lines = dialogue.map((d) => {
      const tone = d.tone?.trim() ? ` (${d.tone.trim()})` : ''
      return `${d.speaker.replace(/_/g, ' ')}${tone} says: "${d.line.trim()}"`
    })
    parts.push(`DIALOGUE: ${lines.join(' ')}`)
    parts.push('Realistic lip movement, speaking over ambient sound, no burned-in subtitles.')
  }
  if (parts.length === 0) throw new Error(`Clip ${clip.id}: scene or prompt required`)
  return parts.join(' ')
}

function compileFirstFramePrompt(clip, cast = [], setting) {
  const raw = clip.firstFrame?.imagePrompt?.trim()
  if (!raw) return undefined
  let prompt = resolveCastPlaceholders(raw, cast)
  if (setting?.trim()) prompt = `${prompt} Setting: ${setting.trim()}.`
  if (clip.aspectRatio) {
    prompt = `${prompt} Aspect ratio ${clip.aspectRatio}, cinematic still frame, photorealistic, no text overlays, no watermarks.`
  }
  return prompt.trim()
}

function clipToBody(request, clip, options = {}) {
  const defaults = request.defaults ?? {}
  const scenePrompt = compileScenePrompt(clip, request.cast ?? [], request.setting)
  const firstFramePrompt = compileFirstFramePrompt(clip, request.cast ?? [], request.setting)
  const imageUrl = clip.firstFrame?.imageUrl?.trim() || undefined
  return {
    prompt: scenePrompt,
    qualityMode: clip.video?.qualityMode ?? defaults.qualityMode ?? 'draft',
    duration: clip.duration ?? defaults.duration,
    aspectRatio: clip.aspectRatio ?? defaults.aspectRatio ?? '16:9',
    resolution: clip.video?.resolution ?? defaults.videoResolution,
    model: clip.video?.model,
    imageUrl,
    firstFramePrompt: imageUrl ? undefined : firstFramePrompt,
    imageProvider: clip.firstFrame?.imageProvider ?? defaults.imageProvider ?? defaults.provider,
    imageModel: clip.firstFrame?.imageModel,
    imageResolution: clip.firstFrame?.imageResolution ?? defaults.imageResolution ?? '2k',
    purpose: request.purpose,
    refCode: request.refCode ?? request.requestId,
    clipId: clip.id,
    pipelineRequestId: request.requestId,
    thumbnail: clip.thumbnail,
    remaster: options.remaster,
    sourceVideoUrl: options.sourceVideoUrl || clip.remaster?.sourceVideoUrl,
    remasterFromRequestId: options.remasterFromRequestId || clip.remaster?.remasterFromRequestId,
    persistToFilebase: true,
  }
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

function findDraftEntry(manifest, clipId) {
  return manifest.clips.find(
    (c) =>
      c.id === clipId &&
      ['draft', 'draft_i2v'].includes(c.qualityMode) &&
      c.status === 'done',
  )
}

async function main() {
  const env = loadEnvFile(ENV_PATH)
  const args = parseArgs(process.argv.slice(2))

  if (!args.requestPath) {
    console.error('Usage: node run-scripted-video.mjs <request.json> [--clip id] [--remaster] [--download] [--direct]')
    process.exit(1)
  }

  const requestPath = args.requestPath.startsWith('/')
    ? args.requestPath
    : join(process.cwd(), args.requestPath)

  const request = JSON.parse(readFileSync(requestPath, 'utf8'))
  if (request.schemaVersion !== '1.0' || !request.requestId || !Array.isArray(request.clips)) {
    console.error('Invalid scripted video request file')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(FILES_DIR, { recursive: true })

  const manifest = loadManifest()
  manifest.version = 3
  manifest.requestId = request.requestId

  const runId = `run-${Date.now().toString(36)}`
  const runMeta = {
    runId,
    startedAt: new Date().toISOString(),
    requestId: request.requestId,
    requestPath,
    remaster: args.remaster,
    direct: args.direct,
    clipIds: args.clipIds,
  }
  manifest.runs.push(runMeta)
  saveManifest(manifest)

  const clipIds = args.clipIds.length ? args.clipIds : request.clips.map((c) => c.id)
  const clips = request.clips.filter((c) => clipIds.includes(c.id))

  if (clips.length === 0) {
    console.error('No clips matched. Available:', request.clips.map((c) => c.id).join(', '))
    process.exit(1)
  }

  const baseUrl = env.RING_API_BASE_URL || process.env.RING_API_BASE_URL || 'http://localhost:3000'
  const token = getServiceToken(env)

  if (!args.direct && !token) {
    console.error('Missing RING_MCP_SERVICE_TOKENS — use --direct for xAI-only fallback or configure gateway token')
    process.exit(1)
  }

  if (args.direct) {
    console.warn('--direct mode: thumbnail/firstFrame chaining requires gateway; falling back to generate-xai-videos.mjs')
    const { spawnSync } = await import('node:child_process')
    const legacy = join(__dirname, 'generate-xai-videos.mjs')
    const legacyArgs = []
    if (args.remaster) legacyArgs.push('--remaster')
    else legacyArgs.push('--draft')
    legacyArgs.push(...clipIds)
    if (args.download) legacyArgs.push('--download')
    const result = spawnSync(process.execPath, [legacy, ...legacyArgs], { stdio: 'inherit' })
    process.exit(result.status ?? 1)
  }

  console.log(`Pipeline: ${request.requestId} · ${clips.length} clip(s) · gateway ${baseUrl}`)

  for (const clip of clips) {
    const draftRef = args.remaster ? findDraftEntry(manifest, clip.id) : null
    const sourceVideoUrl = args.sourceVideoUrl || draftRef?.url || ''

    const body = clipToBody(request, clip, {
      remaster: args.remaster,
      sourceVideoUrl: args.remaster && sourceVideoUrl ? sourceVideoUrl : undefined,
      remasterFromRequestId: draftRef?.requestId,
    })

    const qualityMode = body.remaster
      ? sourceVideoUrl
        ? 'production_edit'
        : body.imageUrl || body.firstFramePrompt
          ? 'production_i2v'
          : 'production'
      : body.firstFramePrompt || body.imageUrl
        ? 'draft_i2v'
        : body.qualityMode

    console.log(`\n▶ ${clip.id} [${qualityMode}] (${body.duration}s)`)
    if (body.firstFramePrompt) console.log(`  firstFramePrompt: ${body.firstFramePrompt.slice(0, 72)}…`)

    const entry = {
      id: clip.id,
      pipelineRequestId: request.requestId,
      qualityMode,
      duration: body.duration,
      status: 'pending',
      generationKind: body.remaster && sourceVideoUrl ? 'edit' : 'generate',
      remasterFromRequestId: body.remasterFromRequestId,
      remasterFromVideoUrl: sourceVideoUrl || undefined,
    }
    upsertClip(manifest, entry)

    try {
      const result = await postViaGateway(baseUrl, token, body)

      entry.status = 'done'
      entry.requestId = result.requestId
      entry.url = result.video?.url
      entry.temporaryUrl = result.video?.temporaryUrl
      entry.firstFrameUrl = result.firstFrame?.url
      entry.thumbnailUrl = result.thumbnail?.url
      entry.estimatedCostUsd = result.estimatedCostUsd
      entry.model = result.model
      entry.resolution = result.resolution

      console.log(`  ✓ requestId: ${result.requestId}`)
      if (result.firstFrame?.url) console.log(`  firstFrame: ${result.firstFrame.url}`)
      if (result.thumbnail?.url) console.log(`  thumbnail: ${result.thumbnail.url}`)
      if (result.video?.url) console.log(`  video: ${result.video.url}`)

      if (args.download && result.video?.url) {
        const filePath = join(FILES_DIR, `${clip.id}-${qualityMode}.mp4`)
        await downloadFile(result.video.url, filePath)
        entry.localPath = filePath
        console.log(`  saved: ${filePath}`)
      }

      upsertClip(manifest, entry)
    } catch (err) {
      console.error(`\n  ✗ ${clip.id}:`, err.message)
      upsertClip(manifest, { ...entry, status: 'error', error: err.message })
    }
  }

  runMeta.finishedAt = new Date().toISOString()
  saveManifest(manifest)
  console.log('\nManifest (v3 cumulative):', MANIFEST_PATH)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
