import 'server-only'

import { randomUUID } from 'node:crypto'
import { db, type DbRow } from '@/lib/database'
import { getPipelineDefinition, listPipelineDefinitions } from '@/lib/processes/registry'
import type {
  PipelineSummary,
  ProcessRunData,
  ProcessRunRecord,
  ProcessTrigger,
  RecordRunResult,
} from '@/lib/processes/types'

const COLLECTION = 'process_runs'

function toRunRecord(row: DbRow<ProcessRunData>): ProcessRunRecord {
  const { id, ...data } = row
  return { id, ...data }
}

async function createRunRow(
  pipelineId: string,
  trigger: ProcessTrigger,
  triggeredBy?: string,
): Promise<ProcessRunRecord> {
  const id = randomUUID()
  const startedAt = new Date().toISOString()
  const payload = {
    pipelineId,
    status: 'running' as const,
    trigger,
    startedAt,
    ...(triggeredBy ? { triggeredBy } : {}),
  }

  const created = await db().createDoc(COLLECTION, payload, { id })
  if (!created.success || !created.data) {
    throw created.error ?? new Error('Failed to create process run record')
  }
  return toRunRecord(created.data as DbRow<ProcessRunData>)
}

async function finalizeRunRow(
  runId: string,
  update: {
    status: 'success' | 'error'
    finishedAt: string
    durationMs: number
    result?: unknown
    error?: string
  },
): Promise<ProcessRunRecord> {
  const updated = await db().updateDoc(COLLECTION, runId, update)
  if (!updated.success || !updated.data) {
    throw updated.error ?? new Error('Failed to update process run record')
  }
  return toRunRecord(updated.data as DbRow<ProcessRunData>)
}

async function fetchLatestRunsByPipeline(): Promise<Map<string, ProcessRunRecord>> {
  const result = await db().queryDocs<ProcessRunData>({
    collection: COLLECTION,
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 200 },
  })

  const map = new Map<string, ProcessRunRecord>()
  if (!result.success || !result.data) {
    return map
  }

  for (const row of result.data) {
    const run = toRunRecord(row as DbRow<ProcessRunData>)
    if (!map.has(run.pipelineId)) {
      map.set(run.pipelineId, run)
    }
  }
  return map
}

export const ProcessConductor = {
  async listPipelines(): Promise<PipelineSummary[]> {
    const latest = await fetchLatestRunsByPipeline()
    return listPipelineDefinitions().map((def) => ({
      id: def.id,
      category: def.category,
      cronPath: def.cronPath,
      latestRun: latest.get(def.id) ?? null,
    }))
  },

  async getRunHistory(pipelineId: string, limit = 20): Promise<ProcessRunRecord[]> {
    const def = getPipelineDefinition(pipelineId)
    if (!def) {
      return []
    }

    const result = await db().queryDocs<ProcessRunData>({
      collection: COLLECTION,
      filters: [{ field: 'pipelineId', operator: '==', value: pipelineId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success || !result.data) {
      return []
    }

    return result.data.map((row) => toRunRecord(row as DbRow<ProcessRunData>))
  },

  async recordRun<T>(
    pipelineId: string,
    trigger: ProcessTrigger,
    handler: () => Promise<T>,
    triggeredBy?: string,
  ): Promise<RecordRunResult<T>> {
    const def = getPipelineDefinition(pipelineId)
    if (!def) {
      throw new Error(`Unknown pipeline: ${pipelineId}`)
    }

    const started = Date.now()
    let run: ProcessRunRecord

    try {
      run = await createRunRow(pipelineId, trigger, triggeredBy)
    } catch (err) {
      console.warn('[ProcessConductor] ledger create skipped', err)
      const result = await handler()
      return {
        run: {
          id: 'ephemeral',
          pipelineId,
          status: 'success',
          trigger,
          startedAt: new Date(started).toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
          triggeredBy,
          result,
        },
        result,
      }
    }

    try {
      const result = await handler()
      const finishedAt = new Date().toISOString()
      const finalized = await finalizeRunRow(run.id, {
        status: 'success',
        finishedAt,
        durationMs: Date.now() - started,
        result,
      })
      return { run: finalized, result }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const finishedAt = new Date().toISOString()
      try {
        const finalized = await finalizeRunRow(run.id, {
          status: 'error',
          finishedAt,
          durationMs: Date.now() - started,
          error: message,
        })
        return { run: finalized }
      } catch (updateErr) {
        console.warn('[ProcessConductor] ledger finalize skipped', updateErr)
        return {
          run: {
            ...run,
            status: 'error',
            finishedAt,
            durationMs: Date.now() - started,
            error: message,
          },
        }
      }
    }
  },

  async triggerManualRun(pipelineId: string, userId: string): Promise<RecordRunResult> {
    const def = getPipelineDefinition(pipelineId)
    if (!def) {
      throw new Error(`Unknown pipeline: ${pipelineId}`)
    }
    return ProcessConductor.recordRun(pipelineId, 'manual', def.handler, userId)
  },
}
