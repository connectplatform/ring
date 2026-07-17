/**
 * Mood player TipTap node — extracted for reuse by NewsEditor.
 */

import { Node, mergeAttributes } from '@tiptap/core'

export const MoodPlayerNode = Node.create({
  name: 'moodPlayer',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      playlist: {
        default: '',
        parseHTML: (element) => element.getAttribute('playlist') || '',
        renderHTML: (attributes) => {
          if (!attributes.playlist) return {}
          return { playlist: attributes.playlist }
        },
      },
      showLyrics: {
        default: 'true',
        parseHTML: (element) => element.getAttribute('show-lyrics') ?? 'true',
        renderHTML: (attributes) => ({
          'show-lyrics': attributes.showLyrics === false || attributes.showLyrics === 'false' ? 'false' : 'true',
        }),
      },
      autoplay: {
        default: 'false',
        parseHTML: (element) => element.getAttribute('autoplay') ?? 'false',
        renderHTML: (attributes) => {
          if (attributes.autoplay === true || attributes.autoplay === 'true') {
            return { autoplay: 'true' }
          }
          return {}
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'ring-mood-player' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['ring-mood-player', mergeAttributes(HTMLAttributes)]
  },
})
