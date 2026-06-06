'use client'

import React, { useCallback, useEffect } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { MathExtension } from './extensions/latex-extension'
import { CitationDetectorExtension } from './extensions/citation-detector-extension'
import { EditorToolbar } from './editor-toolbar'
import { useTranslations } from 'next-intl'

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

export interface ScientificEditorProps {
  /** Initial content as HTML string or Tiptap JSON (for loading from publication). */
  content?: string | Record<string, unknown>
  placeholder?: string
  onChange?: (html: string, json: object) => void
  onWordCountChange?: (count: number) => void
  editable?: boolean
  className?: string
}

/**
 * ScientificEditor - Tiptap-powered rich text editor for scientific publications
 * 
 * Features:
 * - Rich text formatting (bold, italic, underline, strike)
 * - Scientific formatting (superscript, subscript, highlight)
 * - Headings (H1-H6) for paper structure
 * - Lists (ordered, unordered)
 * - Tables for data presentation
 * - Code blocks with syntax highlighting
 * - Link insertion
 * - Image placeholders
 * - Text alignment
 * - Typography improvements (smart quotes, etc.)
 */
export function ScientificEditor({
  content = '',
  placeholder = 'Start writing your research...',
  onChange,
  onWordCountChange,
  editable = true,
  className = ''
}: ScientificEditorProps) {
  const t = useTranslations('editor.scientific')

  const editor = useEditor({
    // SSR fix: disable immediate render to avoid hydration mismatch
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6]
        },
        codeBlock: false, // Using CodeBlockLowlight instead
        dropcursor: {
          color: '#1e3a5f',
          width: 2
        }
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return t('headingPlaceholder')
          }
          return placeholder
        },
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty'
      }),
      Highlight.configure({
        multicolor: true
      }),
      Typography,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Underline,
      Subscript,
      Superscript,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'scientific-table'
        }
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'scientific-figure'
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'scientific-link'
        }
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'scientific-code-block'
        }
      }),
      MathExtension,
      CitationDetectorExtension
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: `scientific-editor-content prose prose-lg dark:prose-invert max-w-none focus:outline-none ${className}`,
        style: `
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1.8;
          min-height: 60vh;
        `
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const json = editor.getJSON()
      onChange?.(html, json)
      
      // Calculate word count
      const text = editor.getText()
      const wordCount = text.split(/\s+/).filter(Boolean).length
      onWordCountChange?.(wordCount)
    }
  })

  // Update content when prop changes (supports HTML string or Tiptap JSON)
  useEffect(() => {
    if (!editor || content === undefined) return
    const current = editor.getHTML()
    if (typeof content === 'object') {
      editor.commands.setContent(content)
    } else if (content !== current) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="animate-pulse">
          {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="scientific-editor-wrapper flex flex-col h-full">
      {/* Toolbar */}
      <EditorToolbar editor={editor} />
      
      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-background">
        <EditorContent editor={editor} />
      </div>
      
      {/* Editor Styles */}
      <style jsx global>{`
        /* Empty placeholder styling */
        .scientific-editor-content .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
          font-style: italic;
        }

        .scientific-editor-content.is-editor-empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          font-style: italic;
        }

        /* Heading styles */
        .scientific-editor-content h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: hsl(var(--foreground));
        }

        .scientific-editor-content h2 {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          border-bottom: 2px solid #1e3a5f;
          padding-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }

        .scientific-editor-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }

        .scientific-editor-content h4,
        .scientific-editor-content h5,
        .scientific-editor-content h6 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }

        /* Paragraph spacing */
        .scientific-editor-content p {
          margin-bottom: 1rem;
        }

        /* Highlight colors */
        .scientific-editor-content mark {
          background-color: #d4a574;
          padding: 0.125rem 0.25rem;
          border-radius: 0.125rem;
        }

        /* Scientific link styling */
        .scientific-editor-content .scientific-link {
          color: #1e3a5f;
          text-decoration: underline;
          cursor: pointer;
        }

        .scientific-editor-content .scientific-link:hover {
          color: #4a9b8c;
        }

        /* Table styling */
        .scientific-editor-content .scientific-table {
          border-collapse: collapse;
          margin: 1.5rem 0;
          width: 100%;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.875rem;
        }

        .scientific-editor-content .scientific-table td,
        .scientific-editor-content .scientific-table th {
          border: 1px solid hsl(var(--border));
          padding: 0.75rem;
          vertical-align: top;
          min-width: 100px;
        }

        .scientific-editor-content .scientific-table th {
          background-color: hsl(var(--muted));
          font-weight: 600;
          text-align: left;
        }

        .scientific-editor-content .scientific-table td.selectedCell,
        .scientific-editor-content .scientific-table th.selectedCell {
          background-color: rgba(30, 58, 95, 0.1);
        }

        /* Figure/Image styling */
        .scientific-editor-content .scientific-figure {
          max-width: 100%;
          height: auto;
          margin: 1.5rem auto;
          display: block;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
        }

        /* Code block styling */
        .scientific-editor-content .scientific-code-block {
          background-color: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .scientific-editor-content .scientific-code-block code {
          color: hsl(var(--foreground));
          background: none;
          padding: 0;
        }

        /* Blockquote styling for citations */
        .scientific-editor-content blockquote {
          border-left: 4px solid #d4a574;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }

        /* List styling */
        .scientific-editor-content ul,
        .scientific-editor-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }

        .scientific-editor-content li {
          margin-bottom: 0.5rem;
        }

        /* Subscript and superscript */
        .scientific-editor-content sub {
          font-size: 0.75em;
          vertical-align: sub;
        }

        .scientific-editor-content sup {
          font-size: 0.75em;
          vertical-align: super;
        }

        /* Selection styling */
        .scientific-editor-content ::selection {
          background-color: rgba(30, 58, 95, 0.2);
        }

        /* Horizontal rule */
        .scientific-editor-content hr {
          border: none;
          border-top: 2px solid hsl(var(--border));
          margin: 2rem 0;
        }
      `}</style>
    </div>
  )
}

// Export types for external use
export type { Editor }
export { useEditor }

