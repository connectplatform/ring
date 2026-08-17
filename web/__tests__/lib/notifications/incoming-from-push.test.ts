import { describe, expect, it } from '@jest/globals'
import {
  emitInteractivePushFromFcmData,
  isInteractivePushType,
  parseCallInviteFromPushData,
  parseGameInviteFromPushData,
  subscribeIncomingCallFromPush,
} from '@/lib/notifications/incoming-from-push'

describe('incoming-from-push parsers', () => {
  it('classifies call and game types as interactive (no toast/navigate)', () => {
    expect(isInteractivePushType('call_invite')).toBe(true)
    expect(isInteractivePushType('game_request')).toBe(true)
    expect(isInteractivePushType('news')).toBe(false)
  })

  it('parses CALL_INVITE from stringified metadata', () => {
    const invite = parseCallInviteFromPushData({
      type: 'call_invite',
      metadata: JSON.stringify({
        kind: 'call_invite',
        callId: 'call_1',
        conversationId: 'conv_1',
        fromUserId: 'user_a',
        media: 'video',
      }),
    })
    expect(invite).toEqual({
      callId: 'call_1',
      conversationId: 'conv_1',
      fromUserId: 'user_a',
      media: 'video',
      fromUserName: undefined,
    })
  })

  it('parses CALL_INVITE from clickAction query when metadata is thin', () => {
    const invite = parseCallInviteFromPushData({
      type: 'call_invite',
      fromUserId: 'user_a',
      clickAction: '/messages?conversation=conv_9&call=call_9',
    })
    expect(invite?.callId).toBe('call_9')
    expect(invite?.conversationId).toBe('conv_9')
  })

  it('parses GAME_REQUEST and fills peerUserId from the signed-in user', () => {
    const invite = parseGameInviteFromPushData(
      {
        type: 'game_request',
        metadata: JSON.stringify({
          kind: 'game_request',
          sessionId: 'sess_1',
          slug: 'chess',
          conversationId: 'conv_1',
          fromUserId: 'challenger',
        }),
      },
      'peer_user',
    )
    expect(invite).toMatchObject({
      sessionId: 'sess_1',
      slug: 'chess',
      peerUserId: 'peer_user',
      fromUserId: 'challenger',
    })
  })

  it('emits call invites to subscribers and returns true', () => {
    const seen: string[] = []
    const unsub = subscribeIncomingCallFromPush((invite) => {
      seen.push(invite.callId)
    })
    const handled = emitInteractivePushFromFcmData(
      {
        type: 'call_invite',
        metadata: JSON.stringify({
          callId: 'call_emit',
          conversationId: 'conv_e',
          fromUserId: 'user_a',
          media: 'audio',
        }),
      },
      'peer',
    )
    unsub()
    expect(handled).toBe(true)
    expect(seen).toEqual(['call_emit'])
  })
})
