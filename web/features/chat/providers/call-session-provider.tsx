'use client'

/**
 * CallSessionProvider — holds active call identity across soft-nav so
 * useWebRtcCall can keep one RTCPeerConnection instead of hangup-on-route-change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type { CallMedia, CallPhase } from '@/features/chat/lib/call-types'
import type { IncomingCallInvite } from '@/hooks/use-webrtc-call'

export type CallSessionSnapshot = {
  conversationId: string | null
  peerUserId: string | null
  callId: string | null
  media: CallMedia
  phase: CallPhase
  keepAliveAcrossNav: boolean
}

type CallSessionContextValue = {
  session: CallSessionSnapshot
  pendingInvite: IncomingCallInvite | null
  setPendingInvite: (invite: IncomingCallInvite | null) => void
  bindActiveCall: (next: {
    conversationId: string
    peerUserId: string | null
    callId: string | null
    media: CallMedia
    phase: CallPhase
  }) => void
  clearActiveCall: () => void
  setKeepAliveAcrossNav: (keep: boolean) => void
  /** Shared PC ref slot — owned by the hook that creates the connection. */
  pcRef: MutableRefObject<RTCPeerConnection | null>
  shouldHangupOnConversationChange: (
    nextConversationId: string,
    phase: CallPhase,
  ) => boolean
}

const idleSession: CallSessionSnapshot = {
  conversationId: null,
  peerUserId: null,
  callId: null,
  media: 'audio',
  phase: 'idle',
  keepAliveAcrossNav: true,
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null)

export function CallSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CallSessionSnapshot>(idleSession)
  const [pendingInvite, setPendingInvite] = useState<IncomingCallInvite | null>(
    null,
  )
  const pcRef = useRef<RTCPeerConnection | null>(null)

  const bindActiveCall = useCallback(
    (next: {
      conversationId: string
      peerUserId: string | null
      callId: string | null
      media: CallMedia
      phase: CallPhase
    }) => {
      setSession((prev) => ({
        ...prev,
        conversationId: next.conversationId,
        peerUserId: next.peerUserId,
        callId: next.callId,
        media: next.media,
        phase: next.phase,
      }))
    },
    [],
  )

  const clearActiveCall = useCallback(() => {
    setSession((prev) => ({
      ...idleSession,
      keepAliveAcrossNav: prev.keepAliveAcrossNav,
    }))
  }, [])

  const setKeepAliveAcrossNav = useCallback((keep: boolean) => {
    setSession((prev) => ({ ...prev, keepAliveAcrossNav: keep }))
  }, [])

  const shouldHangupOnConversationChange = useCallback(
    (nextConversationId: string, phase: CallPhase) => {
      if (phase === 'idle' || phase === 'ended') return false
      if (!session.keepAliveAcrossNav) return true
      if (!session.conversationId) return false
      // Soft-nav within same call conversation: keep PC
      if (session.conversationId === nextConversationId) return false
      // Different thread while call active — hang up (1:1 conversation-scoped signaling)
      return true
    },
    [session.conversationId, session.keepAliveAcrossNav],
  )

  const value = useMemo<CallSessionContextValue>(
    () => ({
      session,
      pendingInvite,
      setPendingInvite,
      bindActiveCall,
      clearActiveCall,
      setKeepAliveAcrossNav,
      pcRef,
      shouldHangupOnConversationChange,
    }),
    [
      session,
      pendingInvite,
      bindActiveCall,
      clearActiveCall,
      setKeepAliveAcrossNav,
      shouldHangupOnConversationChange,
    ],
  )

  return (
    <CallSessionContext.Provider value={value}>
      {children}
    </CallSessionContext.Provider>
  )
}

export function useCallSession(): CallSessionContextValue {
  const ctx = useContext(CallSessionContext)
  if (!ctx) {
    throw new Error('useCallSession must be used within CallSessionProvider')
  }
  return ctx
}

/** Optional — returns null outside provider (messages shell may wrap gradually). */
export function useCallSessionOptional(): CallSessionContextValue | null {
  return useContext(CallSessionContext)
}
