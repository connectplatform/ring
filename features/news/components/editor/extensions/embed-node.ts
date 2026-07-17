/**
 * TipTap embed node — serializes to <ring-embed> for public render + iframe for known players.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import {
  rumbleEmbedSrc,
  youtubeEmbedSrc,
  type EmbedProvider,
} from '@/features/news/lib/editor-widget-detector'

export type EmbedAttrs = {
  provider: EmbedProvider
  canonicalUrl: string
  embedId: string | null
  title: string | null
  description: string | null
  image: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ringEmbed: {
      insertRingEmbed: (attrs: Partial<EmbedAttrs> & { canonicalUrl: string; provider: EmbedProvider }) => ReturnType
    }
  }
}

export const RingEmbedExtension = Node.create({
  name: 'ringEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      provider: { default: 'generic_og' },
      canonicalUrl: { default: '' },
      embedId: { default: null },
      title: { default: null },
      description: { default: null },
      image: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'ring-embed' }]
  },

  renderHTML({ HTMLAttributes }) {
    const provider = String(HTMLAttributes.provider || 'generic_og') as EmbedProvider
    const canonicalUrl = String(HTMLAttributes.canonicalUrl || HTMLAttributes['data-canonical-url'] || '')
    const embedId = (HTMLAttributes.embedId || HTMLAttributes['data-embed-id'] || null) as string | null
    const title = (HTMLAttributes.title || HTMLAttributes['data-title'] || null) as string | null
    const description = (HTMLAttributes.description || HTMLAttributes['data-description'] || null) as
      | string
      | null
    const image = (HTMLAttributes.image || HTMLAttributes['data-image'] || null) as string | null

    const common = {
      'data-provider': provider,
      'data-canonical-url': canonicalUrl,
      'data-embed-id': embedId || undefined,
      'data-title': title || undefined,
      'data-description': description || undefined,
      'data-image': image || undefined,
      class: 'ring-embed',
    }

    if (provider === 'youtube' && embedId) {
      return [
        'ring-embed',
        mergeAttributes(common),
        [
          'iframe',
          {
            src: youtubeEmbedSrc(embedId),
            width: '560',
            height: '315',
            allow:
              'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
            loading: 'lazy',
            referrerpolicy: 'strict-origin-when-cross-origin',
            class: 'ring-embed-iframe',
          },
        ],
      ]
    }

    if (provider === 'rumble' && canonicalUrl) {
      return [
        'ring-embed',
        mergeAttributes(common),
        [
          'iframe',
          {
            src: rumbleEmbedSrc(canonicalUrl),
            width: '640',
            height: '360',
            allowfullscreen: 'true',
            loading: 'lazy',
            class: 'ring-embed-iframe',
          },
        ],
      ]
    }

    // Card-style fallback (x, facebook, suno, generic)
    return [
      'ring-embed',
      mergeAttributes(common),
      [
        'a',
        {
          href: canonicalUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'ring-embed-card',
        },
        title || canonicalUrl,
      ],
    ]
  },

  addCommands() {
    return {
      insertRingEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              provider: attrs.provider,
              canonicalUrl: attrs.canonicalUrl,
              embedId: attrs.embedId ?? null,
              title: attrs.title ?? null,
              description: attrs.description ?? null,
              image: attrs.image ?? null,
            },
          }),
    }
  },
})
