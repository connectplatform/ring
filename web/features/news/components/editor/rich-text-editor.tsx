'use client'

/**
 * TipTapNewsAdapter entry — deferred slash / embeds / mood / video port.
 * ArticleEditor + revise use WikiRichEditor (Markdown SSOT). Do not re-wire CRUD here.
 */

export {
  TipTapNewsEditor as RichTextEditor,
  TipTapNewsEditor as TipTapNewsAdapter,
  TipTapNewsEditor as default,
} from './tiptap-news-editor'
export { TipTapNewsEditor as SimpleRichTextEditor } from './tiptap-news-editor'
