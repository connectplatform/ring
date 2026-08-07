/**
 * Zemna.AI Publications – Phase 2 Scientific Editor
 * Types for publications and version history.
 */

export type PublicationStatus = 'draft' | 'in_review' | 'published'

export interface PublicationData {
  user_id: string
  title: string
  content: Record<string, unknown>
  status: PublicationStatus
  template_id?: string
}

export interface Publication {
  id: string
  data: PublicationData
  metadata: {
    createdAt: Date
    updatedAt: Date
    version: number
  }
}

export interface PublicationVersionData {
  publication_id: string
  version_number: number
  content: Record<string, unknown>
  change_summary?: string
  created_by?: string
}

export interface PublicationVersion {
  id: string
  data: PublicationVersionData
  metadata: {
    createdAt: Date
    updatedAt: Date
    version: number
  }
}

export interface CreatePublicationInput {
  title?: string
  content?: Record<string, unknown>
  status?: PublicationStatus
  template_id?: string
}

export interface UpdatePublicationInput {
  title?: string
  content?: Record<string, unknown>
  status?: PublicationStatus
  template_id?: string
}
