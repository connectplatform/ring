import type { PipelineId } from '@/lib/processes/registry'

type PipelineTranslationFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string

/** Resolve localized pipeline copy from modules.admin.processes.pipelines.{id}.* */
export function getLocalizedPipelineCopy(
  t: PipelineTranslationFn,
  pipelineId: string,
): { label: string; description: string; schedule: string } {
  const base = `pipelines.${pipelineId}` as const
  return {
    label: t(`${base}.label`),
    description: t(`${base}.description`),
    schedule: t(`${base}.schedule`),
  }
}

export function pipelineTranslationBase(pipelineId: PipelineId | string): string {
  return `pipelines.${pipelineId}`
}
