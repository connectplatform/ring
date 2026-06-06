/**
 * CitationDetectorExtension — Tiptap Extension
 *
 * Provides a `runCitationDetector()` command that:
 *   1. Walks the ProseMirror document collecting text ranges and link marks
 *   2. Runs citation pattern matching (patterns.ts)
 *   3. Cross-references DOIs against the saved citations library (POST /api/citations/lookup)
 *   4. Validates APA 7th format (apa-validator.ts) with LLM fallback for ambiguous cases
 *   5. Builds a DecorationSet and applies it to the editor view (pure visual overlay)
 *
 * Decoration CSS classes:
 *   .citation-valid           — APA-correct green
 *   .citation-db-matched      — saved in library bright-green
 *   .citation-needs-correction — format issues light-blue
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findCitationsInText, type DetectedCitation } from '@/lib/citation-detector/patterns'
import { batchValidate } from '@/lib/citation-detector/apa-validator'

// PluginKey for accessing state outside the extension
export const citationDetectorKey = new PluginKey<DecorationSet>('citationDetector')

// Metadata key used to pass new decorations through a transaction
const DECO_META = 'citationDecorations'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Collect all detected citations from a ProseMirror document.
 * Walks every text node and extracts positions relative to the doc root.
 * Also collects link marks as citation candidates.
 */
function collectCitationsFromDoc(doc: any): DetectedCitation[] {
  const citations: DetectedCitation[] = []

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      // offset +1 because ProseMirror positions are between characters
      const found = findCitationsInText(node.text, pos)
      citations.push(...found)
    }

    // Detect link marks (href nodes) — treat each as a citation
    if (node.isInline && node.marks) {
      for (const mark of node.marks) {
        if (mark.type.name === 'link') {
          const from = pos
          const to = pos + node.nodeSize
          const exists = citations.some((c) => c.from === from && c.to === to)
          if (!exists) {
            citations.push({
              from,
              to,
              text: node.text ?? '',
              type: 'link',
            })
          }
        }
      }
    }
  })

  return citations
}

/**
 * Fetch matched DOIs from the server-side citations library.
 */
async function fetchDbMatches(dois: string[]): Promise<Set<string>> {
  if (dois.length === 0) return new Set()
  try {
    const res = await fetch('/api/citations/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dois }),
    })
    if (!res.ok) return new Set()
    const json = await res.json()
    return new Set<string>(Array.isArray(json.matchedDois) ? json.matchedDois : [])
  } catch {
    return new Set()
  }
}

// ============================================================================
// CITATION SCAN RESULT (exposed to toolbar via command callback)
// ============================================================================

export interface CitationScanResult {
  valid: number
  dbMatched: number
  needsCorrection: number
}

// ============================================================================
// EXTENSION
// ============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationDetector: {
      runCitationDetector: (
        onComplete?: (result: CitationScanResult) => void
      ) => ReturnType
    }
    citationDetectorClear: {
      clearCitationDecorations: () => ReturnType
    }
  }
}

export const CitationDetectorExtension = Extension.create({
  name: 'citationDetector',

  addCommands() {
    return {
      runCitationDetector:
        (onComplete?: (result: CitationScanResult) => void) =>
        ({ editor }: { editor: any }) => {
          const { doc } = editor.state

          // Kick off async detection — return true immediately (non-blocking)
          ;(async () => {
            try {
              // Step 1: collect all citations from document
              const detected = collectCitationsFromDoc(doc)
              if (detected.length === 0) {
                editor.view.dispatch(
                  editor.state.tr
                    .setMeta(DECO_META, DecorationSet.empty)
                    .setMeta('addToHistory', false)
                )
                onComplete?.({ valid: 0, dbMatched: 0, needsCorrection: 0 })
                return
              }

              // Step 2: DB lookup for DOI-type citations
              const dois = detected
                .filter((c) => c.type === 'doi' && c.doi)
                .map((c) => c.doi!)
              // Also extract DOIs embedded in APA brackets nearby (future enhancement)
              const dbMatched = await fetchDbMatches(dois)

              // Step 3: separate db-matched from rest
              const dbMatchedCitations: DetectedCitation[] = []
              const toValidate: DetectedCitation[] = []

              for (const c of detected) {
                if (c.doi && dbMatched.has(c.doi)) {
                  dbMatchedCitations.push(c)
                } else {
                  toValidate.push(c)
                }
              }

              // Step 4: APA validate remaining (with LLM fallback for ambiguous)
              const validations = await batchValidate(toValidate)

              // Step 5: build DecorationSet
              const decorations: Decoration[] = []
              let validCount = 0
              let needsCorrectionCount = 0

              for (const c of dbMatchedCitations) {
                decorations.push(
                  Decoration.inline(c.from, c.to, {
                    class: 'citation-db-matched',
                    title: 'Citation found in your library',
                  })
                )
              }

              for (const v of validations) {
                if (v.status === 'valid') {
                  validCount++
                  decorations.push(
                    Decoration.inline(v.citation.from, v.citation.to, {
                      class: 'citation-valid',
                      title: `Valid citation: ${v.reason}`,
                    })
                  )
                } else {
                  needsCorrectionCount++
                  decorations.push(
                    Decoration.inline(v.citation.from, v.citation.to, {
                      class: 'citation-needs-correction',
                      title: `Needs correction: ${v.reason}`,
                    })
                  )
                }
              }

              // Snapshot current state at dispatch time — doc must match the
              // transaction's base state, otherwise ProseMirror silently drops decorations.
              const currentState = editor.state
              const decoSet = DecorationSet.create(currentState.doc, decorations)
              editor.view.dispatch(
                currentState.tr
                  .setMeta(DECO_META, decoSet)
                  .setMeta('addToHistory', false)
              )

              onComplete?.({
                valid: validCount,
                dbMatched: dbMatchedCitations.length,
                needsCorrection: needsCorrectionCount,
              })
            } catch (err) {
              console.error('[CitationDetector] Scan failed:', err)
              onComplete?.({ valid: 0, dbMatched: 0, needsCorrection: 0 })
            }
          })()

          return true
        },

      clearCitationDecorations:
        () =>
        ({ editor }: { editor: any }) => {
          editor.view.dispatch(
            editor.state.tr
              .setMeta(DECO_META, DecorationSet.empty)
              .setMeta('addToHistory', false)
          )
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: citationDetectorKey,

        state: {
          init() {
            return DecorationSet.empty
          },
          apply(transaction, oldDecoSet, _oldState, newState) {
            const meta = transaction.getMeta(DECO_META)
            if (meta !== undefined) {
              return meta as DecorationSet
            }
            // Map decorations through document changes to keep positions accurate
            if (transaction.docChanged) {
              return oldDecoSet.map(transaction.mapping, newState.doc)
            }
            return oldDecoSet
          },
        },

        props: {
          decorations(state) {
            return citationDetectorKey.getState(state)
          },
        },
      }),
    ]
  },
})
