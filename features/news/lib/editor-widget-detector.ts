/**
 * URL → embed widget classifier for TipTap paste / slash Embed command.
 * Network-free on the paste path; metadata hydration is optional via embed-preview API.
 */

export type EmbedProvider =
  | 'youtube'
  | 'rumble'
  | 'x'
  | 'facebook'
  | 'suno'
  | 'generic_og'

export type DetectedEmbed = {
  kind: 'embed'
  provider: EmbedProvider
  canonicalUrl: string
  embedId?: string
  previewMode: 'player' | 'card'
}

function safeUrl(raw: string): URL | null {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProto)
  } catch {
    return null
  }
}

/** True when clipboard / input looks like a single URL (no surrounding prose). */
export function looksLikeLoneUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  return Boolean(safeUrl(trimmed))
}

export function detectEmbedFromUrl(rawUrl: string): DetectedEmbed {
  const url = safeUrl(rawUrl.trim())
  if (!url) {
    return {
      kind: 'embed',
      provider: 'generic_og',
      canonicalUrl: rawUrl.trim(),
      previewMode: 'card',
    }
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const path = url.pathname

  // YouTube
  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  ) {
    let embedId: string | undefined
    if (host === 'youtu.be') {
      embedId = path.split('/').filter(Boolean)[0]
    } else if (path.startsWith('/shorts/')) {
      embedId = path.split('/')[2]
    } else if (path.startsWith('/embed/')) {
      embedId = path.split('/')[2]
    } else {
      embedId = url.searchParams.get('v') || undefined
    }
    return {
      kind: 'embed',
      provider: 'youtube',
      canonicalUrl: url.toString(),
      embedId,
      previewMode: 'player',
    }
  }

  // Rumble
  if (host === 'rumble.com') {
    const embedId = path.split('/').filter(Boolean)[0]?.replace(/\.html$/, '')
    return {
      kind: 'embed',
      provider: 'rumble',
      canonicalUrl: url.toString(),
      embedId,
      previewMode: 'player',
    }
  }

  // X / Twitter
  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    const parts = path.split('/').filter(Boolean)
    const statusIdx = parts.indexOf('status')
    const embedId = statusIdx >= 0 ? parts[statusIdx + 1] : undefined
    return {
      kind: 'embed',
      provider: 'x',
      canonicalUrl: url.toString(),
      embedId,
      previewMode: 'card',
    }
  }

  // Facebook
  if (
    host === 'facebook.com' ||
    host === 'fb.watch' ||
    host === 'fb.com' ||
    host.endsWith('.facebook.com')
  ) {
    return {
      kind: 'embed',
      provider: 'facebook',
      canonicalUrl: url.toString(),
      previewMode: 'card',
    }
  }

  // Suno
  if (host === 'suno.com' || host === 'suno.ai') {
    const embedId = path.split('/').filter(Boolean).pop()
    return {
      kind: 'embed',
      provider: 'suno',
      canonicalUrl: url.toString(),
      embedId,
      previewMode: 'player',
    }
  }

  return {
    kind: 'embed',
    provider: 'generic_og',
    canonicalUrl: url.toString(),
    previewMode: 'card',
  }
}

export function youtubeEmbedSrc(embedId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(embedId)}`
}

export function rumbleEmbedSrc(canonicalUrl: string): string {
  // Rumble embed pages accept /embed/{id}/ — best-effort from path
  try {
    const u = new URL(canonicalUrl)
    const id = u.pathname.split('/').filter(Boolean)[0]?.replace(/\.html$/, '')
    if (id) return `https://rumble.com/embed/${encodeURIComponent(id)}/`
  } catch {
    /* fall through */
  }
  return canonicalUrl
}
