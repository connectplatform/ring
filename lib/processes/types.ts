export type ProcessRunStatus = 'running' | 'success' | 'error'

export type ProcessTrigger = 'manual' | 'cron' | 'autostart'

export type PipelineCategory = 'email' | 'cleanup' | 'rewards' | 'ai' | 'commerce' | 'membership'

export interface ProcessRunData {
  pipelineId: string
  status: ProcessRunStatus
  trigger: ProcessTrigger
  startedAt: string
  finishedAt?: string
  durationMs?: number
  triggeredBy?: string
  result?: unknown
  error?: string
}

export interface ProcessRunRecord extends ProcessRunData {
  id: string
}

export interface PipelineDefinition {
  id: string
  category: PipelineCategory
  cronPath: string
  handler: () => Promise<unknown>
}

export interface PipelineSummary {
  id: string
  category: PipelineCategory
  cronPath: string
  latestRun: ProcessRunRecord | null
}

export interface RecordRunResult<T = unknown> {
  run: ProcessRunRecord
  result?: T
}
