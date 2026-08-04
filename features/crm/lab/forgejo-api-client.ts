/**
 * Server-side Forgejo REST client for Order Source Editor.
 * Prefer per-order PAT via opts.token; falls back to RING_FORGEJO_API_TOKEN (org robot).
 * Never expose tokens to the browser.
 *
 * Reachability (mesh-only Ingress — see forge-registry-mesh-only / ring-mesh):
 * - Canonical URL: https://forge.ringdom.org (whitelist 100.64.0.0/10 + k3s pod/svc CIDRs)
 * - Public internet → 403; BuildKit Jobs on k3s-3 work via pod CIDR hairpin
 * - Platform pods on k3s-or need hostAliases forge.ringdom.org→100.64.0.1 (mesh) or in-mesh egress
 * - Local laptop: join ring-mesh (tag:ops). Public DNS→VIP returns 403 (mesh Ingress).
 *   Options: (a) Mac /etc/hosts `100.64.0.1 forge.ringdom.org` (b) curl --resolve …
 *   (c) port-forward svc/forgejo → RING_FORGEJO_API_URL=http://127.0.0.1:3000
 *   Do NOT change ring-ns public A/AAAA to mesh IPs (see RING-NS-EDGE-MAP.md).
 * Auth: Forgejo/Gitea `Authorization: token <pat>` (Contents/Commits API).
 */
import 'server-only'

import { logger } from '@/lib/logger'
import { parseResponseJsonSafe } from '@/features/crm/lab/safe-fetch-json'

export class ForgejoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'ForgejoApiError'
  }
}

export type ForgejoAuthor = {
  name: string
  email: string
}

export type ForgejoFileContent = {
  content: string
  sha: string
  path: string
  encoding: string
}

export type ForgejoTreeEntry = {
  path: string
  mode: string
  type: 'blob' | 'tree' | string
  sha: string
  size?: number
}

export type ForgejoCommitSummary = {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  date: string
  url: string
}

export type ForgejoCommitDetail = ForgejoCommitSummary & {
  files: Array<{
    filename: string
    status: string
    additions?: number
    deletions?: number
    patch?: string
  }>
}

export type ForgejoRequestOpts = {
  /** Override env RING_FORGEJO_API_TOKEN (per-order Source Editor PAT). */
  token?: string
}

function apiBase(): string {
  const raw = (process.env.RING_FORGEJO_API_URL || 'https://forge.ringdom.org').replace(/\/$/, '')
  return `${raw}/api/v1`
}

function resolveToken(opts?: ForgejoRequestOpts): string {
  const token = opts?.token?.trim() || process.env.RING_FORGEJO_API_TOKEN?.trim()
  if (!token) {
    throw new ForgejoApiError('RING_FORGEJO_API_TOKEN is not configured', 503)
  }
  return token
}

async function forgejoFetch(
  path: string,
  init: RequestInit = {},
  opts?: ForgejoRequestOpts,
): Promise<Response> {
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `token ${resolveToken(opts)}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err) {
    logger.error('Forgejo API request failed', {
      path,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new ForgejoApiError(
      err instanceof Error ? err.message : 'Forgejo request failed',
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}


async function readJson<T>(res: Response): Promise<T> {
  const parsed = await parseResponseJsonSafe<T>(res)
  if (parsed.data == null) {
    throw new ForgejoApiError(parsed.error || 'Empty Forgejo JSON', res.status)
  }
  return parsed.data
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    return text.slice(0, 500)
  } catch {
    return ''
  }
}

export async function getTree(
  owner: string,
  repo: string,
  ref = 'main',
  opts?: ForgejoRequestOpts,
): Promise<ForgejoTreeEntry[]> {
  const res = await forgejoFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=true`,
    {},
    opts,
  )
  if (!res.ok) {
    throw new ForgejoApiError(
      `getTree failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = await readJson<{ tree?: ForgejoTreeEntry[] }>(res)
  return Array.isArray(data.tree) ? data.tree : []
}

export async function getFile(
  owner: string,
  repo: string,
  path: string,
  ref = 'main',
  opts?: ForgejoRequestOpts,
): Promise<ForgejoFileContent> {
  const res = await forgejoFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}?ref=${encodeURIComponent(ref)}`,
    {},
    opts,
  )
  if (!res.ok) {
    throw new ForgejoApiError(
      `getFile failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = await readJson<{
    content?: string
    encoding?: string
    sha?: string
    path?: string
    type?: string
  }>(res)
  if (data.type && data.type !== 'file') {
    throw new ForgejoApiError('Path is not a file', 400)
  }
  const encoding = data.encoding || 'base64'
  const raw = data.content || ''
  const content =
    encoding === 'base64'
      ? Buffer.from(raw.replace(/\n/g, ''), 'base64').toString('utf8')
      : raw
  return {
    content,
    sha: String(data.sha || ''),
    path: String(data.path || path),
    encoding,
  }
}

export async function commitFile(
  owner: string,
  repo: string,
  opts: {
    path: string
    content: string
    message: string
    sha?: string
    branch?: string
    author: ForgejoAuthor
    committer?: ForgejoAuthor
  },
  req?: ForgejoRequestOpts,
): Promise<{ commitSha: string; contentSha: string }> {
  const body: Record<string, unknown> = {
    message: opts.message,
    content: Buffer.from(opts.content, 'utf8').toString('base64'),
    branch: opts.branch || 'main',
    author: opts.author,
    committer: opts.committer || opts.author,
  }
  if (opts.sha) body.sha = opts.sha

  // Forgejo 16: create = POST (no sha); update = PUT (requires sha).
  // PUT without sha returns 422 "[SHA]: Required".
  const method = opts.sha ? 'PUT' : 'POST'
  const res = await forgejoFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${opts.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    { method, body: JSON.stringify(body) },
    req,
  )
  if (res.status === 409) {
    throw new ForgejoApiError('File conflict (stale sha)', 409, await readError(res))
  }
  if (!res.ok) {
    throw new ForgejoApiError(
      `commitFile failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = await readJson<{
    content?: { sha?: string }
    commit?: { sha?: string }
  }>(res)
  return {
    commitSha: String(data.commit?.sha || ''),
    contentSha: String(data.content?.sha || ''),
  }
}

export async function listCommits(
  owner: string,
  repo: string,
  limit = 30,
  opts?: ForgejoRequestOpts,
): Promise<ForgejoCommitSummary[]> {
  const res = await forgejoFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?limit=${Math.min(100, Math.max(1, limit))}`,
    {},
    opts,
  )
  if (!res.ok) {
    throw new ForgejoApiError(
      `listCommits failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = await readJson<Array<{
    sha?: string
    commit?: {
      message?: string
      author?: { name?: string; email?: string; date?: string }
    }
    html_url?: string
    url?: string
  }>>(res)
  if (!Array.isArray(data)) return []
  return data.map((c) => ({
    sha: String(c.sha || ''),
    message: String(c.commit?.message || '').trim(),
    authorName: String(c.commit?.author?.name || ''),
    authorEmail: String(c.commit?.author?.email || ''),
    date: String(c.commit?.author?.date || ''),
    url: String(c.html_url || c.url || ''),
  }))
}

export async function getCommit(
  owner: string,
  repo: string,
  sha: string,
  opts?: ForgejoRequestOpts,
): Promise<ForgejoCommitDetail> {
  const res = await forgejoFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(sha)}`,
    {},
    opts,
  )
  if (!res.ok) {
    throw new ForgejoApiError(
      `getCommit failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = await readJson<{
    sha?: string
    commit?: {
      message?: string
      author?: { name?: string; email?: string; date?: string }
    }
    html_url?: string
    url?: string
    files?: Array<{
      filename?: string
      status?: string
      additions?: number
      deletions?: number
      patch?: string
    }>
  }>(res)

  let files = Array.isArray(data.files) ? data.files : []
  if (!files.length) {
    try {
      const cmp = await forgejoFetch(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
        {},
        opts,
      )
      if (cmp.ok) {
        const full = await readJson<{ files?: typeof files }>(cmp)
        if (Array.isArray(full.files)) files = full.files
      }
    } catch {
      // ignore — metadata-only is fine
    }
  }

  return {
    sha: String(data.sha || sha),
    message: String(data.commit?.message || '').trim(),
    authorName: String(data.commit?.author?.name || ''),
    authorEmail: String(data.commit?.author?.email || ''),
    date: String(data.commit?.author?.date || ''),
    url: String(data.html_url || data.url || ''),
    files: files.map((f) => ({
      filename: String(f.filename || ''),
      status: String(f.status || 'modified'),
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
  }
}
