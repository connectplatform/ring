import { MODEL_CATALOG, findCatalogEntry } from './catalog'
import { TASK_CLASS_ROUTES } from './task-classes'
import type {
  ModelEntry,
  ModelPricing,
  ProviderId,
  ResolveModelOptions,
  ResolvedModel,
  TaskClass,
} from './types'
import { ModelRouterError } from './types'

function readEnvKey(name: string, availableKeys?: Record<string, string | undefined>): string | undefined {
  if (availableKeys) {
    const fromMap = availableKeys[name]
    return typeof fromMap === 'string' && fromMap.trim() ? fromMap.trim() : undefined
  }
  const fromEnv = process.env[name]
  return typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : undefined
}

function resolveKey(
  entry: ModelEntry,
  availableKeys?: Record<string, string | undefined>,
): { keyEnv: string; apiKey: string } | null {
  for (const envName of entry.keyEnv) {
    const apiKey = readEnvKey(envName, availableKeys)
    if (apiKey) return { keyEnv: envName, apiKey }
  }
  return null
}

function resolveBaseUrl(entry: ModelEntry): string {
  if (entry.baseUrlEnv) {
    const fromEnv = process.env[entry.baseUrlEnv]?.trim()
    if (fromEnv) return fromEnv.replace(/\/$/, '')
  }
  return entry.defaultBaseUrl.replace(/\/$/, '')
}

/** Blended cost score — lower is cheaper. per_mtok uses input + 4×output. */
export function blendedPriceScore(pricing: ModelPricing): number {
  if (pricing.unit === 'per_mtok') {
    const input = pricing.inputUsd ?? 0
    const output = pricing.outputUsd ?? 0
    return input + 4 * output
  }
  return pricing.flatUsd ?? Number.POSITIVE_INFINITY
}

function entryHasMethod(entry: ModelEntry, methodName: string) {
  return entry.methods.some((m) => m.name === methodName)
}

function entryMatchesRoute(entry: ModelEntry, route: { requiredMethod: string; acceptedMethods?: string[] }) {
  const methods = route.acceptedMethods?.length
    ? route.acceptedMethods
    : [route.requiredMethod]
  return methods.some((m) => entryHasMethod(entry, m))
}

function pickMethod(
  entry: ModelEntry,
  route: { requiredMethod: string; acceptedMethods?: string[] },
): string {
  if (entryHasMethod(entry, route.requiredMethod)) return route.requiredMethod
  for (const m of route.acceptedMethods || []) {
    if (entryHasMethod(entry, m)) return m
  }
  return entry.methods[0]?.name || route.requiredMethod
}

function entryHasCapabilities(
  entry: ModelEntry,
  required?: Array<keyof ModelEntry['capabilities']>,
): boolean {
  if (!required?.length) return true
  return required.every((cap) => Boolean(entry.capabilities[cap]))
}

function effectivePreferred(
  taskClass: TaskClass,
  seen = new Set<TaskClass>(),
): Array<{ provider: ProviderId; modelId: string }> {
  if (seen.has(taskClass)) return []
  seen.add(taskClass)
  const route = TASK_CLASS_ROUTES[taskClass]
  if (!route) return []
  if (route.preferred.length > 0) return route.preferred
  if (route.fallbackClass) return effectivePreferred(route.fallbackClass, seen)
  return []
}

function parseEnvOverride(taskClass: TaskClass): { provider: ProviderId; modelId: string } | null {
  const raw = process.env[`MODEL_ROUTER_${taskClass.toUpperCase()}`]?.trim()
  if (!raw) return null
  const colon = raw.indexOf(':')
  if (colon <= 0) return null
  const provider = raw.slice(0, colon).trim() as ProviderId
  const modelId = raw.slice(colon + 1).trim()
  if (!provider || !modelId) return null
  return { provider, modelId }
}

function toResolved(
  entry: ModelEntry,
  methodName: string,
  key: { keyEnv: string; apiKey: string },
): ResolvedModel {
  const method = entry.methods.find((m) => m.name === methodName) || entry.methods[0]
  return {
    provider: entry.provider,
    modelId: entry.modelId,
    method: method.name,
    endpoint: {
      http: method.http,
      path: method.path,
      baseUrl: resolveBaseUrl(entry),
    },
    pricing: entry.pricing,
    keyEnv: key.keyEnv,
    apiKey: key.apiKey,
    entry,
  }
}

function isAvailable(
  entry: ModelEntry,
  availableKeys?: Record<string, string | undefined>,
): boolean {
  if (entry.status === 'deprecated') return false
  return resolveKey(entry, availableKeys) != null
}

/**
 * Sync resolve — env keys only (or opts.availableKeys).
 * Selection catalog: does not perform HTTP/SDK calls.
 */
export function resolveModel(taskClass: TaskClass, opts?: ResolveModelOptions): ResolvedModel {
  const route = TASK_CLASS_ROUTES[taskClass]
  if (!route) {
    throw new ModelRouterError(`Unknown task class: ${taskClass}`, taskClass)
  }

  const preferred = opts?.preferred?.length ? opts.preferred : effectivePreferred(taskClass)
  const candidates = MODEL_CATALOG.filter(
    (e) =>
      entryMatchesRoute(e, route) &&
      entryHasCapabilities(e, route.requiredCapabilities) &&
      isAvailable(e, opts?.availableKeys),
  )

  const triedKeyEnvs = [
    ...new Set(
      MODEL_CATALOG.filter((e) => entryMatchesRoute(e, route)).flatMap((e) => e.keyEnv),
    ),
  ]

  if (!opts?.ignoreEnvOverride) {
    const override = parseEnvOverride(taskClass)
    if (override) {
      const entry = findCatalogEntry(override.provider, override.modelId)
      if (entry && entryMatchesRoute(entry, route) && isAvailable(entry, opts?.availableKeys)) {
        const key = resolveKey(entry, opts?.availableKeys)!
        return toResolved(entry, pickMethod(entry, route), key)
      }
    }
  }

  for (const pref of preferred) {
    const entry = candidates.find((c) => c.provider === pref.provider && c.modelId === pref.modelId)
    if (entry) {
      const key = resolveKey(entry, opts?.availableKeys)!
      return toResolved(entry, pickMethod(entry, route), key)
    }
  }

  const byPrice = [...candidates].sort(
    (a, b) => blendedPriceScore(a.pricing) - blendedPriceScore(b.pricing),
  )
  const best = byPrice[0]
  if (!best) {
    throw new ModelRouterError(
      `No available model for task class "${taskClass}". Tried key env: ${triedKeyEnvs.join(', ') || '(none)'}`,
      taskClass,
      triedKeyEnvs,
    )
  }
  const key = resolveKey(best, opts?.availableKeys)!
  return toResolved(best, pickMethod(best, route), key)
}

/** List available candidates for a task class (preferred order, then price). */
export function listCandidates(taskClass: TaskClass, opts?: ResolveModelOptions): ResolvedModel[] {
  const route = TASK_CLASS_ROUTES[taskClass]
  if (!route) return []
  const preferred = opts?.preferred?.length ? opts.preferred : effectivePreferred(taskClass)
  const candidates = MODEL_CATALOG.filter(
    (e) =>
      entryMatchesRoute(e, route) &&
      entryHasCapabilities(e, route.requiredCapabilities) &&
      isAvailable(e, opts?.availableKeys),
  )

  const ordered: ModelEntry[] = []
  const seen = new Set<string>()
  for (const pref of preferred) {
    const entry = candidates.find((c) => c.provider === pref.provider && c.modelId === pref.modelId)
    if (entry) {
      const id = `${entry.provider}:${entry.modelId}`
      if (!seen.has(id)) {
        seen.add(id)
        ordered.push(entry)
      }
    }
  }
  const rest = candidates
    .filter((c) => !seen.has(`${c.provider}:${c.modelId}`))
    .sort((a, b) => blendedPriceScore(a.pricing) - blendedPriceScore(b.pricing))
  ordered.push(...rest)

  return ordered.map((entry) => {
    const key = resolveKey(entry, opts?.availableKeys)!
    return toResolved(entry, pickMethod(entry, route), key)
  })
}

/**
 * Async resolve merging platform-settings DB secrets (openai/anthropic/openrouter/xai)
 * with env fallback. Use for LLMClient / chat paths.
 */
export async function resolveModelWithSettings(
  taskClass: TaskClass,
  opts?: ResolveModelOptions,
): Promise<ResolvedModel> {
  let availableKeys = opts?.availableKeys
  if (!availableKeys) {
    try {
      const { getResolvedAIConfig } = await import(
        '@/features/admin/platform-settings/resolved-ai-config'
      )
      const config = await getResolvedAIConfig()
      availableKeys = {
        OPENAI_API_KEY: config.apiKeys.openai,
        ANTHROPIC_API_KEY: config.apiKeys.anthropic,
        OPENROUTER_API_KEY: config.apiKeys.openrouter,
        XAI_API_KEY: config.apiKeys.xai,
        XAI_TEXT_API_KEY: process.env.XAI_TEXT_API_KEY,
        XAI_IMAGE_API_KEY: process.env.XAI_IMAGE_API_KEY,
        XAI_VIDEO_API_KEY: process.env.XAI_VIDEO_API_KEY,
        GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
        SUNO_API_KEY: process.env.SUNO_API_KEY,
      }
    } catch {
      availableKeys = undefined
    }
  }
  return resolveModel(taskClass, { ...opts, availableKeys })
}

/** Resolve API key for a known catalog model (conductor configs). */
export function resolveKeyForModel(
  provider: ProviderId,
  modelId: string,
  availableKeys?: Record<string, string | undefined>,
): { keyEnv: string; apiKey: string; baseUrl: string; entry: ModelEntry } {
  const entry = findCatalogEntry(provider, modelId)
  if (!entry) {
    throw new ModelRouterError(`Unknown model ${provider}:${modelId}`, 'platform_llm_probe', [])
  }
  const key = resolveKey(entry, availableKeys)
  if (!key) {
    throw new ModelRouterError(
      `No API key for ${provider}:${modelId}. Tried: ${entry.keyEnv.join(', ')}`,
      'platform_llm_probe',
      entry.keyEnv,
    )
  }
  return { ...key, baseUrl: resolveBaseUrl(entry), entry }
}
