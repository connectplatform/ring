/**
 * Ring Mood Player Custom Element (light DOM — inherits page Tailwind)
 *
 * Usage:
 * <ring-mood-player playlist="uuid" show-lyrics="true"></ring-mood-player>
 */

import { createRoot, Root } from 'react-dom/client'
import React from 'react'
import { MoodPlayer } from '@/features/mood-player/components/mood-player'
import type { MoodPlaylist } from '@/features/mood-player/schemas'

function MoodPlayerHost({
  playlistId,
  showLyrics,
  autoPlay,
}: {
  playlistId: string
  showLyrics: boolean
  autoPlay: boolean
}) {
  const [playlist, setPlaylist] = React.useState<MoodPlaylist | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!playlistId) {
      setError('playlist attribute required')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/mood-player/playlists/${encodeURIComponent(playlistId)}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        if (!cancelled) setPlaylist(data.playlist as MoodPlaylist)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load playlist')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playlistId])

  if (loading) {
    return React.createElement('div', { className: 'rounded-xl border p-4 animate-pulse text-sm' }, 'Loading mood player…')
  }
  if (error || !playlist) {
    return React.createElement(
      'div',
      { className: 'rounded-xl border border-red-300 p-4 text-sm text-red-700' },
      error || 'Playlist unavailable'
    )
  }

  return React.createElement(MoodPlayer, {
    playlist,
    showLyrics,
    autoPlay,
  })
}

class RingMoodPlayerElement extends HTMLElement {
  private root: Root | null = null
  private mountPoint: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['playlist', 'show-lyrics', 'autoplay']
  }

  connectedCallback() {
    this.render()
  }

  disconnectedCallback() {
    this.root?.unmount()
    this.root = null
    this.mountPoint = null
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render()
  }

  private render() {
    if (!this.mountPoint) {
      this.mountPoint = document.createElement('div')
      this.mountPoint.setAttribute('data-ring-mood-player-root', '')
      this.replaceChildren(this.mountPoint)
      this.root = createRoot(this.mountPoint)
    }
    this.root?.render(
      React.createElement(MoodPlayerHost, {
        playlistId: this.getAttribute('playlist') || '',
        showLyrics: this.getAttribute('show-lyrics') !== 'false',
        autoPlay: this.getAttribute('autoplay') === 'true',
      })
    )
  }
}

export function registerRingMoodPlayer() {
  if (typeof window === 'undefined') return
  if (!customElements.get('ring-mood-player')) {
    customElements.define('ring-mood-player', RingMoodPlayerElement)
  }
}

if (typeof window !== 'undefined') {
  registerRingMoodPlayer()
}

export { RingMoodPlayerElement, MoodPlayerHost }
