/**
 * Tunnel channel ACL — shared policy for HTTP + native WSS subscribe/publish.
 *
 * Rules (deny-by-default for sensitive families):
 * - game:{sessionId} — auth + peer_game_sessions participant (subscribe + publish)
 * - game:{id}:spectate — deferred (deny); publish always denied on spectate
 * - Server-only inbox (credit/notifications/wallet/account) — client publish forbidden
 * - Owner-suffixed channels (credit:balance:{userId}, …) — subscribe/publish owner only
 * - Private inbox base channels — authenticated subscribe; guests denied
 * - Default topic channels — guests may subscribe; publish requires authenticated user
 */

export type TunnelChannelAction = 'subscribe' | 'publish'

export type TunnelAclActor = {
  userId: string
  /** Auth.js / tunnel JWT for a real member (not anon-*). */
  isAuthenticated: boolean
}

export type TunnelAclDenial = {
  ok: false
  code: 'UNAUTHORIZED' | 'FORBIDDEN'
  message: string
  httpStatus: 401 | 403
}

export type TunnelAclDecision = { ok: true } | TunnelAclDenial

export type TunnelChannelAclDeps = {
  getGameSessionForParticipant?: (
    sessionId: string,
    userId: string,
  ) => Promise<unknown | null>
}

/** Channels clients must never publish — server uses publishToUserTunnel / trusted hub. */
const SERVER_ONLY_PUBLISH_EXACT = new Set([
  'credit:balance',
  'notifications:unread',
  'notifications:inbox',
  'wallet:list',
  'account:status',
  'calls:incoming',
  'games:incoming',
  'conversations:inbox',
  'file-cabinet:desktop-icons',
])

const SERVER_ONLY_PUBLISH_PREFIXES = [
  'credit:balance:',
  'notifications:unread:',
  'notifications:inbox:',
  'wallet:list:',
  'account:status:',
  'calls:incoming:',
  'games:incoming:',
  'conversations:inbox:',
  'file-cabinet:desktop-icons:',
] as const

/** Base channels that require an authenticated member to subscribe. */
const PRIVATE_INBOX_SUBSCRIBE_EXACT = new Set([
  'credit:balance',
  'notifications:unread',
  'notifications:inbox',
  'wallet:list',
  'account:status',
  'calls:incoming',
  'games:incoming',
  'conversations:inbox',
  'file-cabinet:desktop-icons',
])

const OWNER_SUFFIX_PREFIXES = [
  'credit:balance:',
  'notifications:unread:',
  'notifications:inbox:',
  'wallet:list:',
  'account:status:',
  'calls:incoming:',
  'games:incoming:',
  'conversations:inbox:',
  'file-cabinet:desktop-icons:',
] as const

export function isAnonymousTunnelUserId(userId: string): boolean {
  return userId.startsWith('anon-')
}

/**
 * Parse play channel `game:{sessionId}` only.
 * Nested forms (`game:{id}:spectate`) return null — handled separately.
 */
export function parseGamePlaySessionId(channel: string): string | null {
  if (!channel.startsWith('game:')) return null
  const rest = channel.slice('game:'.length).trim()
  if (!rest || rest.includes(':') || rest.includes('/')) return null
  return rest
}

export function isGameSpectateChannel(channel: string): boolean {
  if (!channel.startsWith('game:')) return false
  const rest = channel.slice('game:'.length)
  return rest.includes(':spectate') || rest.endsWith(':spectate')
}

function isServerOnlyClientPublish(channel: string): boolean {
  if (SERVER_ONLY_PUBLISH_EXACT.has(channel)) return true
  return SERVER_ONLY_PUBLISH_PREFIXES.some((p) => channel.startsWith(p))
}

function ownerIdFromSuffixedChannel(channel: string): string | null {
  for (const prefix of OWNER_SUFFIX_PREFIXES) {
    if (!channel.startsWith(prefix)) continue
    const ownerId = channel.slice(prefix.length).trim()
    if (!ownerId || ownerId.includes(':') || ownerId.includes('/')) return null
    return ownerId
  }
  return null
}

function deny(
  code: TunnelAclDenial['code'],
  message: string,
): TunnelAclDenial {
  return {
    ok: false,
    code,
    message,
    httpStatus: code === 'UNAUTHORIZED' ? 401 : 403,
  }
}

async function defaultGameParticipantLookup(
  sessionId: string,
  userId: string,
): Promise<unknown | null> {
  const { getSessionForParticipant } = await import('@/features/peer-games/service')
  return getSessionForParticipant(sessionId, userId)
}

/**
 * Authorize subscribe or client publish for a tunnel channel.
 * Trusted server publishers (`publishToUserTunnel` / hub from Node services) bypass this.
 */
export async function authorizeTunnelChannel(
  action: TunnelChannelAction,
  channel: string,
  actor: TunnelAclActor,
  deps: TunnelChannelAclDeps = {},
): Promise<TunnelAclDecision> {
  if (!channel || typeof channel !== 'string') {
    return deny('FORBIDDEN', 'Channel is required')
  }

  const authenticated =
    actor.isAuthenticated && !isAnonymousTunnelUserId(actor.userId)

  // —— game spectate (deferred) ——
  if (isGameSpectateChannel(channel)) {
    return deny('FORBIDDEN', 'Spectate channels are not enabled')
  }

  // —— game:{sessionId} play ——
  const gameSessionId = parseGamePlaySessionId(channel)
  if (gameSessionId) {
    if (!authenticated) {
      return deny('UNAUTHORIZED', 'Authentication required for game channels')
    }
    const lookup = deps.getGameSessionForParticipant ?? defaultGameParticipantLookup
    const session = await lookup(gameSessionId, actor.userId)
    if (!session) {
      return deny('FORBIDDEN', 'Not a game participant')
    }
    return { ok: true }
  }

  // —— owner-suffixed private channels ——
  const ownerId = ownerIdFromSuffixedChannel(channel)
  if (ownerId) {
    if (!authenticated) {
      return deny('UNAUTHORIZED', 'Authentication required')
    }
    if (actor.userId !== ownerId) {
      return deny('FORBIDDEN', 'Owner-only channel')
    }
    if (action === 'publish' && isServerOnlyClientPublish(channel)) {
      return deny('FORBIDDEN', 'Client publish denied for inbox channel')
    }
    return { ok: true }
  }

  // —— server-only inbox (base names) ——
  if (action === 'publish' && isServerOnlyClientPublish(channel)) {
    return deny('FORBIDDEN', 'Client publish denied for inbox channel')
  }

  if (
    action === 'subscribe' &&
    PRIVATE_INBOX_SUBSCRIBE_EXACT.has(channel) &&
    !authenticated
  ) {
    return deny('UNAUTHORIZED', 'Authentication required for inbox channels')
  }

  // —— default ——
  if (action === 'publish' && !authenticated) {
    return deny('UNAUTHORIZED', 'Authentication required to publish')
  }

  return { ok: true }
}
