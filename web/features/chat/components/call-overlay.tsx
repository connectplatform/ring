'use client'

/**
 * Call overlay — control UX absorbed from connect-web-client CallControls /
 * VideoCallScreen (mute, camera, end, accept/reject). Ring media = WebRTC.
 */

import { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import type { UseWebRtcCallReturn } from '@/hooks/use-webrtc-call'

type CallOverlayProps = {
  call: UseWebRtcCallReturn
  peerLabel: string
  className?: string
}

function MediaPreview({
  stream,
  muted,
  mirror,
  className,
}: {
  stream: MediaStream | null
  muted?: boolean
  mirror?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    return () => {
      el.srcObject = null
    }
  }, [stream])

  if (!stream) return null
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(mirror && 'scale-x-[-1]', className)}
    />
  )
}

/** Always mount remote audio so audio-only calls actually play. */
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    // Browsers may block autoplay until a user gesture; accept/startCall is that gesture.
    void el.play().catch(() => {})
    return () => {
      el.srcObject = null
    }
  }, [stream])

  if (!stream) return null
  return <audio ref={ref} autoPlay playsInline className="sr-only" />
}

export function CallOverlay({ call, peerLabel, className }: CallOverlayProps) {
  const t = useTranslations('modules.messenger')
  const {
    phase,
    media,
    error,
    turnConfigured,
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    acceptCall,
    rejectCall,
    hangup,
    toggleAudio,
    toggleVideo,
  } = call

  if (phase === 'idle') return null

  const statusLabel =
    phase === 'outgoing'
      ? t('callRinging')
      : phase === 'incoming'
        ? t('callIncoming')
        : phase === 'connecting'
          ? t('callConnecting')
          : phase === 'connected'
            ? t('callConnected')
            : t('callEnded')

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-50',
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t('callTitle')}
    >
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
        {/* Critical: remote audio must attach even when UI is avatar-only (audio calls). */}
        <RemoteAudio stream={remoteStream} />

        {media === 'video' && remoteStream ? (
          <MediaPreview
            stream={remoteStream}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-3xl font-semibold">
              {peerLabel.slice(0, 1).toUpperCase() || '?'}
            </div>
            <h2 className="text-xl font-semibold">{peerLabel}</h2>
            <p className="text-sm text-zinc-400">{statusLabel}</p>
          </div>
        )}

        {media === 'video' && localStream && (
          <MediaPreview
            stream={localStream}
            muted
            mirror
            className="absolute bottom-28 right-4 h-36 w-28 rounded-lg border border-zinc-700 object-cover shadow-lg"
          />
        )}

        {media === 'video' && remoteStream && (
          <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 py-6 text-center">
            <h2 className="text-lg font-semibold">{peerLabel}</h2>
            <p className="text-xs text-zinc-300">{statusLabel}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 px-4 pb-10 pt-4">
        {error && (
          <p className="text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {turnConfigured === false && phase === 'connected' && (
          <p className="text-center text-xs text-amber-400">{t('callTurnMissing')}</p>
        )}

        {phase === 'incoming' ? (
          <div className="flex items-center justify-center gap-6">
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="h-14 w-14 rounded-full p-0"
              onClick={() => void rejectCall()}
              aria-label={t('callReject')}
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-14 w-14 rounded-full bg-emerald-600 p-0 hover:bg-emerald-500"
              onClick={() => void acceptCall()}
              aria-label={t('callAccept')}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className={cn(
                'h-12 w-12 rounded-full p-0',
                !audioEnabled && 'bg-zinc-700 text-zinc-400',
              )}
              onClick={toggleAudio}
              aria-label={audioEnabled ? t('callMute') : t('callUnmute')}
            >
              {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            {media === 'video' && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className={cn(
                  'h-12 w-12 rounded-full p-0',
                  !videoEnabled && 'bg-zinc-700 text-zinc-400',
                )}
                onClick={toggleVideo}
                aria-label={videoEnabled ? t('callStopVideo') : t('callStartVideo')}
              >
                {videoEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            )}

            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="h-14 w-14 rounded-full p-0"
              onClick={() => void hangup()}
              aria-label={t('callHangup')}
              disabled={phase === 'ended'}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
