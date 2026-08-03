/**
 * Order Source Service — thin-overlay file browse/edit/commit against the order's Forgejo repo.
 */
import 'server-only'

import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import {
  getOrderSourceToken,
  invalidateOrderSourceTokenCache,
} from '@/features/crm/lab/order-source-auth-service'
import {
  ForgejoApiError,
  commitFile as forgejoCommitFile,
  getCommit as forgejoGetCommit,
  getFile as forgejoGetFile,
  getTree as forgejoGetTree,
  listCommits as forgejoListCommits,
  type ForgejoAuthor,
  type ForgejoCommitDetail,
  type ForgejoCommitSummary,
  type ForgejoRequestOpts,
} from '@/features/crm/lab/forgejo-api-client'
import type { LabAccessRole } from '@/features/crm/lab/lab-auth'
import {
  isOverlayDirRelevant,
  isOverlayPathAllowed,
  parseForgejoGitUrl,
  type ParsedRepo,
} from '@/features/crm/lab/order-source-paths'
import { logger } from '@/lib/logger'

export {
  isOverlayPathAllowed,
  parseForgejoGitUrl,
} from '@/features/crm/lab/order-source-paths'

export class SourceNotScaffolded extends Error {
  readonly code = 'SOURCE_NOT_SCAFFOLDED' as const
  constructor(message = 'Clone has not been scaffolded yet') {
    super(message)
    this.name = 'SourceNotScaffolded'
  }
}

export class SourceConflict extends Error {
  readonly code = 'SOURCE_CONFLICT' as const
  constructor(message = 'File was changed; reload and retry') {
    super(message)
    this.name = 'SourceConflict'
  }
}

export class SourcePathDenied extends Error {
  readonly code = 'SOURCE_PATH_DENIED' as const
  constructor(message = 'Path is outside the overlay allowlist') {
    super(message)
    this.name = 'SourcePathDenied'
  }
}

export type SourceTreeEntry = {
  path: string
  type: 'file' | 'dir'
  size?: number
}

export type SourceActor = {
  role: LabAccessRole
  name?: string | null
  email?: string | null
}

function assertOverlayPath(path: string): string {
  const normalized = path.replace(/^\.\//, '').replace(/\/+$/, '')
  if (!isOverlayPathAllowed(normalized)) {
    throw new SourcePathDenied(`Path not allowed: ${path}`)
  }
  return normalized
}

async function resolveRepo(orderId: string): Promise<ParsedRepo> {
  const dep = await ProjectDeploymentService.getByOrderId(orderId)
  if (!dep?.gitUrl) throw new SourceNotScaffolded()
  const parsed = parseForgejoGitUrl(dep.gitUrl)
  if (!parsed) throw new SourceNotScaffolded('Invalid gitUrl on deployment')
  return parsed
}

async function resolveAuth(
  orderId: string,
  forceRemint = false,
): Promise<ForgejoRequestOpts & { source: 'per-order' | 'env-fallback' }> {
  const { token, source } = await getOrderSourceToken(orderId, { forceRemint })
  return { token, source }
}

function toAuthor(actor: SourceActor): ForgejoAuthor {
  const name = actor.name?.trim() || `Ring Order Lab (${actor.role})`
  const email = actor.email?.trim() || 'order-lab@ringdom.org'
  return { name, email }
}

function mapForgejoError(err: unknown, opts?: { notFoundMeansUnscaffolded?: boolean }): never {
  if (
    err instanceof SourceNotScaffolded ||
    err instanceof SourceConflict ||
    err instanceof SourcePathDenied
  ) {
    throw err
  }
  if (err instanceof ForgejoApiError) {
    if (err.status === 409) throw new SourceConflict(err.message)
    if (err.status === 403) {
      throw new ForgejoApiError(
        'Forgejo denied access (mesh-only Ingress — join ring-mesh, use hostAliases→100.64.0.1, or port-forward svc/forgejo)',
        403,
        err.body,
      )
    }
    if (err.status === 404 && opts?.notFoundMeansUnscaffolded) {
      throw new SourceNotScaffolded('Repository not found on Forgejo — scaffold the clone first')
    }
    throw err
  }
  throw err
}

/**
 * Run a Forgejo call with per-order token; on 401 remint once then env fallback.
 */
async function withSourceToken<T>(
  orderId: string,
  fn: (req: ForgejoRequestOpts) => Promise<T>,
): Promise<T> {
  let auth = await resolveAuth(orderId, false)
  try {
    return await fn({ token: auth.token })
  } catch (err) {
    if (!(err instanceof ForgejoApiError) || err.status !== 401) throw err
    if (auth.source !== 'per-order') throw err

    logger.warn('Order source Forgejo 401 — reminting per-order PAT once', { orderId })
    invalidateOrderSourceTokenCache(orderId)
    try {
      auth = await resolveAuth(orderId, true)
      return await fn({ token: auth.token })
    } catch (remintErr) {
      if (remintErr instanceof ForgejoApiError && remintErr.status === 401) {
        // Final fallback: org robot env token
        const envToken = process.env.RING_FORGEJO_API_TOKEN?.trim()
        if (envToken && envToken !== auth.token) {
          logger.warn('Order source remint still 401 — using env org robot token', { orderId })
          return await fn({ token: envToken })
        }
      }
      throw remintErr
    }
  }
}

export const OrderSourceService = {
  async listTree(orderId: string): Promise<SourceTreeEntry[]> {
    try {
      const { owner, repo } = await resolveRepo(orderId)
      const tree = await withSourceToken(orderId, (req) =>
        forgejoGetTree(owner, repo, 'main', req),
      )
      const entries: SourceTreeEntry[] = []
      for (const node of tree) {
        if (!node.path) continue
        if (node.type === 'tree') {
          if (isOverlayDirRelevant(node.path)) {
            entries.push({ path: node.path, type: 'dir' })
          }
          continue
        }
        if (node.type === 'blob' && isOverlayPathAllowed(node.path)) {
          entries.push({
            path: node.path,
            type: 'file',
            size: typeof node.size === 'number' ? node.size : undefined,
          })
        }
      }
      entries.sort((a, b) => a.path.localeCompare(b.path))
      return entries
    } catch (err) {
      mapForgejoError(err, { notFoundMeansUnscaffolded: true })
    }
  },

  async readFile(
    orderId: string,
    path: string,
  ): Promise<{ path: string; content: string; sha: string }> {
    try {
      const safe = assertOverlayPath(path)
      const { owner, repo } = await resolveRepo(orderId)
      const file = await withSourceToken(orderId, (req) =>
        forgejoGetFile(owner, repo, safe, 'main', req),
      )
      return { path: file.path, content: file.content, sha: file.sha }
    } catch (err) {
      if (err instanceof ForgejoApiError && err.status === 404) {
        const body = (err.body || '').toLowerCase()
        if (body.includes('repository') || body.includes('not found')) {
          mapForgejoError(err, { notFoundMeansUnscaffolded: true })
        }
      }
      mapForgejoError(err)
    }
  },

  async commitFile(
    orderId: string,
    opts: { path: string; content: string; message: string; sha?: string },
    actor: SourceActor,
  ): Promise<{ commitSha: string; contentSha: string; path: string }> {
    try {
      const safe = assertOverlayPath(opts.path)
      const message = opts.message.trim()
      if (!message) throw new Error('Commit message is required')
      const { owner, repo } = await resolveRepo(orderId)
      const author = toAuthor(actor)

      return await withSourceToken(orderId, async (req) => {
        let sha = opts.sha
        if (!sha) {
          try {
            const existing = await forgejoGetFile(owner, repo, safe, 'main', req)
            sha = existing.sha
          } catch (err) {
            if (!(err instanceof ForgejoApiError) || err.status !== 404) throw err
          }
        }

        const result = await forgejoCommitFile(
          owner,
          repo,
          {
            path: safe,
            content: opts.content,
            message,
            sha,
            author,
          },
          req,
        )
        return { ...result, path: safe }
      })
    } catch (err) {
      mapForgejoError(err, { notFoundMeansUnscaffolded: true })
    }
  },

  async listCommits(orderId: string, limit = 30): Promise<ForgejoCommitSummary[]> {
    try {
      const { owner, repo } = await resolveRepo(orderId)
      return await withSourceToken(orderId, (req) =>
        forgejoListCommits(owner, repo, limit, req),
      )
    } catch (err) {
      mapForgejoError(err, { notFoundMeansUnscaffolded: true })
    }
  },

  async getCommit(orderId: string, sha: string): Promise<ForgejoCommitDetail> {
    try {
      if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
        throw new Error('Invalid commit sha')
      }
      const { owner, repo } = await resolveRepo(orderId)
      return await withSourceToken(orderId, (req) =>
        forgejoGetCommit(owner, repo, sha, req),
      )
    } catch (err) {
      mapForgejoError(err)
    }
  },
}
