/** WebRTC call signaling over Tunnel `conversation:{id}` (reuse typing channel). */

export type CallMedia = 'audio' | 'video'

export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended'

export type CallSignalEvent =
  | 'call:invite'
  | 'call:accept'
  | 'call:reject'
  | 'call:offer'
  | 'call:answer'
  | 'call:ice'
  | 'call:hangup'

export type CallSignalPayload = {
  callId: string
  fromUserId: string
  fromUserName?: string
  media: CallMedia
  /** SDP for offer/answer */
  sdp?: RTCSessionDescriptionInit
  /** ICE candidate */
  candidate?: RTCIceCandidateInit
  reason?: string
}

export type IceServersResponse = {
  success: boolean
  data?: {
    iceServers: RTCIceServer[]
    turnConfigured: boolean
  }
  error?: string
}
