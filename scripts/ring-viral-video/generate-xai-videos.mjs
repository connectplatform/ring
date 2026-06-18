#!/usr/bin/env node
/**
 * xAI Grok video batch runner with draft/production modes and cumulative manifest.
 *
 * Usage:
 *   node generate-xai-videos.mjs                    # all clips, draft 480p
 *   node generate-xai-videos.mjs --production       # all clips, 720p
 *   node generate-xai-videos.mjs --draft 01_hoa...  # one clip draft
 *   node generate-xai-videos.mjs --remaster 01_hoa  # 720p from jobs prompt + link draft in manifest
 *   node generate-xai-videos.mjs --download         # also save MP4 under output/files/
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
  const positional = []
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg.slice(2))
    else positional.push(arg)
  }
  let qualityMode = 'draft'
  if (flags.has('production') || flags.has('prod') || flags.has('720p')) qualityMode = 'production'
  if (flags.has('draft') && !flags.has('production')) qualityMode = 'draft'
  return {
    qualityMode,
    remaster: flags.has('remaster'),
    download: flags.has('download'),
    clipIds: positional,
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function startVideo(apiKey, baseUrl, clip, preset) {
  const res = await fetch(`${baseUrl}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: clip.model || preset.model,
      prompt: clip.prompt,
      duration: clip.duration,
      aspect_ratio: clip.aspect_ratio || '16:9',
      resolution: clip.resolution || preset.resolution,
      ...(clip.imageUrl ? { image: { url: clip.imageUrl } } : {}),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}: ${JSON.stringify(data)}`)
  }
  return data.request_id
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
  return manifest.clips.find((c) => c.id === clipId && c.qualityMode === 'draft' && c.status === 'done')
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

  const qualityMode = args.remaster ? 'production' : args.qualityMode
  const preset = presets.modes[qualityMode]
  if (!preset) {
    console.error('Unknown quality mode:', qualityMode)
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(FILES_DIR, { recursive: true })

  const manifest = loadManifest()
  const runId = randomRunId()
  const runMeta = {
    runId,
    startedAt: new Date().toISOString(),
    qualityMode,
    remaster: args.remaster,
    clipIds: args.clipIds,
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

  console.log(`Mode: ${qualityMode} · ${preset.model} @ ${preset.resolution} (~$${preset.estimatedUsdPerSecond}/s)`)

  for (const clip of clips) {
    const draftRef = args.remaster ? findDraftEntry(manifest, clip.id) : null
    if (args.remaster && !draftRef) {
      console.warn(`\n⚠ No draft for ${clip.id} — remastering from jobs prompt anyway`)
    }

    console.log(`\n▶ ${clip.id} [${qualityMode}] (${clip.duration}s)...`)
    const entry = {
      id: clip.id,
      qualityMode,
      duration: clip.duration,
      model: clip.model || preset.model,
      resolution: clip.resolution || preset.resolution,
      status: 'pending',
      remasterFromRequestId: draftRef?.requestId,
      estimatedUsdPerSecond: preset.estimatedUsdPerSecond,
      estimatedCostUsd: Math.round(clip.duration * preset.estimatedUsdPerSecond * 100) / 100,
    }

    upsertClip(manifest, entry)

    try {
      const requestId = await startVideo(apiKey, baseUrl, clip, preset)
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
        const fileName = `${clip.id}-${qualityMode}.mp4`
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
