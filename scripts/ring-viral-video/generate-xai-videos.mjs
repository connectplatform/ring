#!/usr/bin/env node
/**
 * xAI Grok video batch runner (LEGACY direct xAI) — prefer run-scripted-video.mjs for full pipeline.
 *
 * Usage:
 *   node generate-xai-videos.mjs                         # legacy direct xAI
 *   node run-scripted-video.mjs scripted-video-generation-request-hoa-nightclub.json  # preferred
 *   node generate-xai-videos.mjs --production            # all clips, 720p
 *   node generate-xai-videos.mjs --draft 03_sf_nightclub  # one clip
 *   node generate-xai-videos.mjs --remaster 03_sf...     # 720p re-gen OR edit if --source-url set
 *   node generate-xai-videos.mjs --remaster 03 --source-url=https://cdn.../draft.mp4
 *   node generate-xai-videos.mjs --download
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const ENV_PATH = join(ROOT, '.env.local')
const JOBS_PATH = join(__dirname, 'xai-video-jobs.json')
const PRESETS_PATH = join(ROOT, 'lib/video/video-presets.json')
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
    return { version: 2, clips: [], runs: [] }
  }
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    return {
      version: 2,
      clips: Array.isArray(parsed.clips) ? parsed.clips : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      ...parsed,
    }
  } catch {
    return { version: 2, clips: [], runs: [] }
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
  let qualityMode = 'draft'
  if (flags.has('production') || flags.has('prod') || flags.has('720p')) qualityMode = 'production'
  if (flags.has('draft_i2v') || flags.has('i2v')) qualityMode = 'draft_i2v'
  if (flags.has('draft') && !flags.has('production')) qualityMode = flags.has('draft_i2v') ? 'draft_i2v' : 'draft'
  return {
    qualityMode,
    remaster: flags.has('remaster'),
    download: flags.has('download'),
    clipIds: positional,
    sourceVideoUrl: kv['source-url'] || kv.sourceUrl || '',
  }
}

function resolveEffectiveQualityMode({ qualityMode, imageUrl, remaster, sourceVideoUrl }) {
  if (remaster && sourceVideoUrl) return 'production'
  if (remaster) return imageUrl?.trim() ? 'production_i2v' : 'production'
  if (qualityMode === 'draft' && imageUrl?.trim()) return 'draft_i2v'
  return qualityMode
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function startVideo(apiKey, baseUrl, clip, preset, { edit = false, sourceVideoUrl } = {}) {
  const url = edit ? `${baseUrl}/videos/edits` : `${baseUrl}/videos/generations`
  const body = edit
    ? {
        model: clip.model || preset.model || presetsDefaults().remasterEditModel,
        prompt: clip.prompt,
        video: { url: sourceVideoUrl },
      }
    : {
        model: clip.model || preset.model,
        prompt: clip.prompt,
        duration: clip.duration,
        aspect_ratio: clip.aspect_ratio || '16:9',
        resolution: clip.resolution || preset.resolution,
        ...(clip.imageUrl?.trim() ? { image: { url: clip.imageUrl.trim() } } : {}),
      }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}: ${JSON.stringify(data)}`)
  }
  return data.request_id
}

function presetsDefaults() {
  return JSON.parse(readFileSync(PRESETS_PATH, 'utf8')).defaults
}

async function pollVideo(apiKey, baseUrl, requestId, maxWaitMs, intervalMs) {
  const started = Date.now()
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(`${baseUrl}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error?.message || `Poll HTTP ${res.status}`)
    if (data.status === 'done') return data
    if (data.status === 'failed' || data.status === 'expired') {
      throw new Error(`Video ${data.status}: ${JSON.stringify(data.error || data)}`)
    }
    process.stdout.write('.')
    await sleep(intervalMs)
  }
  throw new Error(`Timeout waiting for ${requestId}`)
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

function findDraftEntry(manifest, clipId) {
  return manifest.clips.find(
    (c) => c.id === clipId && ['draft', 'draft_i2v'].includes(c.qualityMode) && c.status === 'done',
  )
}

async function main() {
  const env = loadEnvFile(ENV_PATH)
  const apiKey = env.XAI_API_KEY || process.env.XAI_API_KEY
  if (!apiKey) {
    console.error('Missing XAI_API_KEY in .env.local')
    process.exit(1)
  }

  const baseUrl = (env.XAI_API_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '')
  const presets = JSON.parse(readFileSync(PRESETS_PATH, 'utf8'))
  const jobs = JSON.parse(readFileSync(JOBS_PATH, 'utf8'))
  const args = parseArgs(process.argv.slice(2))

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(FILES_DIR, { recursive: true })

  const manifest = loadManifest()
  const runId = randomRunId()
  const runMeta = {
    runId,
    startedAt: new Date().toISOString(),
    remaster: args.remaster,
    clipIds: args.clipIds,
    sourceVideoUrl: args.sourceVideoUrl || undefined,
  }
  manifest.runs.push(runMeta)
  saveManifest(manifest)

  const clipIds = args.clipIds.length ? args.clipIds : jobs.clips.map((c) => c.id)
  const clips = jobs.clips.filter((c) => clipIds.includes(c.id))

  if (clips.length === 0) {
    console.error('No clips matched. Available:', jobs.clips.map((c) => c.id).join(', '))
    process.exit(1)
  }

  const pollTimeout = Number(env.VIDEO_GEN_POLL_TIMEOUT_MS || presets.defaults.pollTimeoutMs)
  const pollInterval = Number(env.VIDEO_GEN_POLL_INTERVAL_MS || presets.defaults.pollIntervalMs)

  for (const clip of clips) {
    const draftRef = args.remaster ? findDraftEntry(manifest, clip.id) : null
    const sourceVideoUrl = args.sourceVideoUrl || draftRef?.url || ''
    const useEdit = Boolean(args.remaster && sourceVideoUrl)

    const qualityMode = resolveEffectiveQualityMode({
      qualityMode: args.remaster ? 'production' : args.qualityMode,
      imageUrl: clip.imageUrl,
      remaster: args.remaster,
      sourceVideoUrl: useEdit ? sourceVideoUrl : '',
    })

    const preset = presets.modes[qualityMode]
    if (!preset && !useEdit) {
      console.error('Unknown quality mode:', qualityMode)
      process.exit(1)
    }

    if (args.remaster && !draftRef && !args.sourceVideoUrl) {
      console.warn(`\n⚠ No draft URL for ${clip.id} — remastering via re-generate at ${qualityMode}`)
    }

    const modeLabel = useEdit ? 'edit/remaster' : qualityMode
    const model = useEdit ? presets.defaults.remasterEditModel : clip.model || preset.model
    const resolution = useEdit ? 'source' : clip.resolution || preset.resolution
    const rate = preset?.estimatedUsdPerSecond ?? 0.05

    console.log(`\n▶ ${clip.id} [${modeLabel}] (${clip.duration}s) · ${model} @ ${resolution}`)
    if (clip.imageUrl?.trim()) console.log(`  imageUrl: ${clip.imageUrl.trim().slice(0, 80)}…`)
    if (useEdit) console.log(`  sourceVideoUrl: ${sourceVideoUrl.slice(0, 80)}…`)

    runMeta.qualityMode = qualityMode

    const entry = {
      id: clip.id,
      qualityMode: useEdit ? 'production_edit' : qualityMode,
      duration: clip.duration,
      model,
      resolution,
      status: 'pending',
      generationKind: useEdit ? 'edit' : 'generate',
      imageUrl: clip.imageUrl,
      remasterFromRequestId: draftRef?.requestId,
      remasterFromVideoUrl: useEdit ? sourceVideoUrl : undefined,
      estimatedUsdPerSecond: rate,
      estimatedCostUsd: Math.round(clip.duration * rate * 100) / 100,
    }

    upsertClip(manifest, entry)

    try {
      const requestId = await startVideo(apiKey, baseUrl, clip, preset || {}, {
        edit: useEdit,
        sourceVideoUrl,
      })
      entry.requestId = requestId
      upsertClip(manifest, { ...entry, status: 'polling' })
      console.log(`  request_id: ${requestId}`)

      const result = await pollVideo(apiKey, baseUrl, requestId, pollTimeout, pollInterval)
      console.log('\n  ✓ done')

      entry.status = 'done'
      entry.url = result.video?.url
      entry.respectModeration = result.video?.respect_moderation
      entry.actualDuration = result.video?.duration

      if (args.download && entry.url) {
        const fileName = `${clip.id}-${entry.qualityMode}.mp4`
        const filePath = join(FILES_DIR, fileName)
        await downloadFile(entry.url, filePath)
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
  console.log('\nManifest (cumulative):', MANIFEST_PATH)
}

function randomRunId() {
  return `run-${Date.now().toString(36)}`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
