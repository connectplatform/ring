/**
 * Soft game-invite chime (Web Audio). Distinct from call ringtone —
 * must never call setPeerCallBusy or reuse AV-call audio assets.
 */

let lastChimeAt = 0

export function playGameInviteChime(): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastChimeAt < 1500) return
  lastChimeAt = now

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    void ctx.resume()
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined)
    }, 400)
  } catch {
    /* non-fatal — autoplay policies / missing AudioContext */
  }
}
