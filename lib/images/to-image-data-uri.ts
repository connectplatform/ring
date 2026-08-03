/**
 * SSOT: bytes → `data:image/...;base64,...` for ImageConductor / xAI edits.
 * Do not import NFT `loadProjectFaviconPngDataUri` — favicon loading stays there;
 * this helper is the shared encoding step.
 */

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return btoa(binary)
}

export function toImageDataUri(bytes: ArrayBuffer | Uint8Array, mime: string): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const safeMime =
    typeof mime === 'string' && mime.startsWith('image/')
      ? mime.split(';')[0]!.trim() || 'image/png'
      : 'image/png'
  return `data:${safeMime};base64,${toBase64(u8)}`
}

/** Browser File → data URI (client-safe). */
export async function fileToImageDataUri(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  return toImageDataUri(buf, file.type || 'image/png')
}
