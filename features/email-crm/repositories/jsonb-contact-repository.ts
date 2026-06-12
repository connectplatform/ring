import 'server-only'

import {
  ContactRepository,
  ContactCreateInput,
  ContactUpdateInput,
  ContactSearchParams,
  EmailContact,
  SentimentEntry,
} from '@/services/email/crm/email-contact-service'
import { contactIdForEmail } from '@/features/email-crm/lib/contact-id'
import { parseIsoDate, queryDocs, readDoc, upsertDoc, deleteDoc } from '@/features/email-crm/lib/jsonb-collection'

const COLLECTION = 'email_contacts'

function hydrateContact(id: string, raw: Record<string, unknown>): EmailContact {
  const sentimentHistory = (Array.isArray(raw.sentimentHistory) ? raw.sentimentHistory : []).map(
    (entry) => {
      const e = entry as Record<string, unknown>
      return {
        sentiment: String(e.sentiment ?? ''),
        score: Number(e.score ?? 0),
        timestamp: parseIsoDate(e.timestamp) ?? new Date(),
      } satisfies SentimentEntry
    }
  )

  return {
    id,
    email: String(raw.email ?? ''),
    name: raw.name != null ? String(raw.name) : null,
    company: raw.company != null ? String(raw.company) : null,
    type: (raw.type as EmailContact['type']) ?? 'unknown',
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    ringUserId: raw.ringUserId != null ? String(raw.ringUserId) : null,
    firstContact: parseIsoDate(raw.firstContact) ?? new Date(),
    lastContact: parseIsoDate(raw.lastContact) ?? new Date(),
    totalInteractions: Number(raw.totalInteractions ?? 0),
    sentimentHistory,
  }
}

function toStored(contact: Partial<EmailContact>): Record<string, unknown> {
  return {
    email: contact.email,
    name: contact.name,
    company: contact.company,
    type: contact.type,
    tags: contact.tags,
    metadata: contact.metadata,
    ringUserId: contact.ringUserId,
    firstContact: contact.firstContact?.toISOString(),
    lastContact: contact.lastContact?.toISOString(),
    totalInteractions: contact.totalInteractions,
    sentimentHistory: contact.sentimentHistory?.map((e) => ({
      sentiment: e.sentiment,
      score: e.score,
      timestamp: e.timestamp.toISOString(),
    })),
  }
}

export class JsonbContactRepository implements ContactRepository {
  async findById(id: string): Promise<EmailContact | null> {
    const doc = await readDoc<Record<string, unknown>>(COLLECTION, id)
    return doc ? hydrateContact(doc.id, doc) : null
  }

  async findByEmail(email: string): Promise<EmailContact | null> {
    const id = contactIdForEmail(email)
    return this.findById(id)
  }

  async create(input: ContactCreateInput): Promise<EmailContact> {
    const id = contactIdForEmail(input.email)
    const now = new Date()
    const contact: EmailContact = {
      id,
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      company: input.company ?? null,
      type: input.type ?? 'lead',
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      ringUserId: input.ringUserId ?? null,
      firstContact: now,
      lastContact: now,
      totalInteractions: 1,
      sentimentHistory: [],
    }
    await upsertDoc(COLLECTION, id, toStored(contact))
    return contact
  }

  async update(id: string, input: ContactUpdateInput): Promise<EmailContact> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Contact not found')
    const updated: EmailContact = {
      ...existing,
      ...input,
      tags: input.tags ?? existing.tags,
      metadata: input.metadata ?? existing.metadata,
    }
    await upsertDoc(COLLECTION, id, toStored(updated))
    return updated
  }

  async search(params: ContactSearchParams): Promise<EmailContact[]> {
    const filters = []
    if (params.type) {
      filters.push({ field: 'type', operator: '=' as const, value: params.type })
    }
    const limit = (params.limit ?? 100) + (params.offset ?? 0)
    let results = (await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters,
      orderBy: [{ field: 'lastContact', direction: 'desc' }],
      limit,
    })).map((row) => hydrateContact(row.id, row))

    if (params.email) {
      const q = params.email.toLowerCase()
      results = results.filter((c) => c.email.includes(q))
    }
    if (params.name) {
      const q = params.name.toLowerCase()
      results = results.filter((c) => c.name?.toLowerCase().includes(q))
    }
    if (params.company) {
      const q = params.company.toLowerCase()
      results = results.filter((c) => c.company?.toLowerCase().includes(q))
    }
    if (params.hasRingAccount === true) {
      results = results.filter((c) => !!c.ringUserId)
    }
    if (params.tags?.length) {
      results = results.filter((c) => params.tags!.every((t) => c.tags.includes(t)))
    }

    const offset = params.offset ?? 0
    return results.slice(offset, offset + (params.limit ?? 100))
  }

  async incrementInteractions(id: string): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) return
    await upsertDoc(COLLECTION, id, {
      totalInteractions: existing.totalInteractions + 1,
      lastContact: new Date().toISOString(),
    })
  }

  async addSentimentEntry(id: string, entry: SentimentEntry): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) return
    const history = [...existing.sentimentHistory, entry].slice(-20)
    await upsertDoc(COLLECTION, id, {
      sentimentHistory: history.map((e) => ({
        sentiment: e.sentiment,
        score: e.score,
        timestamp: e.timestamp.toISOString(),
      })),
    })
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(COLLECTION, id)
  }
}
