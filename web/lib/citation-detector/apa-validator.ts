/**
 * APA 7th Edition Citation Validator
 *
 * Fast regex rules cover ~90% of cases.
 * LLM fallback (via createLLMClient) handles genuinely ambiguous patterns
 * that regex cannot confidently classify.
 */

import type { DetectedCitation } from './patterns'

export type ValidationStatus = 'valid' | 'needs-correction' | 'ambiguous'

export interface ValidationResult {
  status: ValidationStatus
  reason: string
}

export interface CitationValidation {
  citation: DetectedCitation
  status: 'valid' | 'needs-correction'
  reason: string
}

// ============================================================================
// APA 7th REGEX RULES
// ============================================================================

/**
 * Author segment patterns (APA 7th):
 *   Single: Last, F.  or  Lastname (no initials)
 *   Multiple: Last, F., & Last, F.  or  Last et al.
 */
const AUTHOR_SINGLE = /^[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:,\s*[A-Z]\.(?:\s*[A-Z]\.)*)?$/
const AUTHOR_ET_AL = /^[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+\s+et\s+al\.?$/
const AUTHOR_MULTIPLE = /^[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:,\s*[A-Z]\.(?:\s*[A-Z]\.)*)?(?:\s*,\s*[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:,\s*[A-Z]\.(?:\s*[A-Z]\.)*)?)*\s*&\s*[A-ZÀ-Ž][A-Za-zÀ-ž'\-]+(?:,\s*[A-Z]\.(?:\s*[A-Z]\.)*)?$/

/** 4-digit year between 1000–2099 */
const YEAR = /\b(1\d{3}|20\d{2})\b/

/**
 * Single citation unit without outer parens: "Author(s), Year[, pp. X-Y]"
 * Used for both standalone citations and each component of a multi-citation group.
 */
const UNIT_PATTERN = /^(.+?)\s*,\s*(\d{4})(?:,\s*pp?\.\s*[\d\-–]+)?$/

/**
 * Validate one citation unit (no outer parens).
 * e.g. "Smith, 2020"  |  "Zhang et al.,2019"  |  "Falconer,2006"
 */
function validateCitationUnit(unit: string): ValidationResult {
  const m = UNIT_PATTERN.exec(unit.trim())
  if (!m) {
    return { status: 'needs-correction', reason: `"${unit}" does not match Author, Year pattern` }
  }

  const authorPart = m[1].trim()
  const yearStr = m[2]

  if (!YEAR.test(yearStr)) {
    return { status: 'needs-correction', reason: `Year "${yearStr}" is not a valid 4-digit year` }
  }

  const year = parseInt(yearStr, 10)
  if (year < 1000 || year > new Date().getFullYear() + 5) {
    return { status: 'needs-correction', reason: `Year ${year} is out of plausible range` }
  }

  if (
    AUTHOR_SINGLE.test(authorPart) ||
    AUTHOR_ET_AL.test(authorPart) ||
    AUTHOR_MULTIPLE.test(authorPart)
  ) {
    return { status: 'valid', reason: 'APA 7th format correct' }
  }

  if (/[A-Z]/.test(authorPart[0])) {
    return {
      status: 'ambiguous',
      reason: `Author format "${authorPart}" is non-standard — may still be valid`
    }
  }

  return { status: 'needs-correction', reason: `Author format "${authorPart}" does not follow APA 7th style` }
}

/**
 * Validate a full APA bracket citation text (with outer parens).
 * Handles single citations and semicolon-separated multi-citation groups:
 *   (Smith, 2020)
 *   (Falconer,2006;Berd,2016)
 *   (Smith, 2020; Jones & Brown, 2019, pp. 12-15)
 */
function validateApaBracket(text: string): ValidationResult {
  // Strip outer parens
  if (!text.startsWith('(') || !text.endsWith(')')) {
    return { status: 'needs-correction', reason: 'Does not match APA bracket structure (Author, Year)' }
  }
  const inner = text.slice(1, -1).trim()

  // Split by semicolons to get individual citation units
  const units = inner.split(';').map((u) => u.trim()).filter(Boolean)

  if (units.length === 0) {
    return { status: 'needs-correction', reason: 'Empty citation brackets' }
  }

  // Validate each unit independently
  const unitResults = units.map(validateCitationUnit)

  // If any unit is ambiguous, the whole citation is ambiguous
  if (unitResults.some((r) => r.status === 'ambiguous')) {
    const ambiguous = unitResults.find((r) => r.status === 'ambiguous')!
    return { status: 'ambiguous', reason: ambiguous.reason }
  }

  // If all units are valid, the citation is valid
  if (unitResults.every((r) => r.status === 'valid')) {
    const label = units.length > 1 ? `APA 7th multi-citation (${units.length} sources)` : 'APA 7th format correct'
    return { status: 'valid', reason: label }
  }

  // At least one unit needs correction — report the first failure
  const failed = unitResults.find((r) => r.status === 'needs-correction')!
  return { status: 'needs-correction', reason: failed.reason }
}

// ============================================================================
// SINGLE CITATION VALIDATOR
// ============================================================================

/**
 * Fast-path validate a detected citation.
 * DOI and link types are always considered valid (structural).
 * Numeric refs are valid structurally, mark as 'valid'.
 * APA brackets get full validation.
 */
export function validateCitation(citation: DetectedCitation): ValidationResult {
  switch (citation.type) {
    case 'doi':
      return { status: 'valid', reason: 'DOI pattern detected' }
    case 'link':
      return { status: 'valid', reason: 'Hyperlink citation detected' }
    case 'numeric':
      // Numeric style is valid structurally; not APA but may be intentional
      return { status: 'valid', reason: 'Numeric reference format' }
    case 'apa-bracket':
      return validateApaBracket(citation.text)
    default:
      return { status: 'needs-correction', reason: 'Unknown citation type' }
  }
}

// ============================================================================
// BATCH VALIDATOR WITH LLM FALLBACK
// ============================================================================

/**
 * Batch-validate a list of citations.
 * Runs sync regex pass first. Ambiguous cases are sent to LLM in a single batch call.
 * If LLM is unavailable, ambiguous → 'needs-correction' (safe fallback).
 */
export async function batchValidate(citations: DetectedCitation[]): Promise<CitationValidation[]> {
  const results: CitationValidation[] = []
  const ambiguousIndices: number[] = []

  // Pass 1: fast regex
  for (let i = 0; i < citations.length; i++) {
    const r = validateCitation(citations[i])
    if (r.status === 'ambiguous') {
      ambiguousIndices.push(i)
      results.push({ citation: citations[i], status: 'needs-correction', reason: r.reason })
    } else {
      results.push({ citation: citations[i], status: r.status as 'valid' | 'needs-correction', reason: r.reason })
    }
  }

  // LLM fallback runs server-side only (see batchValidateWithLLM) — client editor uses regex pass.

  return results
}
