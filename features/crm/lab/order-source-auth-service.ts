/**
 * Per-order Forgejo PAT provisioning for Order Source Editor.
 * Isolation: dedicated robot user collaborator on one clone repo + write:repository PAT.
 * Ciphertext stored on project_deployments.sourceAuth via encryptLabSecret (wallet AES-GCM v2).
 */
import 'server-only'

import {
  addRepoCollaborator,
  ensureRobotUser,
  isForgejoAdminConfigured,
  mintUserToken,
  deleteUserToken,
  ForgejoAdminError,
} from '@/features/crm/lab/forgejo-admin-client'
import { ProjectDeploymentService, type SourceAuth } from '@/features/crm/lab/deployment-service'
import { decryptLabSecret, encryptLabSecret } from '@/features/crm/lab/lab-secret-crypto'
import { parseForgejoGitUrl } from '@/features/crm/lab/order-source-paths'
import { releaseNx, setNxPx } from '@/lib/redis/set-nx'
import { logger } from '@/lib/logger'

const CACHE_TTL_MS = 5 * 60 * 1000
const MINT_LOCK_TTL_MS = 30_000
const SOURCE_SCOPE = 'write:repository' as const

function mintLockKey(orderId: string): string {
  return `order-source:mint:${orderId}`
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

/** When another pod holds the mint lock, wait briefly for its sourceAuth write. */
async function awaitPeerMint(orderId: string): Promise<string | null> {
  for (let i = 0; i < 2; i++) {
    await sleep(1500)
    const dep = await ProjectDeploymentService.getByOrderId(orderId)
    const enc = dep?.sourceAuth?.tokenEncrypted
    if (!enc) continue
    try {
      const token = decryptLabSecret(enc)
      cacheSet(orderId, token)
      return token
    } catch {
      // keep polling
    }
  }
  return null
}

type CacheEntry = { token: string; expiresAt: number }

const tokenCache = new Map<string, CacheEntry>()

/** Sanitize repo slug → Forgejo-safe robot username (max 40). */
export function robotUsernameForSlug(slug: string): string {
  const base = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const prefix = 'order-src-'
  const maxSlug = 40 - prefix.length
  let body = (base || 'x').slice(0, maxSlug)
  if (!/^[a-z0-9]/.test(body)) body = `x${body}`.slice(0, maxSlug)
  if (!/[a-z0-9]$/.test(body)) body = `${body}x`.slice(0, maxSlug)
  return `${prefix}${body}`
}

export function invalidateOrderSourceTokenCache(orderId: string): void {
  tokenCache.delete(orderId)
}

function cacheGet(orderId: string): string | null {
  const hit = tokenCache.get(orderId)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    tokenCache.delete(orderId)
    return null
  }
  return hit.token
}

function cacheSet(orderId: string, token: string): void {
  tokenCache.set(orderId, { token, expiresAt: Date.now() + CACHE_TTL_MS })
}

function envFallbackToken(): string | null {
  const t = process.env.RING_FORGEJO_API_TOKEN?.trim()
  return t || null
}

async function mintAndPersistUnlocked(orderId: string): Promise<string> {
  const dep = await ProjectDeploymentService.getByOrderId(orderId)
  if (!dep?.gitUrl) {
    throw new ForgejoAdminError('Clone not scaffolded — cannot mint source PAT', 404)
  }
  const parsed = parseForgejoGitUrl(dep.gitUrl)
  if (!parsed) {
    throw new ForgejoAdminError('Invalid gitUrl on deployment', 400)
  }

  const robotUsername = robotUsernameForSlug(parsed.repo)
  await ensureRobotUser(robotUsername)
  await addRepoCollaborator(parsed.owner, parsed.repo, robotUsername, 'write')

  // Forgejo rejects duplicate token names (400). Remint must delete the prior id
  // and use a unique name — fixed "order-source-{orderId}" collided on 401 recovery.
  const prior = dep.sourceAuth
  if (prior?.tokenId && prior.robotUsername) {
    try {
      await deleteUserToken(prior.robotUsername, prior.tokenId)
    } catch (err) {
      logger.warn('Prior source PAT delete failed before remint (continuing)', {
        orderId,
        tokenId: prior.tokenId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const tokenName =
    `os-${orderId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}-${Date.now().toString(36)}`.slice(
      0,
      80,
    )
  const minted = await mintUserToken(robotUsername, tokenName, [SOURCE_SCOPE], {
    repositories: [{ owner: parsed.owner, name: parsed.repo }],
  })

  const now = new Date().toISOString()
  const sourceAuth: SourceAuth = {
    robotUsername,
    tokenId: minted.id,
    tokenLastEight: minted.tokenLastEight,
    tokenEncrypted: encryptLabSecret(minted.sha1),
    scope: SOURCE_SCOPE,
    mintedAt: prior?.mintedAt || now,
    ...(prior?.mintedAt ? { rotatedAt: now } : {}),
  }

  await ProjectDeploymentService.patch(orderId, { sourceAuth })
  cacheSet(orderId, minted.sha1)

  logger.info('Order source PAT minted', {
    orderId,
    robotUsername,
    tokenId: minted.id,
    tokenLastEight: minted.tokenLastEight,
    owner: parsed.owner,
    repo: parsed.repo,
  })

  return minted.sha1
}

/**
 * Multi-replica safe mint: Redis SET-NX lock (Map fallback) so only one pod mints;
 * losers short-poll for the winner's encrypted sourceAuth.
 */
async function mintAndPersist(
  orderId: string,
  opts?: { force?: boolean },
): Promise<string> {
  const lockKey = mintLockKey(orderId)
  const { claimed, backend } = await setNxPx(lockKey, MINT_LOCK_TTL_MS)
  if (!claimed) {
    logger.info('Order source mint lock held by peer — awaiting sourceAuth', {
      orderId,
      backend,
    })
    // On force remint we cannot reuse peer's still-old ciphertext — wait for lock expiry path
    if (!opts?.force) {
      const peer = await awaitPeerMint(orderId)
      if (peer) return peer
    } else {
      await sleep(1500)
      await sleep(1500)
    }
    const retry = await setNxPx(lockKey, MINT_LOCK_TTL_MS)
    if (!retry.claimed) {
      if (!opts?.force) {
        const again = await awaitPeerMint(orderId)
        if (again) return again
      }
      throw new ForgejoAdminError('Could not acquire mint lock or read peer token', 503)
    }
    try {
      return await mintAndPersistUnlocked(orderId)
    } finally {
      await releaseNx(lockKey)
    }
  }

  try {
    // Re-check after claiming — another pod may have finished just before lock
    // Skip on force remint (old ciphertext may still decrypt but token is invalid).
    if (!opts?.force) {
      const dep = await ProjectDeploymentService.getByOrderId(orderId)
      if (dep?.sourceAuth?.tokenEncrypted) {
        try {
          const token = decryptLabSecret(dep.sourceAuth.tokenEncrypted)
          cacheSet(orderId, token)
          return token
        } catch {
          // remint
        }
      }
    }
    return await mintAndPersistUnlocked(orderId)
  } finally {
    await releaseNx(lockKey)
  }
}

/**
 * Resolve plaintext Forgejo PAT for Order Source Editor (server-only).
 * Prefer per-order encrypted token; mint lazily when admin creds present;
 * fall back to RING_FORGEJO_API_TOKEN (org robot).
 */
export async function getOrderSourceToken(
  orderId: string,
  opts?: { forceRemint?: boolean },
): Promise<{ token: string; source: 'per-order' | 'env-fallback' }> {
  if (!opts?.forceRemint) {
    const cached = cacheGet(orderId)
    if (cached) return { token: cached, source: 'per-order' }
  } else {
    invalidateOrderSourceTokenCache(orderId)
  }

  const dep = await ProjectDeploymentService.getByOrderId(orderId)
  const existing = dep?.sourceAuth

  if (existing?.tokenEncrypted && !opts?.forceRemint) {
    try {
      const token = decryptLabSecret(existing.tokenEncrypted)
      cacheSet(orderId, token)
      return { token, source: 'per-order' }
    } catch (err) {
      logger.warn('Order sourceAuth decrypt failed — will remint if possible', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (isForgejoAdminConfigured()) {
    try {
      const token = await mintAndPersist(orderId, { force: Boolean(opts?.forceRemint) })
      return { token, source: 'per-order' }
    } catch (err) {
      logger.warn('Per-order Forgejo PAT mint failed — falling back to env token', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
        status: err instanceof ForgejoAdminError ? err.status : undefined,
      })
    }
  }

  const fallback = envFallbackToken()
  if (!fallback) {
    throw new ForgejoAdminError(
      'No Forgejo source token available (admin mint failed and RING_FORGEJO_API_TOKEN unset)',
      503,
    )
  }
  logger.warn('Using RING_FORGEJO_API_TOKEN fallback for Order Source Editor', { orderId })
  return { token: fallback, source: 'env-fallback' }
}

/**
 * Revoke per-order Forgejo PAT (delete token + clear ciphertext).
 * Called from cancelAndRefundProjectOrder. Robot user deletion is deferred to cron GC.
 */
export async function revokeOrderSourceToken(orderId: string): Promise<void> {
  invalidateOrderSourceTokenCache(orderId)
  const dep = await ProjectDeploymentService.getByOrderId(orderId)
  const auth = dep?.sourceAuth
  if (!auth) return
  if (isForgejoAdminConfigured() && auth.tokenId && auth.robotUsername) {
    try {
      await deleteUserToken(auth.robotUsername, auth.tokenId)
    } catch (err) {
      logger.warn('revokeOrderSourceToken: Forgejo delete failed (continuing)', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  await ProjectDeploymentService.patch(orderId, {
    sourceAuth: {
      ...auth,
      tokenEncrypted: '',
      revokedAt: new Date().toISOString(),
    },
  })
}

/**
 * Rotate per-order PAT (delete old id + remint). Used by 401 recovery and
 * ProcessConductor pipeline forgejo-token-rotate (monthly cron).
 */
export async function rotateOrderSourceToken(orderId: string): Promise<string> {
  invalidateOrderSourceTokenCache(orderId)
  const dep = await ProjectDeploymentService.getByOrderId(orderId)
  const auth = dep?.sourceAuth
  if (isForgejoAdminConfigured() && auth?.tokenId && auth.robotUsername) {
    try {
      await deleteUserToken(auth.robotUsername, auth.tokenId)
    } catch {
      // ignore — remint anyway
    }
  }
  const { token } = await getOrderSourceToken(orderId, { forceRemint: true })
  return token
}

/** Test helper — clear in-memory cache between tests. */
export function __clearOrderSourceTokenCacheForTests(): void {
  tokenCache.clear()
}
