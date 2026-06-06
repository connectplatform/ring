/**
 * Citation Detection Patterns
 *
 * Regex patterns for detecting in-text citations of various types.
 * Designed for Zemna.AI scientific editor — APA 7th focus with broader coverage.
 */

export type CitationType = 'apa-bracket' | 'numeric' | 'doi' | 'link'

export interface DetectedCitation {
  from: number  // absolute character offset in source text
  to: number
  text: string
  type: CitationType
  doi?: string  // extracted DOI if type === 'doi'
}

/**
 * APA bracket — single or multiple citations in one group.
 *
 * Handles:
 *   (Smith, 2020)
 *   (Smith et al., 2020, p. 45)
 *   (Smith & Jones, 2020)
 *   (Falconer,2006;Berd,2016)           ← multi-citation, no spaces
 *   (Smith, 2020; Jones & Brown, 2019)  ← multi-citation, with spaces
 *
 * Structure: \( UNIT ( ; UNIT )* \)
 * where UNIT = Author(s) \s*,\s* YEAR [, page]
 *
 * Supports Unicode author names (À-ž covers most Latin extended).
 */
const APA_BRACKET =
  /\(\s*(?:[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:\s+et\s+al\.?)?(?:\s*[&,]\s*[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+)*)\s*,\s*\d{4}(?:,\s*pp?\.\s*[\d\-–]+)?(?:\s*;\s*(?:[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:\s+et\s+al\.?)?(?:\s*[&,]\s*[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+)*)\s*,\s*\d{4}(?:,\s*pp?\.\s*[\d\-–]+)?)*\s*\)/g

/**
 * Numeric refs: [1], [1,2,3], [1-5], [1–5]
 */
const NUMERIC_REF = /\[(\d+(?:[,\s]*\d+)*(?:\s*[-–]\s*\d+)?)\]/g

/**
 * Bare DOI in text: 10.xxxx/... (no scheme required)
 */
const DOI_PATTERN = /\b(10\.\d{4,9}\/[^\s,;)\]]+)/g

export const CITATION_PATTERNS: Array<{
  type: Exclude<CitationType, 'link'>
  regex: RegExp
}> = [
  { type: 'apa-bracket', regex: APA_BRACKET },
  { type: 'numeric', regex: NUMERIC_REF },
  { type: 'doi', regex: DOI_PATTERN },
]

/**
 * Find all citation matches within a text string.
 * @param text   - The raw text content to search
 * @param offset - Character offset of this text block within the full document (for ProseMirror positions)
 */
export function findCitationsInText(text: string, offset: number): DetectedCitation[] {
  const results: DetectedCitation[] = []

  for (const { type, regex } of CITATION_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const from = offset + match.index
      const to = from + match[0].length
      const citation: DetectedCitation = { from, to, text: match[0], type }
      if (type === 'doi') {
        citation.doi = match[1] ?? match[0]
      }
      results.push(citation)
    }
  }

  // Sort by position ascending
  results.sort((a, b) => a.from - b.from)
  return results
}

/**
 * Extract a DOI from citation text (used for APA-bracket citations that may contain a DOI in the text around them).
 * Returns null if not found.
 */
export function extractDoi(text: string): string | null {
  DOI_PATTERN.lastIndex = 0
  const m = DOI_PATTERN.exec(text)
  return m ? (m[1] ?? m[0]) : null
}
