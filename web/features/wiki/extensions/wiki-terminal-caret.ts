'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

type WikiCaretPluginState = { focused: boolean }

const wikiCaretKey = new PluginKey<WikiCaretPluginState>('wikiTerminalCaret')

/**
 * Terminal-style block caret for WikiRichEditor.
 *
 * Why not CSS `caret-color` blink? Native browser caret blink runs on its own
 * clock and fights any CSS caret-color animation → looks random. We hide the
 * native caret and draw a square widget with a single `steps(1, end)` blink.
 */
export const WikiTerminalCaret = Extension.create({
  name: 'wikiTerminalCaret',

  addProseMirrorPlugins() {
    return [
      new Plugin<WikiCaretPluginState>({
        key: wikiCaretKey,
        state: {
          init: () => ({ focused: false }),
          apply(tr, prev) {
            const meta = tr.getMeta(wikiCaretKey) as
              | Partial<WikiCaretPluginState>
              | undefined
            if (meta && typeof meta.focused === 'boolean') {
              return { focused: meta.focused }
            }
            return prev
          },
        },
        props: {
          decorations(state) {
            const pluginState = wikiCaretKey.getState(state)
            if (!pluginState?.focused) return null
            const { empty, from } = state.selection
            if (!empty) return null

            const deco = Decoration.widget(
              from,
              () => {
                const el = document.createElement('span')
                el.className = 'wiki-terminal-caret'
                el.setAttribute('aria-hidden', 'true')
                return el
              },
              { side: 0, key: 'wiki-terminal-caret' },
            )
            return DecorationSet.create(state.doc, [deco])
          },
          handleDOMEvents: {
            focus(view) {
              view.dispatch(
                view.state.tr.setMeta(wikiCaretKey, { focused: true }),
              )
              return false
            },
            blur(view) {
              view.dispatch(
                view.state.tr.setMeta(wikiCaretKey, { focused: false }),
              )
              return false
            },
          },
        },
      }),
    ]
  },
})
