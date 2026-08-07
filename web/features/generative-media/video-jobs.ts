import 'server-only'

import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import type { GenerativeMediaScope } from '@/features/generative-media/types'

export type GenerativeVideoJobStatus =
  | 'pending'
  | 'done'
  | 'failed'
  | 'expired'
  | 'cancelled'

export type GenerativeVideoJob = {
  userId: string
  requestId: string
  conversationId: string
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  prompt: string
  imageUrl: string
  purpose: string
  status: GenerativeVideoJobStatus
  progress?: number | null
  notifyIfBackground?: boolean
  actionUrl?: string
  resultUrl?: string
  resultFileId?: string
  resultRecordId?: string
  error?: string
  referenceId: string
  createdAt: string
  updatedAt: string
  finalizedAt?: string
}

export async function createGenerativeVideoJob(
  data: Omit<GenerativeVideoJob, 'createdAt' | 'updatedAt' | 'status' | 'progress'> & {
    status?: GenerativeVideoJobStatus
  },
): Promise<{ id: string; job: GenerativeVideoJob }> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const job: GenerativeVideoJob = {
    ...data,
    status: data.status || 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db().createDoc('generative_video_jobs', job, { id })
  return { id, job }
}

export async function getGenerativeVideoJob(
  jobId: string,
): Promise<(GenerativeVideoJob & { id: string }) | null> {
  const result = await db().findDocById<GenerativeVideoJob>('generative_video_jobs', jobId)
  if (!result.success || !result.data) return null
  return { ...result.data, id: jobId }
}

export async function updateGenerativeVideoJob(
  jobId: string,
  patch: Partial<GenerativeVideoJob>,
): Promise<void> {
  await db().updateDoc('generative_video_jobs', jobId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}
