/**
 * Peer-game DataChannel — optimistic move hints only.
 * Tunnel + DB remain SSOT; never treat peer envelopes as authoritative.
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useTunnel } from '@/hooks/use-tunnel'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import { fetchIceServers } from '@/features/chat/lib/fetch-ice-servers'
import type { TunnelMessage } from '@/lib/tunnel/types'

export type OptimisticMoveEnvelope = {
  sessionId: string
  moveSeq: number
  pluginPayload: Record<string, unknown>
  clientTs: number
  fromUserId: string
}

type DcSignal =
  | { kind: 'offer'; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { kind: 'answer'; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { kind: 'ice'; candidate: RTCIceCandidateInit; fromUserId: string }

const CHANNEL_LABEL = 'ring-peer-game-moves'

function isOfferer(selfId: string, peerId: string): boolean {
  return selfId < peerId
}

export function usePeerGameDataChannel(options: {
  sessionId: string | null
  selfId: string
  peerId: string | null
  enabled: boolean
  onPeerOptimisticMove: (envelope: OptimisticMoveEnvelope) => void
}): {
  sendOptimisticMove: (payload: Record<string, unknown>, moveSeq: number) => void
} {
  const { sessionId, selfId, peerId, enabled, onPeerOptimisticMove } = options
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const readyRef = useRef(false)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const onPeerRef = useRef(onPeerOptimisticMove)
  onPeerRef.current = onPeerOptimisticMove

  const { publish, isConnected } = useTunnel({ autoConnect: false })
  const channel = sessionId ? `game:${sessionId}` : 'game:none'

  const publishSignal = useCallback(
    async (signal: DcSignal) => {
      if (!sessionId || !isConnected) return
      try {
        await publish(channel, 'game:dc-signal', { sessionId, ...signal })
      } catch {
        /* Tunnel fallback — moves still go via server actions */
      }
    },
    [channel, isConnected, publish, sessionId],
  )

  const attachDc = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      readyRef.current = true
    }
    dc.onclose = () => {
      readyRef.current = false
    }
    dc.onmessage = (ev) => {
      try {
        const raw =
          typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data)
        const envelope = JSON.parse(raw) as OptimisticMoveEnvelope
        if (!envelope?.sessionId || !envelope.pluginPayload) return
        onPeerRef.current(envelope)
      } catch {
        /* ignore malformed */
      }
    }
  }, [])

  const ensurePc = useCallback(async () => {
    if (!sessionId || !selfId || !peerId || !enabled) return null
    if (pcRef.current) return pcRef.current

    const { iceServers } = await fetchIceServers()
    const pc = new RTCPeerConnection({ iceServers })
    pcRef.current = pc

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return
      void publishSignal({
        kind: 'ice',
        candidate: ev.candidate.toJSON(),
        fromUserId: selfId,
      })
    }

    pc.ondatachannel = (ev) => {
      if (ev.channel.label === CHANNEL_LABEL) attachDc(ev.channel)
    }

    if (isOfferer(selfId, peerId)) {
      const dc = pc.createDataChannel(CHANNEL_LABEL, { ordered: true })
      attachDc(dc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      void publishSignal({ kind: 'offer', sdp: offer, fromUserId: selfId })
    }

    return pc
  }, [attachDc, enabled, peerId, publishSignal, selfId, sessionId])

  const onTunnelMessage = useCallback(
    (msg: TunnelMessage) => {
      if (msg.event !== 'game:dc-signal' || !sessionId) return
      const payload = msg.payload as DcSignal & { sessionId?: string }
      if (!payload || payload.sessionId !== sessionId) return
      if (payload.fromUserId === selfId) return

      void (async () => {
        try {
          const pc = (await ensurePc()) || pcRef.current
          if (!pc) return

          if (payload.kind === 'offer' && !isOfferer(selfId, peerId || '')) {
            await pc.setRemoteDescription(payload.sdp)
            for (const c of pendingIceRef.current) {
              try {
                await pc.addIceCandidate(c)
              } catch {
                /* stale */
              }
            }
            pendingIceRef.current = []
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            void publishSignal({ kind: 'answer', sdp: answer, fromUserId: selfId })
          } else if (payload.kind === 'answer' && isOfferer(selfId, peerId || '')) {
            if (!pc.currentRemoteDescription) {
              await pc.setRemoteDescription(payload.sdp)
            }
            for (const c of pendingIceRef.current) {
              try {
                await pc.addIceCandidate(c)
              } catch {
                /* stale */
              }
            }
            pendingIceRef.current = []
          } else if (payload.kind === 'ice') {
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(payload.candidate)
              } catch {
                /* stale */
              }
            } else {
              pendingIceRef.current.push(payload.candidate)
            }
          }
        } catch {
          /* ICE/DC setup is best-effort; Tunnel SSOT continues */
        }
      })()
    },
    [ensurePc, peerId, publishSignal, selfId, sessionId],
  )

  useTunnelChannel({
    channel,
    enabled: Boolean(enabled && sessionId && selfId && peerId),
    onTunnelMessage,
  })

  useEffect(() => {
    if (!enabled || !sessionId || !selfId || !peerId) return
    void ensurePc()
    return () => {
      try {
        dcRef.current?.close()
      } catch {
        /* ignore */
      }
      try {
        pcRef.current?.close()
      } catch {
        /* ignore */
      }
      dcRef.current = null
      pcRef.current = null
      readyRef.current = false
      pendingIceRef.current = []
    }
  }, [enabled, ensurePc, peerId, selfId, sessionId])

  const sendOptimisticMove = useCallback(
    (pluginPayload: Record<string, unknown>, moveSeq: number) => {
      if (!sessionId || !selfId) return
      const envelope: OptimisticMoveEnvelope = {
        sessionId,
        moveSeq,
        pluginPayload,
        clientTs: Date.now(),
        fromUserId: selfId,
      }
      const dc = dcRef.current
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(envelope))
        } catch {
          /* fall through — Tunnel/server path remains */
        }
      }
    },
    [selfId, sessionId],
  )

  return { sendOptimisticMove }
}
