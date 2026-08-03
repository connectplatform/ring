/**
 * Forgejo admin API client — BasicAuth only.
 * Used to provision per-order robot users + mint write:repository PATs for Order Source Editor.
 *
 * Token mint requires BasicAuth (not PAT): POST /users/{username}/tokens?sudo={username}
 * See devops-k8s-forgejo-guru.nodus.json → api_authentication.token_mint
 */
import 'server-only'

import { randomBytes } from 'crypto'

import { logger } from '@/lib/logger'

export class ForgejoAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'ForgejoAdminError'
  }
}

export type MintedForgejoToken = {
  id: number
  sha1: string
  tokenLastEight: string
  name: string
  scopes: string[]
}

function apiBase(): string {
  const raw = (process.env.RING_FORGEJO_API_URL || 'https://forge.ringdom.org').replace(/\/$/, '')
  return `${raw}/api/v1`
}

function adminCreds(): { user: string; pass: string } {
  const user = process.env.RING_FORGEJO_ADMIN_USER?.trim()
  const pass = process.env.RING_FORGEJO_ADMIN_PASSWORD
  if (!user || !pass) {
    throw new ForgejoAdminError(
      'RING_FORGEJO_ADMIN_USER/PASSWORD not configured (required for per-order PAT mint)',
      503,
    )
  }
  return { user, pass }
}

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { user, pass } = adminCreds()
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', basicAuthHeader(user, pass))
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
    logger.error('Forgejo admin API request failed', {
      path,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new ForgejoAdminError(
      err instanceof Error ? err.message : 'Forgejo admin request failed',
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function readError(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return ''
  }
}

/** True when admin mint credentials are present (env). */
export function isForgejoAdminConfigured(): boolean {
  return Boolean(
    process.env.RING_FORGEJO_ADMIN_USER?.trim() && process.env.RING_FORGEJO_ADMIN_PASSWORD,
  )
}

/**
 * Ensure a private robot user exists. 409/422 (already exists) → success.
 * Password is random and discarded — subsequent mint uses admin BasicAuth + sudo.
 */
export async function ensureRobotUser(username: string): Promise<{ username: string; created: boolean }> {
  const safe = username.trim()
  if (!safe || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,38}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(safe)) {
    throw new ForgejoAdminError(`Invalid robot username: ${username}`, 400)
  }
  const password = randomBytes(24).toString('hex')
  const res = await adminFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      username: safe,
      login_name: safe,
      email: `${safe}@ringdom.org`,
      password,
      must_change_password: false,
      visibility: 'private',
    }),
  })
  if (res.status === 201 || res.status === 200) {
    return { username: safe, created: true }
  }
  if (res.status === 409 || res.status === 422) {
    return { username: safe, created: false }
  }
  throw new ForgejoAdminError(
    `ensureRobotUser failed: ${res.status}`,
    res.status,
    await readError(res),
  )
}

export async function addRepoCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: 'read' | 'write' | 'admin' = 'write',
): Promise<void> {
  const res = await adminFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ permission }),
    },
  )
  // 204 success; 422 already collaborator is fine
  if (res.status === 204 || res.status === 200 || res.status === 422) return
  throw new ForgejoAdminError(
    `addRepoCollaborator failed: ${res.status}`,
    res.status,
    await readError(res),
  )
}

export async function mintUserToken(
  username: string,
  tokenName: string,
  scopes: string[] = ['write:repository'],
  opts?: { repositories?: Array<{ owner: string; name: string }> },
): Promise<MintedForgejoToken> {
  if (!scopes.length) {
    throw new ForgejoAdminError('Token scopes must be non-empty', 400)
  }
  const body: Record<string, unknown> = { name: tokenName, scopes }
  // Repo-restricted PAT (Forgejo 16+): omit field for all-access; never send []
  if (opts?.repositories?.length) {
    body.repositories = opts.repositories.map((r) => ({
      owner: r.owner,
      name: r.name,
    }))
  }
  const qs = new URLSearchParams({ sudo: username })
  const res = await adminFetch(
    `/users/${encodeURIComponent(username)}/tokens?${qs.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    throw new ForgejoAdminError(
      `mintUserToken failed: ${res.status}`,
      res.status,
      await readError(res),
    )
  }
  const data = (await res.json()) as {
    id?: number
    sha1?: string
    name?: string
    scopes?: string[]
    token_last_eight?: string
  }
  const sha1 = String(data.sha1 || '')
  if (!sha1) {
    throw new ForgejoAdminError('mintUserToken response missing sha1', 502)
  }
  return {
    id: Number(data.id || 0),
    sha1,
    tokenLastEight: String(data.token_last_eight || sha1.slice(-8)),
    name: String(data.name || tokenName),
    scopes: Array.isArray(data.scopes) ? data.scopes.map(String) : scopes,
  }
}

export async function deleteUserToken(username: string, tokenId: number): Promise<void> {
  const qs = new URLSearchParams({ sudo: username })
  const res = await adminFetch(
    `/users/${encodeURIComponent(username)}/tokens/${tokenId}?${qs.toString()}`,
    { method: 'DELETE' },
  )
  if (res.status === 204 || res.status === 404) return
  throw new ForgejoAdminError(
    `deleteUserToken failed: ${res.status}`,
    res.status,
    await readError(res),
  )
}

export type ForgejoAdminUser = {
  id: number
  login: string
  email: string
  created: string
}

/** Paginate GET /admin/users (site admin BasicAuth). */
export async function listUsers(opts?: {
  pageSize?: number
  maxPages?: number
}): Promise<ForgejoAdminUser[]> {
  const pageSize = Math.min(50, Math.max(1, opts?.pageSize ?? 50))
  const maxPages = Math.min(40, Math.max(1, opts?.maxPages ?? 20))
  const out: ForgejoAdminUser[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await adminFetch(`/admin/users?page=${page}&limit=${pageSize}`)
    if (!res.ok) {
      throw new ForgejoAdminError(
        `listUsers failed: ${res.status}`,
        res.status,
        await readError(res),
      )
    }
    const data = (await res.json()) as Array<{
      id?: number
      login?: string
      email?: string
      created?: string
      created_at?: string
    }>
    if (!Array.isArray(data) || data.length === 0) break
    for (const u of data) {
      out.push({
        id: Number(u.id || 0),
        login: String(u.login || ''),
        email: String(u.email || ''),
        created: String(u.created || u.created_at || ''),
      })
    }
    if (data.length < pageSize) break
  }
  return out
}

/** DELETE /admin/users/{username} — deletes access tokens first (repo-restricted PAT FK). 404 tolerated. */
export async function deleteUser(username: string): Promise<void> {
  // Repo-restricted tokens create access_token_resource rows that block user DELETE (FK).
  try {
    const list = await adminFetch(
      `/users/${encodeURIComponent(username)}/tokens?${new URLSearchParams({ sudo: username })}`,
    )
    if (list.ok) {
      const tokens = (await list.json()) as Array<{ id?: number }>
      if (Array.isArray(tokens)) {
        for (const t of tokens) {
          if (t.id) {
            try {
              await deleteUserToken(username, t.id)
            } catch {
              // continue
            }
          }
        }
      }
    }
  } catch {
    // proceed to user delete
  }

  const res = await adminFetch(`/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  })
  if (res.status === 204 || res.status === 200 || res.status === 404) return
  throw new ForgejoAdminError(
    `deleteUser failed: ${res.status}`,
    res.status,
    await readError(res),
  )
}
