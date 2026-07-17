/**
 * Line/hunk diff utilities — ported from ring-file-registry-viewer for news revision previews.
 */

export type DiffKind = 'equal' | 'add' | 'remove'

export type DiffLine = {
  kind: DiffKind
  text: string
  sourceLine?: number
  targetLine?: number
  id: string
}

export type DiffHunk = {
  id: string
  kind: DiffKind
  lines: DiffLine[]
  hasAdd: boolean
  hasRemove: boolean
}

function normalizeComparableLine(line: string) {
  return line.replace(/[ \t]+/g, '')
}

/** Strip tags for more readable prose diffs of HTML article bodies. */
export function htmlToDiffText(html: string): string {
  return (html || '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function lineDiff(source: string[], target: string[]): DiffLine[] {
  const sourceLength = source.length
  const targetLength = target.length
  const normalizedSource = source.map(normalizeComparableLine)
  const normalizedTarget = target.map(normalizeComparableLine)
  const dp = Array.from({ length: sourceLength + 1 }, () => Array(targetLength + 1).fill(0))

  for (let i = 1; i <= sourceLength; i += 1) {
    for (let j = 1; j <= targetLength; j += 1) {
      if (normalizedSource[i - 1] === normalizedTarget[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]
      }
    }
  }

  const raw: DiffLine[] = []
  let i = sourceLength
  let j = targetLength

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalizedSource[i - 1] === normalizedTarget[j - 1]) {
      raw.push({
        kind: 'equal',
        text: source[i - 1],
        sourceLine: i,
        targetLine: j,
        id: `equal-${i}-${j}-${source[i - 1].slice(0, 12)}`,
      })
      i -= 1
      j -= 1
      continue
    }

    if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      raw.push({
        kind: 'remove',
        text: source[i - 1],
        sourceLine: i,
        id: `remove-${i}--${source[i - 1].slice(0, 12)}`,
      })
      i -= 1
      continue
    }

    if (j > 0) {
      raw.push({
        kind: 'add',
        text: target[j - 1],
        targetLine: j,
        id: `add--${j}-${target[j - 1].slice(0, 12)}`,
      })
      j -= 1
    }
  }

  return raw.reverse()
}

export function buildDiffLines(base: string | null, proposed: string | null): DiffLine[] {
  const normalizedBase = (base ?? '').replace(/\r\n/g, '\n')
  const normalizedProposed = (proposed ?? '').replace(/\r\n/g, '\n')
  const baseLines = normalizedBase.length ? normalizedBase.split('\n') : []
  const proposedLines = normalizedProposed.length ? normalizedProposed.split('\n') : []
  return lineDiff(baseLines, proposedLines)
}

export function buildPatchedCode(
  sourceCode: string | null,
  targetCode: string | null,
  selectedLineIds: Set<string>,
) {
  const normalizedSource = (sourceCode ?? '').replace(/\r\n/g, '\n')
  const normalizedTarget = (targetCode ?? '').replace(/\r\n/g, '\n')
  const sourceLines = normalizedSource.length ? normalizedSource.split('\n') : []
  const targetLines = normalizedTarget.length ? normalizedTarget.split('\n') : []

  const patch = lineDiff(sourceLines, targetLines)
  const resultLines: string[] = []
  let sourcePointer = 0
  let targetPointer = 0

  for (const line of patch) {
    if (line.kind === 'equal') {
      if (sourcePointer < sourceLines.length) {
        resultLines.push(sourceLines[sourcePointer])
      }
      sourcePointer += 1
      targetPointer += 1
      continue
    }

    if (line.kind === 'remove') {
      if (selectedLineIds.has(line.id) && sourcePointer < sourceLines.length) {
        resultLines.push(sourceLines[sourcePointer])
      }
      sourcePointer += 1
      continue
    }

    if (line.kind === 'add') {
      if (!selectedLineIds.has(line.id) && targetPointer < targetLines.length) {
        resultLines.push(targetLines[targetPointer])
      }
      targetPointer += 1
    }
  }

  return resultLines.join('\n')
}

export function groupDiffLines(lines: DiffLine[]): DiffHunk[] {
  if (!lines.length) return []

  const groups: DiffHunk[] = []
  let currentKind: DiffKind = lines[0].kind
  let currentLines: DiffLine[] = []
  let currentHasAdd = false
  let currentHasRemove = false
  let groupIndex = 0

  const flushGroup = () => {
    if (!currentLines.length) return
    groups.push({
      id: `${currentKind}-${groupIndex}-${currentLines[0]?.text.slice(0, 10)}`,
      kind: currentKind,
      lines: currentLines,
      hasAdd: currentHasAdd,
      hasRemove: currentHasRemove,
    })
    groupIndex += 1
    currentLines = []
    currentHasAdd = false
    currentHasRemove = false
  }

  for (const line of lines) {
    const shouldSplit =
      currentLines.length > 0 &&
      line.kind !== currentKind &&
      ((line.kind === 'add' && currentHasAdd) || (line.kind === 'remove' && currentHasRemove))

    if (shouldSplit) {
      flushGroup()
      currentKind = line.kind
    }

    if (!currentLines.length) {
      currentKind = line.kind
    }

    currentLines.push(line)
    if (line.kind === 'add') currentHasAdd = true
    if (line.kind === 'remove') currentHasRemove = true
  }

  flushGroup()
  return groups
}

export function summarizeDiff(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'add') added += 1
    if (line.kind === 'remove') removed += 1
  }
  return { added, removed }
}
