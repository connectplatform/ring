/** Client probe for RFC Web Push (dedicated VAPID_*). Safe without Firebase. */

export async function isRfcWebPushConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/push/vapid-public')
    if (!res.ok) return false
    const data = (await res.json()) as { configured?: boolean; publicKey?: string }
    return Boolean(data.configured && data.publicKey)
  } catch {
    return false
  }
}
