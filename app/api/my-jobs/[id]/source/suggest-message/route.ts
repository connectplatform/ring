/**
 * POST /api/my-jobs/[id]/source/suggest-message
 * Body: { path, oldContent?, newContent }
 * Buyer/integrator/admin — TextConductor suggests a short commit message.
 */
import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { TextConductor } from '@/lib/text'
import type { JsonSchemaSpec } from '@/lib/text/conductor/types'

const MAX_DIFF_CHARS = 8_000

const COMMIT_SCHEMA: JsonSchemaSpec = {
  name: 'order_source_commit_message',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: {
        type: 'string',
        description: 'Concise conventional-ish commit message (max ~72 chars subject)',
      },
    },
    required: ['message'],
  },
}

function buildDiffSnippet(path: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const parts: string[] = [`--- a/${path}`, `+++ b/${path}`]
  const max = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < max; i++) {
    const a = oldLines[i]
    const b = newLines[i]
    if (a === b) continue
    if (a !== undefined && b === undefined) parts.push(`-${a}`)
    else if (a === undefined && b !== undefined) parts.push(`+${b}`)
    else {
      parts.push(`-${a}`)
      parts.push(`+${b}`)
    }
    if (parts.join('\n').length > MAX_DIFF_CHARS) {
      parts.push('… (diff truncated)')
      break
    }
  }
  if (parts.length <= 2) {
    parts.push('(no line-level delta; content length changed or whitespace-only)')
  }
  return parts.join('\n').slice(0, MAX_DIFF_CHARS)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id, { allowBuyer: true })
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { path?: string; oldContent?: string; newContent?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.path || typeof body.newContent !== 'string') {
    return NextResponse.json(
      { error: 'path and newContent are required' },
      { status: 400 },
    )
  }

  const oldContent = typeof body.oldContent === 'string' ? body.oldContent : ''
  const diff = buildDiffSnippet(body.path, oldContent, body.newContent)

  const result = await TextConductor.generateStructured<{ message: string }>(
    {
      input: [
        'Suggest a single short git commit message for an Order Lab thin-overlay file edit.',
        'Prefer imperative mood; mention the file basename when helpful.',
        `Path: ${body.path}`,
        'Diff:',
        diff,
      ].join('\n'),
      instructions:
        'You write concise commit messages for Ring Platform clone overlay files (ring-config, locales, overlays). No markdown fences. No body paragraphs — subject line only.',
      webSearch: false,
      xSearch: false,
      maxTokens: 120,
    },
    COMMIT_SCHEMA,
  )

  if (!result.success || !result.structured?.message) {
    return NextResponse.json(
      { error: result.error || 'Failed to suggest commit message' },
      { status: 502 },
    )
  }

  const suggestion = String(result.structured.message).trim().replace(/\s+/g, ' ').slice(0, 200)
  return NextResponse.json({ success: true, suggestion, role: access.role })
}
