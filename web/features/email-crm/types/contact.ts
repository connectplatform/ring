/**
 * Email CRM contact types — no runtime deps (breaks Jsonb require cycle).
 */

export type ContactType = 'lead' | 'customer' | 'partner' | 'vendor' | 'spam' | 'unknown'

export interface SentimentEntry {
  sentiment: string
  score: number
  timestamp: Date
}

export interface EmailContact {
  id: string
  email: string
  name: string | null
  company: string | null
  type: ContactType
  tags: string[]
  metadata: Record<string, unknown>
  ringUserId: string | null
  firstContact: Date
  lastContact: Date
  totalInteractions: number
  sentimentHistory: SentimentEntry[]
}

export interface ContactCreateInput {
  email: string
  name?: string
  company?: string
  type?: ContactType
  tags?: string[]
  metadata?: Record<string, unknown>
  ringUserId?: string
}

export interface ContactUpdateInput {
  name?: string
  company?: string
  type?: ContactType
  tags?: string[]
  metadata?: Record<string, unknown>
  ringUserId?: string
}

export interface ContactSearchParams {
  email?: string
  name?: string
  company?: string
  type?: ContactType
  tags?: string[]
  hasRingAccount?: boolean
  limit?: number
  offset?: number
}

export interface ContactRepository {
  findById(id: string): Promise<EmailContact | null>
  findByEmail(email: string): Promise<EmailContact | null>
  create(input: ContactCreateInput): Promise<EmailContact>
  update(id: string, input: ContactUpdateInput): Promise<EmailContact>
  search(params: ContactSearchParams): Promise<EmailContact[]>
  incrementInteractions(id: string): Promise<void>
  addSentimentEntry(id: string, entry: SentimentEntry): Promise<void>
  delete(id: string): Promise<void>
}
