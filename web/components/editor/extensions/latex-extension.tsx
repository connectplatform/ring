'use client'

import React, { useCallback, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface MathNodeAttributes {
  latex: string
  display?: boolean
}

const MathNodeView: React.FC<{
  node: ProseMirrorNode
  updateAttributes: (attrs: Partial<MathNodeAttributes>) => void
  onEdit?: (latex: string, display: boolean) => void
}> = ({ node, updateAttributes, onEdit }) => {
  const { latex, display } = node.attrs as MathNodeAttributes
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')

  React.useEffect(() => {
    if (!latex?.trim()) {
      setHtml('<span class="text-muted-foreground italic">Empty equation</span>')
      setError(null)
      return
    }
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: display ?? true,
        throwOnError: true,
        output: 'html',
        strict: false
      })
      setHtml(rendered)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid LaTeX')
      setHtml('')
    }
  }, [latex, display])

  const handleClick = useCallback(() => {
    onEdit?.(latex, display ?? true)
  }, [latex, display, onEdit])

  return (
    <NodeViewWrapper
      as="div"
      className={`my-2 scientific-math-node ${display ? 'block text-center' : 'inline'}`}
      data-display={display}
    >
      <span
        contentEditable={false}
        onClick={handleClick}
        className="cursor-pointer rounded px-1 hover:bg-[#1e3a5f]/10"
        title="Click to edit equation"
      >
        {error ? (
          <span className="text-destructive text-sm italic">{error}</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </span>
    </NodeViewWrapper>
  )
}

export interface MathExtensionOptions {
  onEdit?: (latex: string, display: boolean) => void
}

export const MathExtension = Node.create<MathExtensionOptions>({
  name: 'mathBlock',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex })
      },
      display: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-display') !== 'false',
        renderHTML: (attrs) => ({ 'data-display': attrs.display })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { 'data-type': 'math-block', class: 'scientific-math-block' },
        HTMLAttributes,
        { 'data-latex': node.attrs.latex, 'data-display': node.attrs.display }
      ),
      0
    ]
  },

  addNodeView() {
    const onEdit = this.options.onEdit
    return ReactNodeViewRenderer((props) => (
      <MathNodeView
        {...props}
        onEdit={onEdit}
      />
    ))
  }
})
