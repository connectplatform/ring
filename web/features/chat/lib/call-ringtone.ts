/**
 * Lightweight Web Audio ringtone for incoming call banner (no asset fetch).
 */

let audioCtx: AudioContext | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

function beep(ctx: AudioContext, freq: number, durationMs: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.value = 0.08
  osc.connect(gain)
  gain.connect(ctx.destination)
  const now = ctx.currentTime
  osc.start(now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.stop(now + durationMs / 1000)
}

export function startIncomingCallRingtone(): () => void {
  const ctx = getCtx()
  if (!ctx) return () => {}

  void ctx.resume().catch(() => {})

  const pulse = () => {
    beep(ctx, 880, 180)
    window.setTimeout(() => beep(ctx, 660, 180), 220)
  }

  pulse()
  intervalId = setInterval(pulse, 1400)

  return () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}
