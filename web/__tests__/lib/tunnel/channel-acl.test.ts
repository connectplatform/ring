import {
  authorizeTunnelChannel,
  isAnonymousTunnelUserId,
  isGameSpectateChannel,
  parseGamePlaySessionId,
  type TunnelAclActor,
} from '@/lib/tunnel/channel-acl'

describe('parseGamePlaySessionId', () => {
  it('accepts game:{uuid}', () => {
    expect(parseGamePlaySessionId('game:abc-123')).toBe('abc-123')
  })

  it('rejects spectate / nested / empty', () => {
    expect(parseGamePlaySessionId('game:abc:spectate')).toBeNull()
    expect(parseGamePlaySessionId('game:')).toBeNull()
    expect(parseGamePlaySessionId('credit:balance')).toBeNull()
  })
})

describe('isGameSpectateChannel', () => {
  it('detects spectate suffix', () => {
    expect(isGameSpectateChannel('game:abc:spectate')).toBe(true)
    expect(isGameSpectateChannel('game:abc')).toBe(false)
  })
})

describe('authorizeTunnelChannel', () => {
  const player: TunnelAclActor = { userId: 'user-a', isAuthenticated: true }
  const stranger: TunnelAclActor = { userId: 'user-b', isAuthenticated: true }
  const guest: TunnelAclActor = { userId: 'anon-xyz', isAuthenticated: false }

  const participantDeps = {
    getGameSessionForParticipant: async (sessionId: string, userId: string) =>
      sessionId === 'sess-1' && userId === 'user-a' ? { id: sessionId } : null,
  }

  it('allows game participant subscribe + publish', async () => {
    await expect(
      authorizeTunnelChannel('subscribe', 'game:sess-1', player, participantDeps),
    ).resolves.toEqual({ ok: true })
    await expect(
      authorizeTunnelChannel('publish', 'game:sess-1', player, participantDeps),
    ).resolves.toEqual({ ok: true })
  })

  it('denies game UUID guessing and guests', async () => {
    const forbidden = await authorizeTunnelChannel(
      'subscribe',
      'game:sess-1',
      stranger,
      participantDeps,
    )
    expect(forbidden.ok).toBe(false)
    if (!forbidden.ok) expect(forbidden.httpStatus).toBe(403)

    const unauth = await authorizeTunnelChannel(
      'publish',
      'game:sess-1',
      guest,
      participantDeps,
    )
    expect(unauth.ok).toBe(false)
    if (!unauth.ok) expect(unauth.httpStatus).toBe(401)
  })

  it('denies spectate channels', async () => {
    const d = await authorizeTunnelChannel(
      'subscribe',
      'game:sess-1:spectate',
      player,
      participantDeps,
    )
    expect(d.ok).toBe(false)
  })

  it('denies client publish on inbox channels', async () => {
    for (const ch of [
      'credit:balance',
      'notifications:unread',
      'notifications:inbox',
      'wallet:list',
      'account:status',
      'calls:incoming',
      'games:incoming',
      'conversations:inbox',
      'file-cabinet:desktop-icons',
    ]) {
      const d = await authorizeTunnelChannel('publish', ch, player)
      expect(d.ok).toBe(false)
      if (!d.ok) expect(d.message).toMatch(/Client publish denied/)
    }
  })

  it('requires auth to subscribe to private inbox base channels', async () => {
    const d = await authorizeTunnelChannel('subscribe', 'credit:balance', guest)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.httpStatus).toBe(401)

    await expect(
      authorizeTunnelChannel('subscribe', 'credit:balance', player),
    ).resolves.toEqual({ ok: true })
  })

  it('enforces owner-only suffixed channels', async () => {
    const ok = await authorizeTunnelChannel(
      'subscribe',
      'credit:balance:user-a',
      player,
    )
    expect(ok).toEqual({ ok: true })

    const denied = await authorizeTunnelChannel(
      'subscribe',
      'credit:balance:user-a',
      stranger,
    )
    expect(denied.ok).toBe(false)

    const pub = await authorizeTunnelChannel(
      'publish',
      'credit:balance:user-a',
      player,
    )
    expect(pub.ok).toBe(false)
  })

  it('allows guest subscribe on public topics; denies guest publish', async () => {
    await expect(
      authorizeTunnelChannel('subscribe', 'matcher', guest),
    ).resolves.toEqual({ ok: true })

    const pub = await authorizeTunnelChannel('publish', 'matcher', guest)
    expect(pub.ok).toBe(false)
  })

  it('treats anon-* as unauthenticated even if flag is wrong', () => {
    expect(isAnonymousTunnelUserId('anon-abc')).toBe(true)
    expect(isAnonymousTunnelUserId('user-a')).toBe(false)
  })
})
