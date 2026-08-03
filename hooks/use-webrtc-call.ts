'use client'

/**
 * 1:1 WebRTC call over Tunnel conversation channel + STUNner ICE.
 * UX lifecycle absorbed from connect-web-client NativeVideoCallService /
 * VideoCallScreen (invite → accept → connected → hangup) — media plane is
 * browser RTCPeerConnection, not Connect RTVS/FastTransponder.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnel } from '@/hooks/use-tunnel'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import { apiClient } from '@/lib/api-client'
import { fetchIceServers } from '@/features/chat/lib/fetch-ice-servers'
import type {
  CallMedia,
  CallPhase,
  CallSignalPayload,
} from '@/features/chat/lib/call-types'
import { emitConversationMessage } from '@/features/chat/lib/conversation-message-events'
import type { Message } from '@/features/chat/types'
import type { TunnelMessage } from '@/lib/tunnel/types'

function newCallId(selfId: string, peerId: string) {
  return `call_${selfId}_${peerId}_${Date.now()}`
}

export type IncomingCallInvite = CallSignalPayload & {
  conversationId: string
}

export type UseWebRtcCallOptions = {
  conversationId: string
  /** Peer user id (direct chat). Required to place a call. */
  peerUserId: string | null
  /** Display name for peer (system lines / UI); optional. */
  peerUserName?: string
  enabled?: boolean
  /**
   * Invite injected from user-scoped `calls:incoming` (global ring).
   * UPGRADE: replace with a CallSessionProvider context so one PC spans route changes.
   */
  injectedInvite?: IncomingCallInvite | null
  onInjectedInviteConsumed?: () => void
}

export type UseWebRtcCallReturn = {
  phase: CallPhase
  media: CallMedia
  callId: string | null
  error: string | null
  turnConfigured: boolean | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
  startCall: (media: CallMedia) => Promise<{ ok: boolean; error?: string }>
  acceptCall: () => Promise<void>
  rejectCall: () => Promise<void>
  hangup: () => Promise<void>
  toggleAudio: () => void
  toggleVideo: () => void
}

const DISCONNECT_GRACE_MS = 8000

export function useWebRtcCall(options: UseWebRtcCallOptions): UseWebRtcCallReturn {
  const {
    conversationId,
    peerUserId,
    peerUserName,
    enabled = true,
    injectedInvite = null,
    onInjectedInviteConsumed,
  } = options
  const { data: session } = useSession()
  const selfId = session?.user?.id ?? ''
  const selfName = session?.user?.name || session?.user?.email || 'User'
  const { publish, isConnected } = useTunnel({ autoConnect: false })

  // UPGRADE: device picker via enumerateDevices before getUserMedia.
  // UPGRADE: screen share track replace with getDisplayMedia (Connect CallControls parity).
  // UPGRADE: IPv6 TURN — dual-stack ServiceLB / hostNetwork dataplane on k3s-or.
  // UPGRADE: LiveKit SFU for group mesh when >2 peers.

  const [phase, setPhase] = useState<CallPhase>('idle')
  const [media, setMedia] = useState<CallMedia>('audio')
  const [callId, setCallId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [turnConfigured, setTurnConfigured] = useState<boolean | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const callIdRef = useRef<string | null>(null)
  const mediaRef = useRef<CallMedia>('audio')
  const phaseRef = useRef<CallPhase>('idle')
  const conversationIdRef = useRef(conversationId)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const remoteDescSetRef = useRef(false)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const makingOfferRef = useRef(false)

  conversationIdRef.current = conversationId
  callIdRef.current = callId
  mediaRef.current = media
  phaseRef.current = phase

  const clearDisconnectTimer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current)
      disconnectTimerRef.current = null
    }
  }, [])

  const signal = useCallback(
    async (event: string, payload: CallSignalPayload) => {
      if (!isConnected) {
        throw new Error('Realtime tunnel required for calls')
      }
      const cid = conversationIdRef.current
      if (!cid) throw new Error('No conversation for signaling')
      await publish(`conversation:${cid}`, event, payload)
    },
    [isConnected, publish],
  )

  const recordCallEnded = useCallback(
    async (reason: 'ended' | 'rejected' | 'failed') => {
      const cid = conversationIdRef.current
      const call = callIdRef.current
      if (!cid || !call) return
      try {
        const res = await apiClient.post(
          `/api/conversations/${cid}/call-event`,
          {
            callId: call,
            event: reason,
            peerUserName: peerUserName || undefined,
          },
          { timeout: 8000, retries: 0 },
        )
        const message = (res.data as { message?: Message } | undefined)?.message
        if (res.success && message && message.id) {
          emitConversationMessage(cid, message)
        }
      } catch {
        /* non-fatal */
      }
    },
    [peerUserName],
  )

  const cleanupMedia = useCallback(() => {
    clearDisconnectTimer()
    pendingIceRef.current = []
    pendingOfferRef.current = null
    remoteDescSetRef.current = false
    makingOfferRef.current = false
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    try {
      pcRef.current?.close()
    } catch {
      /* ignore */
    }
    pcRef.current = null
  }, [clearDisconnectTimer])

  const resetIdle = useCallback(() => {
    cleanupMedia()
    setCallId(null)
    callIdRef.current = null
    setPhase('idle')
    phaseRef.current = 'idle'
    setError(null)
    setAudioEnabled(true)
    setVideoEnabled(true)
  }, [cleanupMedia])

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    if (!remoteDescSetRef.current) return
    const queued = pendingIceRef.current.splice(0, pendingIceRef.current.length)
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        /* late/duplicate */
      }
    }
  }, [])

  const applyRemoteOffer = useCallback(
    async (pc: RTCPeerConnection, sdp: RTCSessionDescriptionInit) => {
      await pc.setRemoteDescription(sdp)
      remoteDescSetRef.current = true
      await flushPendingIce(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const cid = callIdRef.current
      if (!cid || !selfId) return
      await signal('call:answer', {
        callId: cid,
        fromUserId: selfId,
        fromUserName: selfName,
        media: mediaRef.current,
        sdp: answer,
      })
    },
    [flushPendingIce, selfId, selfName, signal],
  )

  const ensurePc = useCallback(
    async (iceServers: RTCIceServer[]) => {
      if (pcRef.current) return pcRef.current
      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track])
        setRemoteStream((prev) => {
          if (prev && prev.id === stream.id) return prev
          if (prev && !ev.streams[0]) {
            prev.addTrack(ev.track)
            return prev
          }
          return stream
        })
      }

      pc.onicecandidate = (ev) => {
        const cid = callIdRef.current
        if (!ev.candidate || !cid || !selfId) return
        void signal('call:ice', {
          callId: cid,
          fromUserId: selfId,
          media: mediaRef.current,
          candidate: ev.candidate.toJSON(),
        }).catch(() => {})
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState
        if (state === 'connected' || state === 'connecting') {
          clearDisconnectTimer()
          if (state === 'connected') {
            setPhase('connected')
            phaseRef.current = 'connected'
          }
          return
        }

        if (state === 'disconnected') {
          // Brief ICE blips are common — grace period + restartIce before teardown.
          // UPGRADE: full ICE restart renegotiation when restartIce alone is insufficient.
          clearDisconnectTimer()
          try {
            pc.restartIce()
          } catch {
            /* ignore */
          }
          disconnectTimerRef.current = setTimeout(() => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              if (phaseRef.current !== 'idle' && phaseRef.current !== 'ended') {
                void recordCallEnded('failed')
                setPhase('ended')
                phaseRef.current = 'ended'
                window.setTimeout(() => resetIdle(), 1200)
              }
            }
          }, DISCONNECT_GRACE_MS)
          return
        }

        if (state === 'failed' || state === 'closed') {
          clearDisconnectTimer()
          if (phaseRef.current !== 'idle' && phaseRef.current !== 'ended') {
            void recordCallEnded('failed')
            setPhase('ended')
            phaseRef.current = 'ended'
            window.setTimeout(() => resetIdle(), 1200)
          }
        }
      }

      return pc
    },
    [clearDisconnectTimer, recordCallEnded, resetIdle, selfId, signal],
  )

  const attachLocal = useCallback(async (m: CallMedia) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: m === 'video',
    })
    localRef.current = stream
    setLocalStream(stream)
    setAudioEnabled(true)
    setVideoEnabled(m === 'video')
    const pc = pcRef.current
    if (pc) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream)
      }
    }
    return stream
  }, [])

  const startCall = useCallback(
    async (m: CallMedia): Promise<{ ok: boolean; error?: string }> => {
      if (!selfId || !peerUserId) {
        const msg = 'No peer for this conversation'
        setError(msg)
        return { ok: false, error: msg }
      }
      if (phaseRef.current !== 'idle') return { ok: false, error: 'Call already in progress' }
      if (!isConnected) {
        const msg = 'Realtime tunnel required for calls'
        setError(msg)
        return { ok: false, error: msg }
      }

      try {
        setError(null)
        const { iceServers, turnConfigured: tc } = await fetchIceServers()
        setTurnConfigured(tc)
        const id = newCallId(selfId, peerUserId)
        setCallId(id)
        callIdRef.current = id
        setMedia(m)
        mediaRef.current = m
        setPhase('outgoing')
        phaseRef.current = 'outgoing'

        await ensurePc(iceServers)
        await attachLocal(m)

        // retries: 0 — server invite is not fully idempotent across pods; avoid double system lines.
        // UPGRADE: FCM data message when peer has no live socket (see fcm_specialist).
        const inviteRes = await apiClient.post(
          `/api/conversations/${conversationId}/call-invite`,
          {
            callId: id,
            media: m,
            peerUserId,
            fromUserName: selfName,
          },
          { timeout: 10000, retries: 0 },
        )
        if (!inviteRes.success) {
          throw new Error(inviteRes.error || 'Invite failed')
        }
        const systemMessage = (inviteRes.data as { message?: Message } | undefined)?.message
        if (systemMessage?.id) {
          emitConversationMessage(conversationId, systemMessage)
        }
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start call'
        setError(msg)
        resetIdle()
        return { ok: false, error: msg }
      }
    },
    [
      attachLocal,
      conversationId,
      ensurePc,
      isConnected,
      peerUserId,
      resetIdle,
      selfId,
      selfName,
    ],
  )

  const acceptCall = useCallback(async () => {
    if (!selfId || !callIdRef.current) return
    if (phaseRef.current !== 'incoming') return

    try {
      setError(null)
      setPhase('connecting')
      phaseRef.current = 'connecting'

      const { iceServers, turnConfigured: tc } = await fetchIceServers()
      setTurnConfigured(tc)
      const pc = await ensurePc(iceServers)
      await attachLocal(mediaRef.current)

      // Flush offer that arrived while getUserMedia was in flight.
      const pending = pendingOfferRef.current
      pendingOfferRef.current = null

      await signal('call:accept', {
        callId: callIdRef.current,
        fromUserId: selfId,
        fromUserName: selfName,
        media: mediaRef.current,
      })

      if (pending) {
        await applyRemoteOffer(pc, pending)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept call')
      const cid = callIdRef.current
      if (cid) {
        void signal('call:reject', {
          callId: cid,
          fromUserId: selfId,
          media: mediaRef.current,
          reason: 'accept_failed',
        }).catch(() => {})
      }
      void recordCallEnded('failed')
      resetIdle()
    }
  }, [
    applyRemoteOffer,
    attachLocal,
    ensurePc,
    recordCallEnded,
    resetIdle,
    selfId,
    selfName,
    signal,
  ])

  const rejectCall = useCallback(async () => {
    const cid = callIdRef.current
    if (cid && selfId) {
      try {
        await signal('call:reject', {
          callId: cid,
          fromUserId: selfId,
          media: mediaRef.current,
          reason: 'rejected',
        })
      } catch {
        /* ignore */
      }
      void recordCallEnded('rejected')
    }
    resetIdle()
  }, [recordCallEnded, resetIdle, selfId, signal])

  const hangup = useCallback(async () => {
    const cid = callIdRef.current
    const wasActive = phaseRef.current !== 'idle' && phaseRef.current !== 'ended'
    if (cid && selfId && wasActive) {
      // Fire-and-forget hangup signal — do not block call-event / system line on stalled tunnel.
      void signal('call:hangup', {
        callId: cid,
        fromUserId: selfId,
        media: mediaRef.current,
      }).catch(() => {
        /* ignore */
      })
      void recordCallEnded('ended')
    }
    setPhase('ended')
    phaseRef.current = 'ended'
    window.setTimeout(() => resetIdle(), 600)
  }, [recordCallEnded, resetIdle, selfId, signal])

  const toggleAudio = useCallback(() => {
    const next = !audioEnabled
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next
    })
    setAudioEnabled(next)
  }, [audioEnabled])

  const toggleVideo = useCallback(() => {
    const next = !videoEnabled
    localRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next
    })
    setVideoEnabled(next)
  }, [videoEnabled])

  const handleSignal = useCallback(
    async (msg: TunnelMessage) => {
      if (!selfId || !msg.event?.startsWith('call:') || !msg.payload) return
      const payload = msg.payload as CallSignalPayload
      if (!payload.callId || !payload.fromUserId) return
      if (payload.fromUserId === selfId) return

      const event = msg.event

      if (event === 'call:invite') {
        if (phaseRef.current !== 'idle') {
          void signal('call:reject', {
            callId: payload.callId,
            fromUserId: selfId,
            media: payload.media,
            reason: 'busy',
          }).catch(() => {})
          return
        }
        setCallId(payload.callId)
        callIdRef.current = payload.callId
        setMedia(payload.media)
        mediaRef.current = payload.media
        setPhase('incoming')
        phaseRef.current = 'incoming'
        return
      }

      if (payload.callId !== callIdRef.current) return

      if (event === 'call:reject' || event === 'call:hangup') {
        setPhase('ended')
        phaseRef.current = 'ended'
        window.setTimeout(() => resetIdle(), 800)
        return
      }

      if (event === 'call:accept' && phaseRef.current === 'outgoing') {
        if (makingOfferRef.current) return
        makingOfferRef.current = true
        try {
          setPhase('connecting')
          phaseRef.current = 'connecting'
          const pc = pcRef.current
          if (!pc) return
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await signal('call:offer', {
            callId: payload.callId,
            fromUserId: selfId,
            media: mediaRef.current,
            sdp: offer,
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Offer failed')
          await hangup()
        } finally {
          makingOfferRef.current = false
        }
        return
      }

      if (event === 'call:offer' && payload.sdp) {
        try {
          const pc = pcRef.current
          if (!pc || phaseRef.current === 'incoming') {
            // PC not ready yet (still in getUserMedia) — queue for acceptCall flush.
            pendingOfferRef.current = payload.sdp
            return
          }
          await applyRemoteOffer(pc, payload.sdp)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Answer failed')
          await hangup()
        }
        return
      }

      if (event === 'call:answer' && payload.sdp) {
        try {
          const pc = pcRef.current
          if (!pc) return
          await pc.setRemoteDescription(payload.sdp)
          remoteDescSetRef.current = true
          await flushPendingIce(pc)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Remote answer failed')
          await hangup()
        }
        return
      }

      if (event === 'call:ice' && payload.candidate) {
        const pc = pcRef.current
        if (!pc || !remoteDescSetRef.current) {
          pendingIceRef.current.push(payload.candidate)
          return
        }
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch {
          /* late/duplicate candidates */
        }
      }
    },
    [applyRemoteOffer, flushPendingIce, hangup, resetIdle, selfId, signal],
  )

  // Keep Tunnel subscribe alive when an injected invite is pending even if callPeer
  // has not loaded yet (global-accept race).
  const signalingEnabled = Boolean(
    selfId &&
      conversationId &&
      (enabled ||
        (injectedInvite && injectedInvite.conversationId === conversationId) ||
        phase !== 'idle'),
  )

  useTunnelChannel({
    channel: `conversation:${conversationId}`,
    enabled: signalingEnabled,
    onTunnelMessage: handleSignal,
  })

  // Apply global incoming invite after navigating to the conversation.
  useEffect(() => {
    if (!injectedInvite || !selfId) return
    if (injectedInvite.conversationId !== conversationId) return
    if (phaseRef.current !== 'idle') {
      onInjectedInviteConsumed?.()
      return
    }
    setCallId(injectedInvite.callId)
    callIdRef.current = injectedInvite.callId
    setMedia(injectedInvite.media)
    mediaRef.current = injectedInvite.media
    setPhase('incoming')
    phaseRef.current = 'incoming'
    onInjectedInviteConsumed?.()
  }, [conversationId, injectedInvite, onInjectedInviteConsumed, selfId])

  // Switching threads mid-call must hang up — PC/signaling are conversation-scoped.
  // UPGRADE: CallSessionProvider to keep media across soft-nav.
  const activeCallConversationRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'ended') {
      if (
        activeCallConversationRef.current &&
        activeCallConversationRef.current !== conversationId
      ) {
        void hangup()
      }
      activeCallConversationRef.current = conversationId
    } else if (phase === 'idle') {
      activeCallConversationRef.current = null
    }
  }, [conversationId, hangup, phase])

  useEffect(() => {
    return () => {
      clearDisconnectTimer()
      cleanupMedia()
    }
  }, [cleanupMedia, clearDisconnectTimer])

  return {
    phase,
    media,
    callId,
    error,
    turnConfigured,
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleAudio,
    toggleVideo,
  }
}
