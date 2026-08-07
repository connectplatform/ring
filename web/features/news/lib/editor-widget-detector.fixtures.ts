/**
 * Unit fixtures for editor-widget-detector (run via node --test or jest if wired).
 */

import {
  detectEmbedFromUrl,
  looksLikeLoneUrl,
} from '@/features/news/lib/editor-widget-detector'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

export function runEmbedDetectorFixtures() {
  assert(looksLikeLoneUrl('https://youtu.be/abc123'), 'lone youtube')
  assert(!looksLikeLoneUrl('see https://youtu.be/abc123 please'), 'not lone')

  const yt = detectEmbedFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert(yt.provider === 'youtube' && yt.embedId === 'dQw4w9WgXcQ', 'youtube id')

  const rumble = detectEmbedFromUrl('https://rumble.com/v12345-title.html')
  assert(rumble.provider === 'rumble', 'rumble')

  const x = detectEmbedFromUrl('https://x.com/user/status/1234567890')
  assert(x.provider === 'x' && x.embedId === '1234567890', 'x status')

  const fb = detectEmbedFromUrl('https://www.facebook.com/watch/?v=1')
  assert(fb.provider === 'facebook', 'facebook')

  const suno = detectEmbedFromUrl('https://suno.com/song/abc')
  assert(suno.provider === 'suno', 'suno')

  const generic = detectEmbedFromUrl('https://example.com/post')
  assert(generic.provider === 'generic_og', 'generic')

  return true
}
