import { z } from 'zod'

export const AirdropTriggerSchema = z.enum(['admin_verify', 'ring_username'])
export const AirdropJobStatusSchema = z.enum([
  'pending',
  'submitted',
  'settled',
  'failed',
  'rejected',
])

export const AirdropJobSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  user_id: z.string().uuid(),
  trigger: AirdropTriggerSchema,
  amount_raw: z.string(),
  status: AirdropJobStatusSchema,
  chain_signature: z.string().optional(),
  compliance_status: z.string().optional(),
  failure_reason: z.string().optional(),
})

export type AirdropJob = z.infer<typeof AirdropJobSchema> & { id?: string }
export type AirdropTrigger = z.infer<typeof AirdropTriggerSchema>
export type AirdropJobStatus = z.infer<typeof AirdropJobStatusSchema>
